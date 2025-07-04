// Data transformation utilities for charts and UI
import type { PerformanceData, TestRun, PerformanceMetric } from '../../types';

export interface ChartDataPoint {
    x: string | number;
    y: number;
    label?: string;
    metadata?: Record<string, any>;
}

export interface SeriesData {
    label: string;
    data: ChartDataPoint[];
    color?: string;
    backgroundColor?: string;
}

// Transform performance data for chart consumption
export const transformPerformanceDataForChart = (
    data: PerformanceData[],
    xAxis: string = 'test_name',
    yMetric: string = 'iops',
    groupBy?: string,
): SeriesData[] => {
    if (!data || data.length === 0) return [];

    const groupedData = new Map<string, ChartDataPoint[]>();

    data.forEach((item) => {
        const metricValue = getMetricValue(item.metrics, yMetric);
        if (metricValue === null) return;

        const xValue = getPropertyValue(item, xAxis);
        const groupKey = groupBy ? getPropertyValue(item, groupBy) : 'Default';

        if (!groupedData.has(groupKey)) {
            groupedData.set(groupKey, []);
        }

        groupedData.get(groupKey)?.push({
            x: xValue,
            y: metricValue,
            label: item.test_name,
            metadata: {
                id: item.id,
                drive_model: item.drive_model,
                drive_type: item.drive_type,
                hostname: item.hostname,
                protocol: item.protocol,
            },
        });
    });

    return Array.from(groupedData.entries()).map(([label, points]) => ({
        label,
        data: points,
    }));
};

// Get metric value from performance data
export const getMetricValue = (
    metrics: Record<string, PerformanceMetric>,
    metricType: string,
): number | null => {
    const metric = metrics[metricType];
    return metric ? metric.value : null;
};

// Get property value with nested support
export const getPropertyValue = (obj: any, path: string): any => {
    return path.split('.').reduce((current, key) => current?.[key], obj) ?? '';
};

// Transform data for block size analysis
export const transformBlockSizeData = (
    data: PerformanceData[],
    metricType: string = 'iops',
): SeriesData[] => {
    const driveGroups = new Map<string, Map<string | number, number>>();

    data.forEach((item) => {
        const metricValue = getMetricValue(item.metrics, metricType);
        if (metricValue === null) return;

        const driveKey = item.drive_model;
        const blockSize = item.block_size;

        if (!driveGroups.has(driveKey)) {
            driveGroups.set(driveKey, new Map());
        }

        driveGroups.get(driveKey)?.set(blockSize, metricValue);
    });

    return Array.from(driveGroups.entries()).map(([driveModel, blockSizeMap]) => ({
        label: driveModel,
        data: Array.from(blockSizeMap.entries()).map(([blockSize, value]) => ({
            x: blockSize,
            y: value,
            label: `${driveModel} - ${blockSize}`,
        })),
    }));
};

// Transform data for time series visualization
export const transformTimeSeriesData = (
    data: PerformanceData[],
    metricType: string = 'iops',
): SeriesData[] => {
    const sorted = [...data].sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return [{
        label: `${metricType.toUpperCase()} over time`,
        data: sorted.map((item) => ({
            x: new Date(item.timestamp).getTime(),
            y: getMetricValue(item.metrics, metricType) || 0,
            label: item.test_name,
            metadata: {
                timestamp: item.timestamp,
                drive_model: item.drive_model,
                hostname: item.hostname,
            },
        })),
    }];
};

// Calculate summary statistics
export const calculateSummaryStats = (values: number[]) => {
    if (values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((acc, val) => acc + val, 0);

    return {
        count: values.length,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        mean: sum / values.length,
        median: sorted[Math.floor(sorted.length / 2)],
        p95: sorted[Math.floor(sorted.length * 0.95)],
        p99: sorted[Math.floor(sorted.length * 0.99)],
    };
};

// Group test runs by criteria
export const groupTestRuns = (
    testRuns: TestRun[],
    groupBy: string,
): Map<string, TestRun[]> => {
    const groups = new Map<string, TestRun[]>();

    testRuns.forEach((run) => {
        const groupKey = getPropertyValue(run, groupBy) || 'Unknown';
        
        if (!groups.has(groupKey)) {
            groups.set(groupKey, []);
        }
        
        groups.get(groupKey)?.push(run);
    });

    return groups;
};

// Filter test runs by criteria
export const filterTestRuns = (
    testRuns: TestRun[],
    filters: Record<string, any>,
): TestRun[] => {
    return testRuns.filter((run) => {
        return Object.entries(filters).every(([key, value]) => {
            if (!value || (Array.isArray(value) && value.length === 0)) {
                return true; // Empty filter means include all
            }

            const runValue = getPropertyValue(run, key);
            
            if (Array.isArray(value)) {
                return value.includes(runValue);
            }
            
            return runValue === value;
        });
    });
};

// Sort functions for different data types
export const sortBlockSizes = (sizes: (string | number)[]): (string | number)[] => {
    return sizes.sort((a, b) => {
        const aNum = parseBlockSizeToBytes(a);
        const bNum = parseBlockSizeToBytes(b);
        return aNum - bNum;
    });
};

// Convert block size to bytes for sorting
const parseBlockSizeToBytes = (size: string | number): number => {
    if (typeof size === 'number') return size;
    
    const sizeStr = size.toString().toUpperCase();
    const num = parseInt(sizeStr);
    
    if (sizeStr.includes('M')) {
        return num * 1024 * 1024;
    } else if (sizeStr.includes('K')) {
        return num * 1024;
    }
    
    return num;
};