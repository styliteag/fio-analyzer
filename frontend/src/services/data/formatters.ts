// Data formatting utilities for display and export
import type { PerformanceData } from '../../types';

// Format numbers with appropriate units and precision
export const formatMetricValue = (
    value: number,
    metricType: string,
    precision: number = 2
): string => {
    switch (metricType) {
        case 'iops':
            return formatIOPS(value);
        case 'avg_latency':
        case 'p95_latency':
        case 'p99_latency':
            return formatLatency(value, precision);
        case 'bandwidth':
            return formatBandwidth(value, precision);
        default:
            return formatNumber(value, precision);
    }
};

// Format IOPS with appropriate scaling
export const formatIOPS = (value: number): string => {
    if (value >= 1000000) {
        return `${(value / 1000000).toFixed(1)}M IOPS`;
    } else if (value >= 1000) {
        return `${(value / 1000).toFixed(1)}K IOPS`;
    }
    return `${Math.round(value)} IOPS`;
};

// Format latency values
export const formatLatency = (value: number, precision: number = 2): string => {
    if (value >= 1000) {
        return `${(value / 1000).toFixed(precision)}s`;
    }
    return `${value.toFixed(precision)}ms`;
};

// Format bandwidth values
export const formatBandwidth = (value: number, precision: number = 2): string => {
    const units = ['B/s', 'KB/s', 'MB/s', 'GB/s', 'TB/s'];
    let unitIndex = 0;
    let scaledValue = value;

    while (scaledValue >= 1024 && unitIndex < units.length - 1) {
        scaledValue /= 1024;
        unitIndex++;
    }

    return `${scaledValue.toFixed(precision)} ${units[unitIndex]}`;
};

// Format generic numbers
export const formatNumber = (value: number, precision: number = 2): string => {
    if (value >= 1e9) {
        return `${(value / 1e9).toFixed(precision)}B`;
    } else if (value >= 1e6) {
        return `${(value / 1e6).toFixed(precision)}M`;
    } else if (value >= 1e3) {
        return `${(value / 1e3).toFixed(precision)}K`;
    }
    return value.toFixed(precision);
};

// Format block sizes consistently
export const formatBlockSize = (blockSize: string | number): string => {
    if (typeof blockSize === 'number') {
        return formatBytes(blockSize);
    }
    
    const sizeStr = blockSize.toString().toUpperCase();
    
    // Already formatted
    if (sizeStr.includes('K') || sizeStr.includes('M') || sizeStr.includes('G')) {
        return sizeStr;
    }
    
    // Convert raw bytes
    const bytes = parseInt(sizeStr);
    return formatBytes(bytes);
};

// Format bytes to human readable
export const formatBytes = (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let unitIndex = 0;
    let scaledBytes = bytes;

    while (scaledBytes >= 1024 && unitIndex < units.length - 1) {
        scaledBytes /= 1024;
        unitIndex++;
    }

    // Use integer display for clean sizes
    if (scaledBytes === Math.floor(scaledBytes)) {
        return `${scaledBytes}${units[unitIndex]}`;
    }

    return `${scaledBytes.toFixed(1)}${units[unitIndex]}`;
};

// Format timestamps
export const formatTimestamp = (
    timestamp: string | number | Date,
    format: 'short' | 'long' | 'time' | 'date' = 'short'
): string => {
    const date = new Date(timestamp);
    
    if (isNaN(date.getTime())) {
        return 'Invalid Date';
    }

    switch (format) {
        case 'short':
            const formattedDate = date.toISOString().split('T')[0]; // YYYY-MM-DD
            const formattedTime = date.toTimeString().split(' ')[0]; // HH:MM:SS
            return `${formattedDate} ${formattedTime}`;
        case 'long':
            const longDate = date.toISOString().split('T')[0]; // YYYY-MM-DD
            const longTime = date.toTimeString().split(' ')[0]; // HH:MM:SS
            return `${longDate} ${longTime}`;
        case 'time':
            return date.toTimeString().split(' ')[0]; // HH:MM:SS
        case 'date':
            return date.toISOString().split('T')[0]; // YYYY-MM-DD
        default:
            return date.toISOString();
    }
};

