// Performance data API service
import type { PerformanceData } from '../../types';
import { apiCall } from './base';

export interface PerformanceDataOptions {
    testRunIds: number[];
    metricTypes?: string[];
}

// Fetch performance data for multiple test runs
export const fetchPerformanceData = async (options: PerformanceDataOptions) => {
    const { testRunIds, metricTypes } = options;
    
    const params = new URLSearchParams({
        test_run_ids: testRunIds.join(","),
    });

    if (metricTypes && metricTypes.length > 0) {
        params.append("metric_types", metricTypes.join(","));
    }

    return apiCall<PerformanceData[]>(`/api/test-runs/performance-data?${params}`);
};

// Fetch performance data for a single test run
export const fetchSinglePerformanceData = async (
    testRunId: number,
    metricTypes?: string[],
) => {
    return fetchPerformanceData({
        testRunIds: [testRunId],
        metricTypes,
    });
};

// Get default metrics for performance analysis
export const getDefaultMetrics = (): string[] => [
    "iops",
    "avg_latency", 
    "bandwidth",
];

// Validate metric types
export const isValidMetricType = (metric: string): boolean => {
    const validMetrics = ["iops", "avg_latency", "bandwidth", "p95_latency", "p99_latency"];
    return validMetrics.includes(metric);
};

// Filter valid metrics from an array
export const filterValidMetrics = (metrics: string[]): string[] => {
    return metrics.filter(isValidMetricType);
};