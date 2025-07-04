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
    } = options;
    
    const params = new URLSearchParams();
    
    if (hostname) params.append("hostname", hostname);
    if (protocol) params.append("protocol", protocol);
    if (driveModel) params.append("drive_model", driveModel);
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