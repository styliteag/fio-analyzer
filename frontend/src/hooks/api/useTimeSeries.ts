// Custom hook for time series data operations
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    fetchTimeSeriesServers,
    fetchTimeSeriesLatest,
    fetchTimeSeriesTrends,
} from '../../services/api';
import { usePaginatedTimeSeriesData } from '../usePaginatedTimeSeriesData';
import type { 
    ServerInfo, 
    TimeSeriesDataPoint, 
    TrendDataPoint,
} from '../../types';
import type {
    TimeSeriesHistoryOptions,
    TimeSeriesTrendsOptions,
} from '../../services/api/timeSeries';

export interface UseTimeSeriesServersResult {
    servers: ServerInfo[];
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

export const useTimeSeriesServers = (autoFetch: boolean = true): UseTimeSeriesServersResult => {
    const [servers, setServers] = useState<ServerInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchServers = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            
            const response = await fetchTimeSeriesServers();
            if (response.data) {
                setServers(response.data);
            } else {
                throw new Error(response.error || 'Failed to fetch servers');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to fetch servers');
            console.error('Error fetching time series servers:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (autoFetch) {
            fetchServers();
        }
    }, [autoFetch, fetchServers]);

    return {
        servers,
        loading,
        error,
        refetch: fetchServers,
    };
};

export interface UseTimeSeriesLatestResult {
    data: TimeSeriesDataPoint[];
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
    groupedByServer: Map<string, TimeSeriesDataPoint[]>;
}

export const useTimeSeriesLatest = (autoFetch: boolean = true): UseTimeSeriesLatestResult => {
    const [data, setData] = useState<TimeSeriesDataPoint[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchLatest = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            
            const response = await fetchTimeSeriesLatest();
            if (response.data) {
                setData(response.data);
            } else {
                throw new Error(response.error || 'Failed to fetch latest data');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to fetch latest data');
            console.error('Error fetching time series latest:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const groupedByServer = useMemo(() => {
        const grouped = new Map<string, TimeSeriesDataPoint[]>();
        
        data.forEach(point => {
            const serverKey = `${point.hostname}_${point.protocol}`;
            if (!grouped.has(serverKey)) {
                grouped.set(serverKey, []);
            }
            grouped.get(serverKey)?.push(point);
        });
        
        return grouped;
    }, [data]);

    useEffect(() => {
        if (autoFetch) {
            fetchLatest();
        }
    }, [autoFetch, fetchLatest]);

    return {
        data,
        loading,
        error,
        refetch: fetchLatest,
        groupedByServer,
    };
};

export interface UseTimeSeriesHistoryResult {
    data: TimeSeriesDataPoint[];
    loading: boolean;
    error: string | null;
    refetch: (options?: TimeSeriesHistoryOptions) => Promise<void>;
    isEmpty: boolean;
}

export interface UseTimeSeriesHistoryProps {
    options: TimeSeriesHistoryOptions;
    autoFetch?: boolean;
    refreshInterval?: number;
}

export const useTimeSeriesHistory = ({
    options,
    autoFetch = true,
    refreshInterval,
}: UseTimeSeriesHistoryProps): UseTimeSeriesHistoryResult => {
    // Use pagination hook for complete data access
    const paginatedData = usePaginatedTimeSeriesData();
    
    // Keep local state for backward compatibility
    const [data, setData] = useState<TimeSeriesDataPoint[]>([]);
    
    const fetchHistory = useCallback(async (fetchOptions?: TimeSeriesHistoryOptions) => {
        console.log('🚀 [useTimeSeriesHistory] Starting paginated fetch...');
        
        try {
            // Use pagination hook to fetch ALL data
            await paginatedData.fetchAllData(fetchOptions || options);
            console.log('✅ [useTimeSeriesHistory] Paginated data loaded:', paginatedData.data.length, 'records');
        } catch (error) {
            console.error('❌ [useTimeSeriesHistory] Failed to load paginated data:', error);
        }
    }, [options, paginatedData.fetchAllData]); // eslint-disable-line react-hooks/exhaustive-deps

    // Update local data state when pagination data changes
    useEffect(() => {
        setData(paginatedData.data);
    }, [paginatedData.data]);

    const isEmpty = useMemo(() => data.length === 0, [data.length]);

    // Auto-fetch when options change
    useEffect(() => {
        if (autoFetch) {
            fetchHistory();
        }
    }, [autoFetch, fetchHistory]);

    // Set up refresh interval if specified
    useEffect(() => {
        if (!refreshInterval) return;

        const interval = setInterval(() => {
            fetchHistory();
        }, refreshInterval);

        return () => clearInterval(interval);
    }, [refreshInterval, fetchHistory]);

    return {
        data,
        loading: paginatedData.loading,
        error: paginatedData.error,
        refetch: fetchHistory,
        isEmpty,
    };
};

export interface UseTimeSeriesTrendsResult {
    data: TrendDataPoint[];
    loading: boolean;
    error: string | null;
    refetch: (options?: TimeSeriesTrendsOptions) => Promise<void>;
    summary: {
        totalPoints: number;
        avgValue: number;
        avgMovingAvg: number;
        trend: 'up' | 'down' | 'stable';
    } | null;
}

export interface UseTimeSeriesTrendsProps {
    options: TimeSeriesTrendsOptions;
    autoFetch?: boolean;
}

export const useTimeSeriesTrends = ({
    options,
    autoFetch = true,
}: UseTimeSeriesTrendsProps): UseTimeSeriesTrendsResult => {
    const [data, setData] = useState<TrendDataPoint[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchTrends = useCallback(async (fetchOptions?: TimeSeriesTrendsOptions) => {
        try {
            setLoading(true);
            setError(null);
            
            const response = await fetchTimeSeriesTrends(fetchOptions || options);
            if (response.data) {
                setData(response.data);
            } else {
                throw new Error(response.error || 'Failed to fetch trends data');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to fetch trends data');
            console.error('Error fetching time series trends:', err);
        } finally {
            setLoading(false);
        }
    }, [options]);

    const summary = useMemo(() => {
        if (data.length === 0) return null;

        const totalPoints = data.length;
        const avgValue = data.reduce((sum, point) => sum + point.value, 0) / totalPoints;
        const avgMovingAvg = data.reduce((sum, point) => sum + point.moving_avg, 0) / totalPoints;
        
        // Determine trend based on first and last moving average
        const firstMovingAvg = data[0]?.moving_avg || 0;
        const lastMovingAvg = data[data.length - 1]?.moving_avg || 0;
        const percentChange = ((lastMovingAvg - firstMovingAvg) / firstMovingAvg) * 100;
        
        let trend: 'up' | 'down' | 'stable' = 'stable';
        if (Math.abs(percentChange) > 5) {
            trend = percentChange > 0 ? 'up' : 'down';
        }

        return {
            totalPoints,
            avgValue,
            avgMovingAvg,
            trend,
        };
    }, [data]);

    useEffect(() => {
        if (autoFetch) {
            fetchTrends();
        }
    }, [autoFetch, fetchTrends]);

    return {
        data,
        loading,
        error,
        refetch: fetchTrends,
        summary,
    };
};

