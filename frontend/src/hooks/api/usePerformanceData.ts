// Custom hook for performance data operations
import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchPerformanceData, fetchSinglePerformanceData, getDefaultMetrics } from '../../services/api';
import { validatePerformanceData } from '../../services/data';
import type { PerformanceData } from '../../types';

export interface UsePerformanceDataResult {
    data: PerformanceData[];
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
    isEmpty: boolean;
    hasValidData: boolean;
}

export interface UsePerformanceDataOptions {
    testRunIds: number[];
    metricTypes?: string[];
    autoFetch?: boolean;
    validateData?: boolean;
}

export const usePerformanceData = (options: UsePerformanceDataOptions): UsePerformanceDataResult => {
    const { testRunIds, metricTypes, autoFetch = true, validateData = true } = options;
    
    const [data, setData] = useState<PerformanceData[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        if (testRunIds.length === 0) {
            setData([]);
            return;
        }

        try {
            setLoading(true);
            setError(null);
            
            const metrics = metricTypes?.length ? metricTypes : getDefaultMetrics();
            const response = await fetchPerformanceData({
                testRunIds,
                metricTypes: metrics,
            });

            const performanceData = Array.isArray(response) ? response : (response.data || []);

            // Validate data if enabled
            if (validateData) {
                const validation = validatePerformanceData(performanceData);
                if (!validation.valid) {
                    console.warn('Performance data validation warnings:', validation.errors);
                }
            }

            setData(performanceData);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch performance data');
            console.error('Error fetching performance data:', err);
            setData([]);
        } finally {
            setLoading(false);
        }
    }, [testRunIds, metricTypes, validateData]);

    // Memoized computed values
    const isEmpty = useMemo(() => data.length === 0, [data.length]);
    
    const hasValidData = useMemo(() => {
        if (isEmpty) return false;
        
        // Check if at least one item has valid metrics
        return data.some(item => 
            item.metrics && 
            Object.keys(item.metrics).length > 0 &&
            Object.values(item.metrics).some(metric => 
                metric && typeof metric.value === 'number' && !isNaN(metric.value)
            )
        );
    }, [data, isEmpty]);

    // Auto-fetch when dependencies change
    useEffect(() => {
        if (autoFetch) {
            fetchData();
        }
    }, [autoFetch, fetchData]);

    return {
        data,
        loading,
        error,
        refetch: fetchData,
        isEmpty,
        hasValidData,
    };
};

// Hook for single test run performance data
export const useSinglePerformanceData = (
    testRunId: number,
    metricTypes?: string[],
    autoFetch: boolean = true
) => {
    const [data, setData] = useState<PerformanceData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        if (!testRunId) {
            setData(null);
            return;
        }

        try {
            setLoading(true);
            setError(null);
            
            const response = await fetchSinglePerformanceData(testRunId, metricTypes);
            const performanceData = Array.isArray(response) ? response : (response.data || []);
            setData(performanceData[0] || null);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch performance data');
            console.error('Error fetching single performance data:', err);
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [testRunId, metricTypes]);

    useEffect(() => {
        if (autoFetch) {
            fetchData();
        }
    }, [autoFetch, fetchData]);

    return {
        data,
        loading,
        error,
        refetch: fetchData,
        hasData: data !== null,
    };
};

// Hook for performance data with filtering and sorting
export const useFilteredPerformanceData = (
    performanceData: PerformanceData[],
    filters: Record<string, any> = {},
    sortBy?: string,
    sortOrder: 'asc' | 'desc' = 'asc'
) => {
    const filteredAndSortedData = useMemo(() => {
        let filtered = [...performanceData];

        // Apply filters
        if (Object.keys(filters).length > 0) {
            filtered = filtered.filter(item => {
                return Object.entries(filters).every(([key, value]) => {
                    if (!value || (Array.isArray(value) && value.length === 0)) {
                        return true;
                    }

                    const itemValue = (item as any)[key];
                    
                    if (Array.isArray(value)) {
                        return value.includes(itemValue);
                    }
                    
                    return itemValue === value;
                });
            });
        }

        // Apply sorting
        if (sortBy) {
            filtered.sort((a, b) => {
                let aValue: any, bValue: any;

                if (sortBy.startsWith('metrics.')) {
                    const metricName = sortBy.replace('metrics.', '');
                    aValue = a.metrics[metricName]?.value || 0;
                    bValue = b.metrics[metricName]?.value || 0;
                } else {
                    aValue = (a as any)[sortBy];
                    bValue = (b as any)[sortBy];
                }

                const comparison = typeof aValue === 'string' 
                    ? aValue.localeCompare(bValue)
                    : aValue - bValue;
                
                return sortOrder === 'asc' ? comparison : -comparison;
            });
        }

        return filtered;
    }, [performanceData, filters, sortBy, sortOrder]);

    const summary = useMemo(() => {
        const totalItems = performanceData.length;
        const filteredItems = filteredAndSortedData.length;
        
        return {
            totalItems,
            filteredItems,
            filteredPercentage: totalItems > 0 ? (filteredItems / totalItems) * 100 : 0,
        };
    }, [performanceData.length, filteredAndSortedData.length]);

    return {
        data: filteredAndSortedData,
        summary,
    };
};

// Hook for performance metrics aggregation
export const usePerformanceMetrics = (performanceData: PerformanceData[]) => {
    const metrics = useMemo(() => {
        if (performanceData.length === 0) return null;

        const aggregatedMetrics: Record<string, {
            values: number[];
            avg: number;
            min: number;
            max: number;
            count: number;
        }> = {};

        // Collect all metric values
        performanceData.forEach(item => {
            Object.entries(item.metrics).forEach(([metricType, metric]) => {
                if (!aggregatedMetrics[metricType]) {
                    aggregatedMetrics[metricType] = {
                        values: [],
                        avg: 0,
                        min: 0,
                        max: 0,
                        count: 0,
                    };
                }
                
                aggregatedMetrics[metricType].values.push(metric.value);
            });
        });

        // Calculate statistics
        Object.keys(aggregatedMetrics).forEach(metricType => {
            const values = aggregatedMetrics[metricType].values;
            const sorted = [...values].sort((a, b) => a - b);
            
            aggregatedMetrics[metricType] = {
                values,
                count: values.length,
                avg: values.reduce((sum, val) => sum + val, 0) / values.length,
                min: sorted[0],
                max: sorted[sorted.length - 1],
            };
        });

        return aggregatedMetrics;
    }, [performanceData]);

    return metrics;
};