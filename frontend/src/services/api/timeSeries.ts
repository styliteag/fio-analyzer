// Time series API service
import type { ServerInfo, TimeSeriesDataPoint, TrendDataPoint } from '../../types';
import { apiCall, buildFilterParams } from './base';
import { TIME_RANGES } from '../config/constants';

export interface TimeSeriesHistoryOptions {
    hostname?: string;
    protocol?: string;
    days?: number;
    hours?: number;
    metricType?: string;
    startDate?: string;
    endDate?: string;
    driveModel?: string;
    driveType?: string;
    blockSize?: string;
    readWritePattern?: string;
    queueDepth?: number;
    testSize?: string;
    sync?: number;
    direct?: number;
    numJobs?: number;
    duration?: number;
}

export interface TimeSeriesTrendsOptions {
    hostname: string;
    protocol: string;
    driveModel: string;
    metricType: string;
    days?: number;
    hours?: number;
}

// Fetch list of servers with test statistics
export const fetchTimeSeriesServers = async () => {
    return apiCall<ServerInfo[]>("/api/time-series/servers");
};

// Fetch latest test results per server
export const fetchTimeSeriesLatest = async () => {
    return apiCall<TimeSeriesDataPoint[]>("/api/time-series/latest");
};

// Fetch historical test data with filtering
export const fetchTimeSeriesHistory = async (options: TimeSeriesHistoryOptions = {}) => {
    const { 
        hostname, 
        protocol, 
        days, 
        hours, 
        metricType,
        startDate,
        endDate,
        driveModel,
        driveType,
        blockSize,
        readWritePattern,
        queueDepth,
        testSize,
        sync,
        direct,
        numJobs,
        duration,
    } = options;
    
    const params = new URLSearchParams();
    
    if (hostname) params.append("hostname", hostname);
    if (protocol) params.append("protocol", protocol);
    if (driveModel) params.append("drive_model", driveModel);
    if (driveType) params.append("drive_type", driveType);
    if (blockSize) params.append("block_size", blockSize);
    if (readWritePattern) params.append("read_write_pattern", readWritePattern);
    if (queueDepth !== undefined) params.append("queue_depth", queueDepth.toString());
    if (testSize) params.append("test_size", testSize);
    if (sync !== undefined) params.append("sync", sync.toString());
    if (direct !== undefined) params.append("direct", direct.toString());
    if (numJobs !== undefined) params.append("num_jobs", numJobs.toString());
    if (duration !== undefined) params.append("duration", duration.toString());
    if (startDate) params.append("start_date", startDate);
    if (endDate) params.append("end_date", endDate);
    if (metricType) params.append("metric_type", metricType);
    if (days) params.append("days", days.toString());
    if (hours) params.append("hours", hours.toString());

    return apiCall<TimeSeriesDataPoint[]>(`/api/time-series/history?${params}`);
};

// Fetch trend analysis with moving averages
export const fetchTimeSeriesTrends = async (options: TimeSeriesTrendsOptions) => {
    const { 
        hostname, 
        protocol, 
        driveModel,
        metricType, 
        days, 
        hours,
    } = options;
    
    const params = new URLSearchParams({
        hostname,
        protocol,
        drive_model: driveModel,
        metric_type: metricType,
    });
    
    if (days) params.append("days", days.toString());
    if (hours) params.append("hours", hours.toString());

    return apiCall<TrendDataPoint[]>(`/api/time-series/trends?${params}`);
};

// Bulk update time-series test runs
export const bulkUpdateTimeSeries = async (testRunIds: number[], updates: Record<string, any>) => {
    return apiCall<{ message: string; updated: number; failed: number }>("/api/time-series/bulk", {
        method: "PUT",
        body: JSON.stringify({ testRunIds, updates }),
    });
};

// Bulk delete time-series test runs from history
export const deleteTimeSeriesRuns = async (testRunIds: number[]) => {
    return apiCall<{ deleted: number; notFound: number }>("/api/time-series/delete", {
        method: "DELETE",
        body: JSON.stringify({ testRunIds }),
        headers: { "Content-Type": "application/json" },
    });
};

// Helper to get common time range options (uses constants for consistency)
export const getTimeRangeOptions = () => TIME_RANGES.filter(range => range.value !== 'custom');

// Helper to get available metric types for time series
export const getTimeSeriesMetricTypes = () => [
    { value: "iops", label: "IOPS" },
    { value: "avg_latency", label: "Average Latency" },
    { value: "bandwidth", label: "Bandwidth" },
    { value: "p95_latency", label: "95th Percentile Latency" },
    { value: "p99_latency", label: "99th Percentile Latency" },
];

// Fetch all time-series data with comprehensive filtering
export const fetchTimeSeriesAll = async (filters?: {
    hostnames?: string[];
    protocols?: string[];
    drive_types?: string[];
    drive_models?: string[];
    patterns?: string[];
    block_sizes?: (string|number)[];
    syncs?: number[];
    queue_depths?: number[];
    directs?: number[];
    num_jobs?: number[];
    test_sizes?: string[];
    durations?: number[];
}) => {
    // Build query parameters using shared utility
    const params = buildFilterParams(filters || {});
    const queryString = params.toString();
    const url = `/api/time-series/all${queryString ? `?${queryString}` : ''}`;
    return apiCall<TimeSeriesDataPoint[]>(url);
};