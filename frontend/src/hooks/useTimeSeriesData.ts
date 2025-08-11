import { useState, useEffect, useCallback, useRef } from "react";
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
import { isAbortError, isCancelledError } from '../types/api';

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
    
    // Cancellation
    cancel: () => void;
    isCancelled: boolean;
}

export const useTimeSeriesData = (): UseTimeSeriesDataResult => {
    const [serverGroups, setServerGroups] = useState<ServerGroup[]>([]);
    const [chartData, setChartData] = useState<{ [serverId: string]: any[] }>({});
    const [seriesData, setSeriesData] = useState<TimeSeriesDataSeries[]>([]);
    const [loading, setLoading] = useState(false);
    const [serversLoading, setServersLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // AbortController management for complex time series queries
    const serversAbortControllerRef = useRef<AbortController | null>(null);
    const timeSeriesAbortControllerRef = useRef<AbortController | null>(null);
    const [isCancelled, setIsCancelled] = useState(false);

    /**
     * Loads and groups servers from the API
     */
    const loadServers = useCallback(async () => {
        try {
            // Cancel any existing servers request
            if (serversAbortControllerRef.current) {
                serversAbortControllerRef.current.abort();
            }

            // Create new AbortController for this request
            const abortController = new AbortController();
            serversAbortControllerRef.current = abortController;

            setServersLoading(true);
            setError(null);
            setIsCancelled(false);
            
            const response = await fetchTimeSeriesServers(abortController.signal);
            
            // Check if request was cancelled
            if (abortController.signal.aborted) {
                return;
            }
            
            if (response.error) {
                throw new Error(response.error);
            }
            
            const serversData = response.data || [];
            const groupedServers = groupServers(serversData);
            setServerGroups(groupedServers);
            
        } catch (err) {
            // Handle AbortError specifically
            if (isAbortError(err) || isCancelledError(err)) {
                setIsCancelled(true);
                return;
            }

            const errorMessage = err instanceof Error ? err.message : "Failed to fetch servers";
            setError(errorMessage);
            console.error("Failed to fetch servers:", err);
        } finally {
            setServersLoading(false);
            serversAbortControllerRef.current = null;
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

        try {
            // Cancel any existing time series request
            if (timeSeriesAbortControllerRef.current) {
                timeSeriesAbortControllerRef.current.abort();
            }

            // Create new AbortController for this complex request
            const abortController = new AbortController();
            timeSeriesAbortControllerRef.current = abortController;

            setLoading(true);
            setError(null);
            setIsCancelled(false);

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

            // OPTIMIZED: Generate queries with reduced complexity and batching
            const queries: Promise<any>[] = [];
            
            // Create Map for O(1) server lookup
            // serverGroupMap removed as it's not used in the optimized version
            const hostnameMap = new Map<string, ServerGroup[]>();
            serverGroups.forEach(group => {
                if (!hostnameMap.has(group.hostname)) {
                    hostnameMap.set(group.hostname, []);
                }
                hostnameMap.get(group.hostname)!.push(group);
            });

            // Determine servers to query with optimized filtering
            let serversToQuery: ServerGroup[];
            if (filters && filters.hostnames.length > 0) {
                // Use hostname map for O(1) lookup instead of filter
                serversToQuery = [];
                for (const hostname of filters.hostnames) {
                    const groupsForHost = hostnameMap.get(hostname);
                    if (groupsForHost) {
                        serversToQuery.push(...groupsForHost.filter(group => 
                            !filters.protocols.length || filters.protocols.includes(group.protocol)
                        ));
                    }
                }
            } else {
                serversToQuery = serverGroups.filter(group => selectedServerIds.includes(group.id));
            }

            // Pre-compute filter combinations to avoid nested loops
            const filterCombinations = [];
            const blockSizes = filters && filters.block_sizes.length > 0 ? filters.block_sizes : [''];
            const patterns = filters && filters.patterns.length > 0 ? filters.patterns : [''];
            
            // Generate combinations more efficiently
            for (const blockSize of blockSizes) {
                for (const pattern of patterns) {
                    filterCombinations.push({ blockSize, pattern });
                }
            }

            // Generate queries with reduced nesting
            for (const group of serversToQuery) {
                // Filter drive models for this group upfront
                const relevantDriveModels = filters && filters.drive_models.length > 0 
                    ? filters.drive_models.filter(model => group.driveModels.includes(model))
                    : [''];

                for (const { blockSize, pattern } of filterCombinations) {
                    for (const driveModel of relevantDriveModels) {
                        // Build query options efficiently
                        const queryOptions: TimeSeriesHistoryOptions = {
                            hostname: group.hostname,
                            protocol: group.protocol,
                            days,
                            hours,
                        };

                        // Apply filters in batch
                        if (filters) {
                            if (blockSize) queryOptions.blockSize = blockSize;
                            if (pattern) queryOptions.readWritePattern = pattern;
                            if (driveModel) queryOptions.driveModel = driveModel;
                            
                            // Apply single-value filters efficiently
                            const singleValueFilters = [
                                { filter: filters.drive_types, key: 'driveType' },
                                { filter: filters.queue_depths, key: 'queueDepth' },
                                { filter: filters.test_sizes, key: 'testSize' },
                                { filter: filters.syncs, key: 'sync' },
                                { filter: filters.directs, key: 'direct' },
                                { filter: filters.num_jobs, key: 'numJobs' },
                                { filter: filters.durations, key: 'duration' },
                            ];

                            for (const { filter, key } of singleValueFilters) {
                                if (filter.length > 0) {
                                    (queryOptions as any)[key] = filter[0];
                                }
                            }
                            
                            if (filters.start_date) queryOptions.startDate = filters.start_date;
                            if (filters.end_date) queryOptions.endDate = filters.end_date;
                        }

                        queries.push(
                            fetchTimeSeriesHistory(queryOptions, abortController.signal).then(response => ({
                                serverId: group.id,
                                data: response.data || [],
                                error: response.error,
                                queryKey: `${group.id}-${blockSize}-${pattern}-${driveModel}` // Add for better debugging
                            }))
                        );
                    }
                }
            }

            const results = await Promise.all(queries);
            
            // Check if operation was cancelled after all promises complete
            if (abortController.signal.aborted) {
                return;
            }
            
            // OPTIMIZED: Process results with Maps and single-pass operations
            const seriesMap = new Map<string, TimeSeriesDataSeries>();
            const serverDataMap: { [serverId: string]: any[] } = {};
            const resultServerGroupMap = new Map(serverGroups.map(group => [group.id, group]));
            
            // Pre-initialize serverDataMap for better performance
            for (const group of serverGroups) {
                if (selectedServerIds.includes(group.id)) {
                    serverDataMap[group.id] = [];
                }
            }
            
            results.forEach(result => {
                if (result.error) {
                    console.warn(`Failed to fetch data: ${result.error}`);
                    return;
                }
                
                // Single-pass grouping by configuration
                const dataByConfig = new Map<string, any[]>();
                
                for (const dataPoint of result.data) {
                    // Create unique key for this test configuration
                    const configKey = `${dataPoint.block_size}-${dataPoint.read_write_pattern}-${dataPoint.queue_depth}`;
                    
                    let configData = dataByConfig.get(configKey);
                    if (!configData) {
                        configData = [];
                        dataByConfig.set(configKey, configData);
                    }
                    configData.push(dataPoint);
                }
                
                // Create series for each unique configuration
                const serverGroup = resultServerGroupMap.get(result.serverId);
                if (!serverGroup) return;
                
                dataByConfig.forEach((data, configKey) => {
                    if (data.length === 0) return;
                    
                    const firstPoint = data[0];
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
                
                // Efficiently append to existing array
                if (serverDataMap[result.serverId]) {
                    serverDataMap[result.serverId].push(...result.data);
                }
            });

            setChartData(serverDataMap);
            setSeriesData(Array.from(seriesMap.values()));

        } catch (err) {
            // Handle AbortError specifically
            if (isAbortError(err) || isCancelledError(err)) {
                setIsCancelled(true);
                return;
            }

            const errorMessage = err instanceof Error ? err.message : "Failed to fetch time-series data";
            setError(errorMessage);
            console.error("Failed to fetch time-series data:", err);
        } finally {
            setLoading(false);
            timeSeriesAbortControllerRef.current = null;
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
        setIsCancelled(false);
    }, []);

    /**
     * Cancels all ongoing requests
     */
    const cancel = useCallback(() => {
        if (serversAbortControllerRef.current) {
            serversAbortControllerRef.current.abort();
            serversAbortControllerRef.current = null;
        }
        
        if (timeSeriesAbortControllerRef.current) {
            timeSeriesAbortControllerRef.current.abort();
            timeSeriesAbortControllerRef.current = null;
        }
        
        setIsCancelled(true);
        setLoading(false);
        setServersLoading(false);
        
        console.log('Time series data fetch cancelled by user');
    }, []);

    // Load servers on component mount
    useEffect(() => {
        loadServers();
    }, [loadServers]);

    // Cleanup on unmount - cancel all ongoing requests
    useEffect(() => {
        return () => {
            if (serversAbortControllerRef.current) {
                serversAbortControllerRef.current.abort();
            }
            if (timeSeriesAbortControllerRef.current) {
                timeSeriesAbortControllerRef.current.abort();
            }
        };
    }, []);

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
        cancel,
        isCancelled,
    };
};