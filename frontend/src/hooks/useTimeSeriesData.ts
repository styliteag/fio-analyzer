import { useState, useEffect, useCallback } from "react";
import { fetchTimeSeriesServers, fetchTimeSeriesHistory, type TimeSeriesHistoryOptions } from "../services/api/timeSeries";
import { 
    groupServers, 
    getTimeRangeParams, 
    validateServerSelection,
    type ServerGroup,
    type TimeRange,
    type TimeSeriesDataSeries,
} from "../utils/timeSeriesHelpers";
import type { TimeSeriesFilters } from "../utils/filterConverters";

interface UseTimeSeriesDataResult {
    // Server data
    serverGroups: ServerGroup[];
    
    // Chart data - now organized by series instead of just servers
    chartData: { [serverId: string]: any[] };
    seriesData: TimeSeriesDataSeries[];
    
    // Loading states
    loading: boolean;
    serversLoading: boolean;
    
    // Error states
    error: string | null;
    
    // Actions
    loadTimeSeriesData: (serverIds: string[], timeRange: TimeRange, filters?: TimeSeriesFilters) => Promise<void>;
    refreshServers: () => Promise<void>;
    clearError: () => void;
}

export const useTimeSeriesData = (): UseTimeSeriesDataResult => {
    const [serverGroups, setServerGroups] = useState<ServerGroup[]>([]);
    const [chartData, setChartData] = useState<{ [serverId: string]: any[] }>({});
    const [seriesData, setSeriesData] = useState<TimeSeriesDataSeries[]>([]);
    const [loading, setLoading] = useState(false);
    const [serversLoading, setServersLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /**
     * Loads and groups servers from the API
     */
    const loadServers = useCallback(async () => {
        setServersLoading(true);
        setError(null);
        
        try {
            const response = await fetchTimeSeriesServers();
            
            if (response.error) {
                throw new Error(response.error);
            }
            
            const serversData = response.data || [];
            const groupedServers = groupServers(serversData);
            setServerGroups(groupedServers);
            
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Failed to fetch servers";
            setError(errorMessage);
            console.error("Failed to fetch servers:", err);
        } finally {
            setServersLoading(false);
        }
    }, []);

    /**
     * Loads time series data for selected servers and time range
     */
    const loadTimeSeriesData = useCallback(async (selectedServerIds: string[], timeRange: TimeRange, filters?: TimeSeriesFilters) => {
        if (!validateServerSelection(selectedServerIds)) {
            setChartData({});
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { days, hours } = getTimeRangeParams(timeRange);

            // Create a base query for all combinations of filters
            const baseQuery: TimeSeriesHistoryOptions = {
                days,
                hours,
            };

            // Add hostname/protocol filters if provided
            if (filters) {
                if (filters.hostnames.length > 0) {
                    baseQuery.hostname = filters.hostnames[0]; // Start with first hostname
                }
                if (filters.protocols.length > 0) {
                    baseQuery.protocol = filters.protocols[0]; // Start with first protocol
                }
                if (filters.drive_models.length > 0) {
                    baseQuery.driveModel = filters.drive_models[0];
                }
                if (filters.drive_types.length > 0) {
                    baseQuery.driveType = filters.drive_types[0];
                }
                if (filters.block_sizes.length > 0) {
                    baseQuery.blockSize = filters.block_sizes[0];
                }
                if (filters.patterns.length > 0) {
                    baseQuery.readWritePattern = filters.patterns[0];
                }
                if (filters.start_date) {
                    baseQuery.startDate = filters.start_date;
                }
                if (filters.end_date) {
                    baseQuery.endDate = filters.end_date;
                }
            }

            // Generate queries for all filter combinations
            const queries: Promise<any>[] = [];

            // If no hostname filter, query all server groups
            const serversToQuery = filters && filters.hostnames.length > 0 
                ? serverGroups.filter(group => filters.hostnames.includes(group.hostname))
                : serverGroups.filter(group => selectedServerIds.includes(group.id));

            for (const group of serversToQuery) {
                // If hostname/protocol filters are active, skip non-matching servers
                if (filters && filters.hostnames.length > 0 && !filters.hostnames.includes(group.hostname)) continue;
                if (filters && filters.protocols.length > 0 && !filters.protocols.includes(group.protocol)) continue;

                // Generate queries for all combinations of block sizes and patterns
                const blockSizes = filters && filters.block_sizes.length > 0 ? filters.block_sizes : [''];
                const patterns = filters && filters.patterns.length > 0 ? filters.patterns : [''];
                const driveModels = filters && filters.drive_models.length > 0 
                    ? filters.drive_models.filter(model => group.driveModels.includes(model))
                    : [''];

                for (const blockSize of blockSizes) {
                    for (const pattern of patterns) {
                        for (const driveModel of driveModels) {
                            const queryOptions: TimeSeriesHistoryOptions = {
                                hostname: group.hostname,
                                protocol: group.protocol,
                                days,
                                hours,
                            };

                            if (filters) {
                                if (blockSize) queryOptions.blockSize = blockSize;
                                if (pattern) queryOptions.readWritePattern = pattern;
                                if (driveModel) queryOptions.driveModel = driveModel;
                                if (filters.drive_types.length > 0) {
                                    queryOptions.driveType = filters.drive_types[0];
                                }
                                if (filters.queue_depths.length > 0) {
                                    queryOptions.queueDepth = filters.queue_depths[0];
                                }
                                if (filters.test_sizes.length > 0) {
                                    queryOptions.testSize = filters.test_sizes[0];
                                }
                                if (filters.syncs.length > 0) {
                                    queryOptions.sync = filters.syncs[0];
                                }
                                if (filters.directs.length > 0) {
                                    queryOptions.direct = filters.directs[0];
                                }
                                if (filters.num_jobs.length > 0) {
                                    queryOptions.numJobs = filters.num_jobs[0];
                                }
                                if (filters.durations.length > 0) {
                                    queryOptions.duration = filters.durations[0];
                                }
                                if (filters.start_date) queryOptions.startDate = filters.start_date;
                                if (filters.end_date) queryOptions.endDate = filters.end_date;
                            }

                            queries.push(
                                fetchTimeSeriesHistory(queryOptions).then(response => ({
                                    serverId: group.id,
                                    data: response.data || [],
                                    error: response.error
                                }))
                            );
                        }
                    }
                }
            }

            const results = await Promise.all(queries);
            
            // Process results into series data
            const seriesMap = new Map<string, TimeSeriesDataSeries>();
            const serverDataMap: { [serverId: string]: any[] } = {};
            
            results.forEach(result => {
                if (result.error) {
                    console.warn(`Failed to fetch data: ${result.error}`);
                    return;
                }
                
                // Group data by unique combinations of test configuration
                const dataByConfig = new Map<string, any[]>();
                
                result.data.forEach((dataPoint: any) => {
                    // Create unique key for this test configuration
                    const configKey = `${dataPoint.block_size}-${dataPoint.read_write_pattern}-${dataPoint.queue_depth}`;
                    
                    if (!dataByConfig.has(configKey)) {
                        dataByConfig.set(configKey, []);
                    }
                    dataByConfig.get(configKey)!.push(dataPoint);
                });
                
                // Create series for each unique configuration
                dataByConfig.forEach((data, configKey) => {
                    if (data.length === 0) return;
                    
                    const firstPoint = data[0];
                    const serverGroup = serverGroups.find(g => g.id === result.serverId);
                    
                    if (!serverGroup) return;
                    
                    const seriesId = `${result.serverId}-${configKey}`;
                    const label = `${serverGroup.hostname} (${serverGroup.protocol}) - ${firstPoint.block_size} ${firstPoint.read_write_pattern} Q${firstPoint.queue_depth}`;
                    
                    seriesMap.set(seriesId, {
                        id: seriesId,
                        serverId: result.serverId,
                        hostname: serverGroup.hostname,
                        protocol: serverGroup.protocol,
                        driveModel: firstPoint.drive_model || '',
                        blockSize: firstPoint.block_size,
                        pattern: firstPoint.read_write_pattern,
                        queueDepth: firstPoint.queue_depth,
                        data: data,
                        label: label
                    });
                });
                
                // Keep backward compatibility with existing chartData structure
                if (!serverDataMap[result.serverId]) {
                    serverDataMap[result.serverId] = [];
                }
                serverDataMap[result.serverId].push(...result.data);
            });

            setChartData(serverDataMap);
            setSeriesData(Array.from(seriesMap.values()));

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Failed to fetch time-series data";
            setError(errorMessage);
            console.error("Failed to fetch time-series data:", err);
        } finally {
            setLoading(false);
        }
    }, [serverGroups]);

    /**
     * Refreshes server data
     */
    const refreshServers = useCallback(async () => {
        await loadServers();
    }, [loadServers]);

    /**
     * Clears error state
     */
    const clearError = useCallback(() => {
        setError(null);
    }, []);

    // Load servers on component mount
    useEffect(() => {
        loadServers();
    }, [loadServers]);

    return {
        serverGroups,
        chartData,
        seriesData,
        loading,
        serversLoading,
        error,
        loadTimeSeriesData,
        refreshServers,
        clearError,
    };
};