// Format duration in seconds to human readable
export const formatDuration = (seconds: number): string => {
    if (seconds < 60) {
        return `${seconds}s`;
    } else if (seconds < 3600) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return remainingSeconds > 0 
            ? `${minutes}m ${remainingSeconds}s`
            : `${minutes}m`;
    } else {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return minutes > 0 
            ? `${hours}h ${minutes}m`
            : `${hours}h`;
    }
};

// Format percentage values
export const formatPercentage = (value: number, precision: number = 1): string => {
    return `${value.toFixed(precision)}%`;
};

// Format test run display name
export const formatTestRunName = (testRun: PerformanceData): string => {
    const parts = [
        testRun.hostname,
        testRun.drive_model,
        testRun.block_size,
        testRun.read_write_pattern
    ].filter(Boolean);
    
    return parts.join(' - ');
};

// Format metric labels for charts
export const formatMetricLabel = (metricType: string): string => {
    const labels: Record<string, string> = {
        'iops': 'IOPS',
        'avg_latency': 'Average Latency (ms)',
        'bandwidth': 'Bandwidth (MB/s)',
        'p95_latency': '95th Percentile Latency (ms)',
        'p99_latency': '99th Percentile Latency (ms)'
    };
    
    return labels[metricType] || metricType.toUpperCase();
};

// Format axis labels for charts
export const formatAxisLabel = (field: string): string => {
    const labels: Record<string, string> = {
        'test_name': 'Test Name',
        'drive_model': 'Drive Model',
        'drive_type': 'Drive Type',
        'hostname': 'Hostname',
        'protocol': 'Protocol',
        'block_size': 'Block Size',
        'pattern': 'Pattern',
        'timestamp': 'Time'
    };
    
    return labels[field] || field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

// Format CSV export data
export const formatCSVData = (data: PerformanceData[]): string => {
    if (data.length === 0) return '';

    // Get headers
    const headers = [
        'id', 'test_name', 'hostname', 'drive_model', 'drive_type',
        'protocol', 'block_size', 'pattern', 'timestamp'
    ];

    // Get all unique metric types
    const metricTypes = new Set<string>();
    data.forEach(item => {
        Object.keys(item.metrics).forEach(metric => metricTypes.add(metric));
    });

    // Add metric headers
    metricTypes.forEach(metric => {
        headers.push(`${metric}_value`, `${metric}_unit`);
    });

    // Create CSV content
    const csvContent = [
        headers.join(','),
        ...data.map(item => {
            const baseValues = [
                item.id,
                `"${item.test_name}"`,
                `"${item.hostname}"`,
                `"${item.drive_model}"`,
                `"${item.drive_type}"`,
                `"${item.protocol}"`,
                item.block_size,
                `"${item.read_write_pattern}"`,
                `"${formatTimestamp(item.timestamp, 'long')}"`
            ];

            const metricValues: string[] = [];
            metricTypes.forEach(metric => {
                const metricData = item.metrics[metric];
                if (metricData) {
                    metricValues.push(metricData.value.toString(), `"${metricData.unit}"`);
                } else {
                    metricValues.push('', '');
                }
            });

            return [...baseValues, ...metricValues].join(',');
        })
    ];

    return csvContent.join('\n');
};

// Format summary statistics
export const formatSummaryStats = (stats: {
    count: number;
    min: number;
    max: number;
    mean: number;
    median: number;
    p95: number;
    p99: number;
}) => {
    return {
        count: stats.count.toString(),
        min: formatNumber(stats.min),
        max: formatNumber(stats.max),
        mean: formatNumber(stats.mean),
        median: formatNumber(stats.median),
        p95: formatNumber(stats.p95),
        p99: formatNumber(stats.p99)
    };
};

// Format error messages for user display
export const formatErrorMessage = (error: any): string => {
    if (typeof error === 'string') {
        return error;
    }
    
    if (error?.message) {
        return error.message;
    }
    
    if (error?.data?.message) {
        return error.data.message;
    }
    
    return 'An unexpected error occurred';
};

// Format loading states
export const formatLoadingMessage = (operation: string): string => {
    return `Loading ${operation}...`;
};

// Format empty state messages
export const formatEmptyMessage = (context: string): string => {
    const messages: Record<string, string> = {
        'test_runs': 'No test runs available',
        'performance_data': 'No performance data found',
        'time_series': 'No time series data available',
        'servers': 'No servers found',
        'filters': 'No filter options available'
    };
    
    return messages[context] || `No ${context} available`;
};