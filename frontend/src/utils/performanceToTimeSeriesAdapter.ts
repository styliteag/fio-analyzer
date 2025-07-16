import type { PerformanceData } from '../types';
import type { ActiveFilters } from '../hooks/useTestRunFilters';

/**
 * Converts PerformanceData to TimeSeriesDataPoint format
 * This adapter allows the existing performance data to be used with time series charts
 */
export interface TimeSeriesDataPoint {
    test_run_id: number;
    timestamp: string;
    hostname: string;
    protocol: string;
    drive_model: string;
    block_size: string;
    read_write_pattern: string;
    queue_depth: number;
    metric_type: string;
    value: number;
    unit: string;
}

/**
 * Filters performance data based on active filters
 */
export const filterPerformanceData = (
    performanceData: PerformanceData[],
    filters?: ActiveFilters
): PerformanceData[] => {
    if (!filters) return performanceData;
    
    return performanceData.filter(data => {
        // Apply hostname filter
        if (filters.hostnames.length > 0 && !filters.hostnames.includes(data.hostname || '')) {
            return false;
        }
        
        // Apply protocol filter
        if (filters.protocols.length > 0 && !filters.protocols.includes(data.protocol || '')) {
            return false;
        }
        
        // Apply drive_model filter
        if (filters.drive_models.length > 0 && !filters.drive_models.includes(data.drive_model || '')) {
            return false;
        }
        
        // Apply drive_type filter
        if (filters.drive_types.length > 0 && !filters.drive_types.includes(data.drive_type || '')) {
            return false;
        }
        
        // Apply block_size filter
        if (filters.block_sizes.length > 0 && !filters.block_sizes.includes(String(data.block_size || ''))) {
            return false;
        }
        
        // Apply read_write_pattern filter
        if (filters.patterns.length > 0 && !filters.patterns.includes(data.read_write_pattern || '')) {
            return false;
        }
        
        // Apply queue_depth filter
        if (filters.queue_depths.length > 0 && !filters.queue_depths.includes((data as any).queue_depth || 1)) {
            return false;
        }
        
        return true;
    });
};

/**
 * Converts PerformanceData array to TimeSeriesDataPoint array
 * Each performance data point is expanded into multiple time series points (one per metric)
 */
export const convertPerformanceDataToTimeSeriesData = (
    performanceData: PerformanceData[],
    selectedMetrics: string[] = ['iops', 'avg_latency', 'bandwidth'],
    filters?: ActiveFilters
): TimeSeriesDataPoint[] => {
    const timeSeriesData: TimeSeriesDataPoint[] = [];
    
    // Apply filters first
    const filteredData = filterPerformanceData(performanceData, filters);
    
    filteredData.forEach(perfData => {
        const basePoint = {
            test_run_id: perfData.id,
            timestamp: perfData.timestamp || new Date().toISOString(),
            hostname: perfData.hostname || 'unknown',
            protocol: perfData.protocol || 'unknown',
            drive_model: perfData.drive_model || 'unknown',
            block_size: String(perfData.block_size || 'unknown'),
            read_write_pattern: perfData.read_write_pattern || 'unknown',
            queue_depth: (perfData as any).queue_depth || 1,
        };

        // Extract metrics from the nested structure
        const metrics = (perfData as any).metrics || {};
        
        selectedMetrics.forEach(metricName => {
            let value: number | null = null;
            let unit = '';
            
            // Try to extract metric value from different possible structures
            if (metrics[metricName]) {
                if (typeof metrics[metricName] === 'object' && metrics[metricName].value !== undefined) {
                    value = metrics[metricName].value;
                    unit = metrics[metricName].unit || '';
                } else if (typeof metrics[metricName] === 'number') {
                    value = metrics[metricName];
                }
            } else if (metrics.combined && metrics.combined[metricName]) {
                if (typeof metrics.combined[metricName] === 'object' && metrics.combined[metricName].value !== undefined) {
                    value = metrics.combined[metricName].value;
                    unit = metrics.combined[metricName].unit || '';
                } else if (typeof metrics.combined[metricName] === 'number') {
                    value = metrics.combined[metricName];
                }
            }
            
            // Set default units if not provided
            if (!unit) {
                switch (metricName) {
                    case 'iops':
                        unit = 'ops/s';
                        break;
                    case 'avg_latency':
                    case 'p95_latency':
                    case 'p99_latency':
                        unit = 'ms';
                        break;
                    case 'bandwidth':
                        unit = 'MB/s';
                        break;
                    default:
                        unit = '';
                }
            }
            
            // Only add data point if we have a valid value
            if (value !== null && value !== undefined && !isNaN(value)) {
                timeSeriesData.push({
                    ...basePoint,
                    metric_type: metricName,
                    value: value,
                    unit: unit,
                });
            }
        });
    });
    
    return timeSeriesData;
};

/**
 * Groups time series data by configuration for better chart organization
 */
export const groupTimeSeriesDataByConfig = (
    timeSeriesData: TimeSeriesDataPoint[]
): Record<string, TimeSeriesDataPoint[]> => {
    const grouped: Record<string, TimeSeriesDataPoint[]> = {};
    
    timeSeriesData.forEach(point => {
        const configKey = `${point.hostname}-${point.protocol}-${point.drive_model}-${point.block_size}-${point.read_write_pattern}-${point.queue_depth}`;
        
        if (!grouped[configKey]) {
            grouped[configKey] = [];
        }
        
        grouped[configKey].push(point);
    });
    
    return grouped;
};

/**
 * Converts grouped time series data to chart.js dataset format
 */
export const convertToChartDatasets = (
    groupedData: Record<string, TimeSeriesDataPoint[]>,
    enabledMetrics: { [key: string]: boolean }
) => {
    const datasets: any[] = [];
    const colors = [
        '#3b82f6', '#10b981', '#f59e0b', '#ef4444', 
        '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'
    ];
    let colorIndex = 0;

    Object.entries(groupedData).forEach(([configKey, dataPoints]) => {
        const configParts = configKey.split('-');
        const hostname = configParts[0];
        const protocol = configParts[1];
        const driveModel = configParts[2];
        const blockSize = configParts[3];
        const pattern = configParts[4];
        const queueDepth = configParts[5];
        
        // Group by metric type
        const metricGroups: Record<string, TimeSeriesDataPoint[]> = {};
        dataPoints.forEach(point => {
            if (enabledMetrics[point.metric_type]) {
                if (!metricGroups[point.metric_type]) {
                    metricGroups[point.metric_type] = [];
                }
                metricGroups[point.metric_type].push(point);
            }
        });

        // Create dataset for each metric
        Object.entries(metricGroups).forEach(([metricType, points]) => {
            const color = colors[colorIndex % colors.length];
            colorIndex++;

            datasets.push({
                label: `${hostname} (${protocol}) ${driveModel} - ${blockSize} ${pattern} Q${queueDepth} - ${metricType}`,
                data: points.map(point => ({
                    x: point.timestamp,
                    y: point.value
                })),
                borderColor: color,
                backgroundColor: color + '20',
                borderWidth: 2,
                fill: false,
                tension: 0.1,
                pointRadius: 3,
                pointHoverRadius: 6,
            });
        });
    });

    return datasets;
};