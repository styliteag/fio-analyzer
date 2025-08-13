import { useState, useEffect, useCallback, useRef } from "react";
import { fetchTimeSeriesServers, type TimeSeriesHistoryOptions } from "../services/api/timeSeries";
import { usePaginatedTimeSeriesData } from "./usePaginatedTimeSeriesData";
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

interface PaginationProgress {
    currentBatch: number;
    totalBatches: number;
    loadedRecords: number;
    totalRecords: number;
}

interface UseTimeSeriesDataResult {
    // Server data
    serverGroups: ServerGroup[];
    
    // Chart data - now organized by series instead of just servers
    chartData: { [serverId: string]: any[] };
    seriesData: TimeSeriesDataSeries[];
    
    // Loading states
    loading: boolean;
    serversLoading: boolean;
    
    // Pagination progress
    paginationProgress: PaginationProgress | null;
    
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

    // Use the new pagination hook
    const paginatedData = usePaginatedTimeSeriesData();

    // AbortController management for servers request
    const serversAbortControllerRef = useRef<AbortController | null>(null);
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
     * Loads time series data for selected servers and time range using pagination
     */
    const loadTimeSeriesData = useCallback(async (selectedServerIds: string[], timeRange: TimeRange, filters?: TimeSeriesFilters) => {
        if (!validateServerSelection(selectedServerIds)) {
            setChartData({});
            setSeriesData([]);
            return;
        }

        setLoading(true);
        setError(null);
        setIsCancelled(false);

        try {
            const { days, hours } = getTimeRangeParams(timeRange);

            // Build query options for pagination
            const queryOptions: TimeSeriesHistoryOptions = {
                days,
                hours,
                metricType: 'iops', // Focus on IOPS data for now
            };

            // Add hostname filter if provided
            if (filters && filters.hostnames.length > 0) {
                queryOptions.hostname = filters.hostnames[0]; // Use first hostname for now
            }

            // Add other filters
            if (filters) {
                if (filters.protocols.length > 0) {
                    queryOptions.protocol = filters.protocols[0];
                }
                if (filters.drive_models.length > 0) {
                    queryOptions.driveModel = filters.drive_models[0];
                }
                if (filters.drive_types.length > 0) {
                    queryOptions.driveType = filters.drive_types[0];
                }
                if (filters.block_sizes.length > 0) {
                    queryOptions.blockSize = filters.block_sizes[0];
                }
                if (filters.patterns.length > 0) {
                    queryOptions.readWritePattern = filters.patterns[0];
                }
                if (filters.start_date) {
                    queryOptions.startDate = filters.start_date;
                }
                if (filters.end_date) {
                    queryOptions.endDate = filters.end_date;
                }
            }

            console.log('🚀 [useTimeSeriesData] Starting paginated fetch with options:', queryOptions);

            // Use pagination hook to fetch all data
            await paginatedData.fetchAllData(queryOptions);

            // Process the paginated data into chart format
            const allData = paginatedData.data;
            console.log('📊 [useTimeSeriesData] Processing paginated data:', allData.length, 'records');

            if (allData.length > 0) {
                // Group data by configuration
                const seriesMap = new Map<string, TimeSeriesDataSeries>();
                const serverDataMap: { [serverId: string]: any[] } = {};

                // Find the server group for this hostname
                const hostname = queryOptions.hostname;
                const serverGroup = serverGroups.find(group => group.hostname === hostname);
                
                if (serverGroup) {
                    const serverId = serverGroup.id;
                    serverDataMap[serverId] = allData;

                    // Group by configuration
                    const dataByConfig = new Map<string, any[]>();
                    
                    for (const dataPoint of allData) {
                        const configKey = `${dataPoint.block_size}-${dataPoint.read_write_pattern}-${dataPoint.queue_depth}`;
                        
                        let configData = dataByConfig.get(configKey);
                        if (!configData) {
                            configData = [];
                            dataByConfig.set(configKey, configData);
                        }
                        configData.push(dataPoint);
                    }
                    
                    // Create series for each configuration
                    dataByConfig.forEach((data, configKey) => {
                        if (data.length === 0) return;
                        
                        const firstPoint = data[0];
                        const seriesId = `${serverId}-${configKey}`;
                        const label = `${serverGroup.hostname} (${serverGroup.protocol}) - ${firstPoint.block_size} ${firstPoint.read_write_pattern} Q${firstPoint.queue_depth}`;
                        
                        seriesMap.set(seriesId, {
                            id: seriesId,
                            serverId: serverId,
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
                }

                setChartData(serverDataMap);
                setSeriesData(Array.from(seriesMap.values()));

                console.log('✅ [useTimeSeriesData] Data processing complete:', {
                    servers: Object.keys(serverDataMap).length,
                    series: seriesMap.size,
                    totalRecords: allData.length
                });
            }

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
        }
    }, [serverGroups, paginatedData]);

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
        
        // Also cancel pagination requests
        paginatedData.cancel();
        
        setIsCancelled(true);
        setLoading(false);
        setServersLoading(false);
        
        console.log('Time series data fetch cancelled by user');
    }, [paginatedData]);

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
            paginatedData.cancel();
        };
    }, [paginatedData]);

    return {
        serverGroups,
        chartData,
        seriesData,
        loading: loading || paginatedData.loading,
        serversLoading,
        paginationProgress: paginatedData.progress,
        error: error || paginatedData.error,
        loadTimeSeriesData,
        refreshServers,
        clearError,
        cancel,
        isCancelled: isCancelled || paginatedData.isCancelled,
    };
};