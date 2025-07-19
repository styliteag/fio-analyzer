// Time series API service
import type { ServerInfo, TimeSeriesDataPoint, TrendDataPoint } from '../../types';
import { apiCall } from './base';

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

// Helper to get common time range options
export const getTimeRangeOptions = () => [
    { label: "Last 24 hours", hours: 24 },
    { label: "Last 3 days", days: 3 },
    { label: "Last 7 days", days: 7 },
    { label: "Last 30 days", days: 30 },
    { label: "Last 90 days", days: 90 },
];

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
    const params = new URLSearchParams();
    
    if (filters?.hostnames && filters.hostnames.length > 0) {
        params.append("hostnames", filters.hostnames.join(","));
    }
    if (filters?.protocols && filters.protocols.length > 0) {
        params.append("protocols", filters.protocols.join(","));
    }
    if (filters?.drive_types && filters.drive_types.length > 0) {
        params.append("drive_types", filters.drive_types.join(","));
    }
    if (filters?.drive_models && filters.drive_models.length > 0) {
        params.append("drive_models", filters.drive_models.join(","));
    }
    if (filters?.patterns && filters.patterns.length > 0) {
        params.append("patterns", filters.patterns.join(","));
    }
    if (filters?.block_sizes && filters.block_sizes.length > 0) {
        params.append("block_sizes", filters.block_sizes.map(b => String(b)).join(","));
    }
    if (filters?.syncs && filters.syncs.length > 0) {
        params.append("syncs", filters.syncs.join(","));
    }
    if (filters?.queue_depths && filters.queue_depths.length > 0) {
        params.append("queue_depths", filters.queue_depths.join(","));
    }
    if (filters?.directs && filters.directs.length > 0) {
        params.append("directs", filters.directs.join(","));
    }
    if (filters?.num_jobs && filters.num_jobs.length > 0) {
        params.append("num_jobs", filters.num_jobs.join(","));
    }
    if (filters?.test_sizes && filters.test_sizes.length > 0) {
        params.append("test_sizes", filters.test_sizes.join(","));
    }
    if (filters?.durations && filters.durations.length > 0) {
        params.append("durations", filters.durations.join(","));
    }

    const queryString = params.toString();
    const url = `/api/time-series/all${queryString ? `?${queryString}` : ''}`;
    return apiCall<TimeSeriesDataPoint[]>(url);
};