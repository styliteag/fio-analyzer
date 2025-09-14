// Chart data processing utilities - OPTIMIZED VERSION
import type { ChartTemplate, PerformanceData, RadarGridData, RadarPoolData, RadarMetrics } from '../../types';
import { sortBlockSizes } from '../../utils/sorting';
import { formatBlockSize } from '../../services/data/formatters';
import type { GroupOption } from './ChartControls';
import { chartConfig } from '../../services/config';
import { 
  applySortingAndGrouping as applySortingAndGroupingUtil, 
  formatGroupKey,
  type SortingOptions 
} from '../../utils/chartSorting';
import { 
  createMemoizer, 
  groupByMap, 
  measurePerformance 
} from '../../utils/performanceOptimizations';

export interface ProcessorOptions extends SortingOptions {}

export interface ChartDataset {
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
    yAxisID?: string;
    type?: string;
    originalData?: PerformanceData[];
}

export interface ChartData {
    labels: string[];
    datasets: ChartDataset[];
}

// Get metric value with fallback handling
export const getMetricValue = (
    metrics: any,
    metricName: string,
    operation?: string,
): number => {
    // Handle flat structure (e.g., metrics.iops.value)
    if (metrics[metricName] && typeof metrics[metricName] === 'object') {
        if (operation && metrics[metricName][operation] !== undefined) {
            return metrics[metricName][operation].value || 0;
        }
        return metrics[metricName].value || 0;
    }
    
    // Handle direct value (e.g., metrics.iops = 1000)
    if (typeof metrics[metricName] === 'number') {
        return metrics[metricName];
    }
    
    return 0;
};

// Use the utility function for sorting and grouping
export const applySortingAndGrouping = applySortingAndGroupingUtil;

// Enhanced color assignment for better grouping visualization
const getColorsForGrouping = (groupCount: number, metricCount: number = 3): string[] => {
    const colors = chartConfig.colors.primary;
    const qualitativeColors = chartConfig.colors.schemes.qualitative;
    
    // Use qualitative colors for better distinction between groups
    const groupColors = qualitativeColors.slice(0, groupCount);
    
    // For each group, assign colors for different metrics
    const result: string[] = [];
    groupColors.forEach((groupColor, groupIndex) => {
        // Use different shades for different metrics within the same group
        const metricColors = [
            groupColor, // Primary color for first metric
            colors[(groupIndex * 2 + 1) % colors.length], // Different color for second metric
            colors[(groupIndex * 2 + 2) % colors.length], // Different color for third metric
        ];
        
        result.push(...metricColors.slice(0, metricCount));
    });
    
    return result;
};

// OPTIMIZED: Process data for performance overview template
export const processPerformanceOverview = (
    data: PerformanceData[],
    colors: string[],
    options: ProcessorOptions,
): ChartData => {
    const sortedData = applySortingAndGrouping(data, options);
    const { groupBy } = options;
    
    // If no grouping, use single-pass processing
    if (groupBy === "none") {
        // Single-pass processing for labels and all metrics
        const labels: string[] = [];
        const iopsData: number[] = [];
        const latencyData: number[] = [];
        const bandwidthData: number[] = [];
        
        for (const item of sortedData) {
            labels.push(`${item.drive_model} - ${formatBlockSize(item.block_size)} - ${item.read_write_pattern}`);
            iopsData.push(getMetricValue(item.metrics, "iops"));
            latencyData.push(getMetricValue(item.metrics, "avg_latency"));
            bandwidthData.push(getMetricValue(item.metrics, "bandwidth"));
        }

        const datasets = [
            {
                label: "IOPS",
                data: iopsData,
                backgroundColor: colors[0],
                borderColor: colors[0],
                borderWidth: 1,
                yAxisID: "y",
                originalData: sortedData,
            },
            {
                label: "Avg Latency (ms)",
                data: latencyData,
                backgroundColor: colors[1],
                borderColor: colors[1],
                borderWidth: 1,
                yAxisID: "y1",
                originalData: sortedData,
            },
            {
                label: "Bandwidth (MB/s)",
                data: bandwidthData,
                backgroundColor: colors[2],
                borderColor: colors[2],
                borderWidth: 1,
                yAxisID: "y2",
                originalData: sortedData,
            },
        ];

        return { labels, datasets };
    }

    // OPTIMIZED: Group data by the specified field with Map-based processing
    const groups = new Map<string, PerformanceData[]>();
    const labelToItemMap = new Map<string, PerformanceData>();
    const allLabels = new Set<string>();
    
    // Helper function to create consistent labels for grouping
    const createItemLabel = (item: PerformanceData): string => {
        let labelParts = [item.drive_model, formatBlockSize(item.block_size), item.read_write_pattern];
        
        // Add the groupBy field to ensure X-axis separation when grouping
        const excludedFromLabel: GroupOption[] = ["none", "drive", "test", "blocksize"];
        if (!excludedFromLabel.includes(groupBy)) {
            // Add grouping field value for fields not already in the base label
            labelParts.push(formatGroupKey(groupBy, item));
        }
        
        return labelParts.join(' - ');
    };
    
    // Single-pass grouping and label collection
    sortedData.forEach((item) => {
        const groupKey = formatGroupKey(groupBy, item);
        const itemLabel = createItemLabel(item);

        // Group by field
        if (!groups.has(groupKey)) {
            groups.set(groupKey, []);
        }
        groups.get(groupKey)!.push(item);
        
        // Collect unique labels and create label-to-item mapping
        allLabels.add(itemLabel);
        labelToItemMap.set(`${groupKey}:${itemLabel}`, item);
    });

    const labels = Array.from(allLabels);
    const datasets: ChartDataset[] = [];
    const groupColors = getColorsForGrouping(groups.size, 3);
    let colorIndex = 0;

    // OPTIMIZED: Create datasets for each group and metric with Map lookups
    Array.from(groups.entries()).forEach(([groupName]) => {
        const groupColor = groupColors[colorIndex];
        
        // Pre-allocate arrays
        const iopsData = new Array<number>(labels.length);
        const latencyData = new Array<number>(labels.length);
        const bandwidthData = new Array<number>(labels.length);
        const iopsOriginal = new Array<PerformanceData>(labels.length);
        const latencyOriginal = new Array<PerformanceData>(labels.length);
        const bandwidthOriginal = new Array<PerformanceData>(labels.length);
        
        // Single-pass processing for all metrics using Map lookup O(1)
        for (let i = 0; i < labels.length; i++) {
            const label = labels[i];
            const item = labelToItemMap.get(`${groupName}:${label}`);
            
            if (item) {
                iopsData[i] = getMetricValue(item.metrics, "iops");
                latencyData[i] = getMetricValue(item.metrics, "avg_latency");
                bandwidthData[i] = getMetricValue(item.metrics, "bandwidth");
                iopsOriginal[i] = item;
                latencyOriginal[i] = item;
                bandwidthOriginal[i] = item;
            } else {
                iopsData[i] = 0;
                latencyData[i] = 0;
                bandwidthData[i] = 0;
                iopsOriginal[i] = null as any;
                latencyOriginal[i] = null as any;
                bandwidthOriginal[i] = null as any;
            }
        }

        // Create datasets
        datasets.push(
            {
                label: `${groupName} - IOPS`,
                data: iopsData,
                backgroundColor: groupColor,
                borderColor: groupColor,
                borderWidth: 1,
                yAxisID: "y",
                originalData: iopsOriginal as unknown as PerformanceData[],
            },
            {
                label: `${groupName} - Avg Latency (ms)`,
                data: latencyData,
                backgroundColor: groupColors[colorIndex + 1],
                borderColor: groupColors[colorIndex + 1],
                borderWidth: 1,
                yAxisID: "y1",
                originalData: latencyOriginal as unknown as PerformanceData[],
            },
            {
                label: `${groupName} - Bandwidth (MB/s)`,
                data: bandwidthData,
                backgroundColor: groupColors[colorIndex + 2],
                borderColor: groupColors[colorIndex + 2],
                borderWidth: 1,
                yAxisID: "y2",
                originalData: bandwidthOriginal as unknown as PerformanceData[],
            }
        );

        colorIndex += 3; // Move to next set of colors for the next group
    });

    return { labels, datasets };
};

// OPTIMIZED: Process data for block size impact template
export const processBlockSizeImpact = (
    data: PerformanceData[],
    colors: string[],
    options: ProcessorOptions,
): ChartData => {
    const sortedData = applySortingAndGrouping(data, options);
    
    // Single-pass grouping by drive model and collecting block sizes
    const groupedData = new Map<string, PerformanceData[]>();
    const blockSizeSet = new Set<string>();
    
    sortedData.forEach((item) => {
        const key = item.drive_model;
        const blockSize = item.block_size.toString();
        
        // Group by drive model
        if (!groupedData.has(key)) {
            groupedData.set(key, []);
        }
        groupedData.get(key)!.push(item);
        
        // Collect unique block sizes
        blockSizeSet.add(blockSize);
    });

    const sortedBlockSizes = sortBlockSizes(Array.from(blockSizeSet));
    const datasets: ChartDataset[] = [];
    let colorIndex = 0;

    // OPTIMIZED: Process each drive model with pre-allocated arrays
    groupedData.forEach((items, driveModel) => {
        const iopsByBlockSize = new Map<string, number>();
        const bandwidthByBlockSize = new Map<string, number>();

        // Single-pass metric extraction
        for (const item of items) {
            const blockSize = item.block_size.toString();
            iopsByBlockSize.set(blockSize, getMetricValue(item.metrics, "iops"));
            bandwidthByBlockSize.set(blockSize, getMetricValue(item.metrics, "bandwidth"));
        }

        // Pre-allocate arrays for better performance
        const iopsData = new Array<number>(sortedBlockSizes.length);
        const bandwidthData = new Array<number>(sortedBlockSizes.length);
        
        for (let i = 0; i < sortedBlockSizes.length; i++) {
            const size = sortedBlockSizes[i].toString();
            iopsData[i] = iopsByBlockSize.get(size) || 0;
            bandwidthData[i] = bandwidthByBlockSize.get(size) || 0;
        }

        // Create datasets in batch
        datasets.push(
            {
                label: `${driveModel} - IOPS`,
                data: iopsData,
                backgroundColor: colors[colorIndex % colors.length],
                borderColor: colors[colorIndex % colors.length],
                borderWidth: 2,
                yAxisID: "y",
                originalData: items,
            },
            {
                label: `${driveModel} - Bandwidth`,
                data: bandwidthData,
                backgroundColor: colors[(colorIndex + 1) % colors.length],
                borderColor: colors[(colorIndex + 1) % colors.length],
                borderWidth: 2,
                yAxisID: "y1",
                originalData: items,
            }
        );

        colorIndex += 2;
    });

    return {
        labels: sortedBlockSizes.map(size => size.toString()),
        datasets,
    };
};

// OPTIMIZED: Process data for read/write comparison template
export const processReadWriteComparison = (
    data: PerformanceData[],
    colors: string[],
    options: ProcessorOptions,
): ChartData => {
    const sortedData = applySortingAndGrouping(data, options);
    
    // Single-pass filtering and Map creation
    const readDataMap = new Map<string, PerformanceData>();
    const writeDataMap = new Map<string, PerformanceData>();
    const readData: PerformanceData[] = [];
    const writeData: PerformanceData[] = [];
    const configSet = new Set<string>();
    
    for (const item of sortedData) {
        const pattern = item.read_write_pattern.toLowerCase();
        const configKey = `${item.drive_model} - ${item.block_size}`;
        
        configSet.add(configKey);
        
        if (pattern.includes('read') && !pattern.includes('write')) {
            readData.push(item);
            readDataMap.set(configKey, item);
        } else if (pattern.includes('write') && !pattern.includes('read')) {
            writeData.push(item);
            writeDataMap.set(configKey, item);
        }
    }

    const labels = Array.from(configSet);
    
    // Pre-allocate arrays and use Map lookup O(1)
    const readIOPS = new Array<number>(labels.length);
    const writeIOPS = new Array<number>(labels.length);
    
    for (let i = 0; i < labels.length; i++) {
        const label = labels[i];
        const readItem = readDataMap.get(label);
        const writeItem = writeDataMap.get(label);
        
        readIOPS[i] = readItem ? getMetricValue(readItem.metrics, "iops") : 0;
        writeIOPS[i] = writeItem ? getMetricValue(writeItem.metrics, "iops") : 0;
    }

    return {
        labels,
        datasets: [
            {
                label: "Read IOPS",
                data: readIOPS,
                backgroundColor: colors[0],
                borderColor: colors[0],
                borderWidth: 1,
                originalData: readData,
            },
            {
                label: "Write IOPS",
                data: writeIOPS,
                backgroundColor: colors[1],
                borderColor: colors[1],
                borderWidth: 1,
                originalData: writeData,
            },
        ],
    };
};

// OPTIMIZED: Process data for IOPS vs Latency dual axis template
export const processIOPSLatencyDual = (
    data: PerformanceData[],
    colors: string[],
    options: ProcessorOptions,
): ChartData => {
    return measurePerformance(() => {
        const sortedData = applySortingAndGrouping(data, options);
        const { groupBy } = options;
        
        // If no grouping, use single-pass processing
        if (groupBy === "none") {
            const labels: string[] = [];
            const iopsData: number[] = [];
            const latencyData: number[] = [];
            
            // Single-pass processing
            for (const item of sortedData) {
                labels.push(`${item.drive_model} - ${item.block_size}`);
                iopsData.push(getMetricValue(item.metrics, "iops"));
                latencyData.push(getMetricValue(item.metrics, "avg_latency"));
            }

            return {
                labels,
                datasets: [
                    {
                        label: "IOPS",
                        data: iopsData,
                        backgroundColor: colors[0],
                        borderColor: colors[0],
                        borderWidth: 1,
                        yAxisID: "y",
                        originalData: sortedData,
                    },
                    {
                        label: "Avg Latency (ms)",
                        data: latencyData,
                        backgroundColor: colors[1],
                        borderColor: colors[1],
                        borderWidth: 1,
                        yAxisID: "y1",
                        type: "line",
                        originalData: sortedData,
                    },
                ],
            };
        }

        // OPTIMIZED: Use groupByMap utility for efficient grouping
        const groups = groupByMap(sortedData, (item) => formatGroupKey(groupBy, item));
        
        // Memoized label creation
        const createItemLabel = createMemoizer((item: PerformanceData): string => {
            let labelParts = [item.drive_model, item.block_size];
            
            // Add the groupBy field to ensure X-axis separation when grouping
            const excludedFromLabel: GroupOption[] = ["none", "drive", "blocksize"];
            if (!excludedFromLabel.includes(groupBy)) {
                labelParts.push(formatGroupKey(groupBy, item));
            }
            
            return labelParts.join(' - ');
        }, 50, (item) => `${item.drive_model}-${item.block_size}-${groupBy}`);

        // Single-pass label collection and mapping
        const labelToItemMap = new Map<string, Map<string, PerformanceData>>();
        const allLabels = new Set<string>();
        
        groups.forEach((_groupData, groupName) => {
            const groupLabelMap = new Map<string, PerformanceData>();
            
            for (const item of _groupData) {
                const itemLabel = createItemLabel(item);
                allLabels.add(itemLabel);
                groupLabelMap.set(itemLabel, item);
            }
            
            labelToItemMap.set(groupName, groupLabelMap);
        });

        const labels = Array.from(allLabels);
        const datasets: ChartDataset[] = [];
        let colorIndex = 0;

        // OPTIMIZED: Create datasets with pre-allocated arrays and Map lookups
        groups.forEach((_groupData, groupName) => {
            const groupLabelMap = labelToItemMap.get(groupName)!;
            
            // Pre-allocate arrays
            const iopsData = new Array<number>(labels.length);
            const latencyData = new Array<number>(labels.length);
            const iopsOriginal = new Array<PerformanceData>(labels.length);
            const latencyOriginal = new Array<PerformanceData>(labels.length);
            
            // Single-pass processing with O(1) lookups
            for (let i = 0; i < labels.length; i++) {
                const label = labels[i];
                const item = groupLabelMap.get(label);
                
                if (item) {
                    iopsData[i] = getMetricValue(item.metrics, "iops");
                    latencyData[i] = getMetricValue(item.metrics, "avg_latency");
                    iopsOriginal[i] = item;
                    latencyOriginal[i] = item;
                } else {
                    iopsData[i] = 0;
                    latencyData[i] = 0;
                    iopsOriginal[i] = null as any;
                    latencyOriginal[i] = null as any;
                }
            }

            datasets.push(
                {
                    label: `${groupName} - IOPS`,
                    data: iopsData,
                    backgroundColor: colors[colorIndex % colors.length],
                    borderColor: colors[colorIndex % colors.length],
                    borderWidth: 1,
                    yAxisID: "y",
                    originalData: iopsOriginal as unknown as PerformanceData[],
                },
                {
                    label: `${groupName} - Avg Latency (ms)`,
                    data: latencyData,
                    backgroundColor: colors[(colorIndex + 1) % colors.length],
                    borderColor: colors[(colorIndex + 1) % colors.length],
                    borderWidth: 1,
                    yAxisID: "y1",
                    type: "line",
                    originalData: latencyOriginal as unknown as PerformanceData[],
                }
            );

            colorIndex += 2;
        });

        return { labels, datasets };
    });
};

// Default chart processor
export const processDefaultChart = (
    data: PerformanceData[],
    colors: string[],
    options: ProcessorOptions,
): ChartData => {
    const sortedData = applySortingAndGrouping(data, options);
    const { groupBy } = options;
    
    // If no grouping, use the original simple approach
    if (groupBy === "none") {
        const labels = sortedData.map(item => 
            `${item.test_name} - ${item.drive_model}`
        );

        return {
            labels,
            datasets: [
                {
                    label: "IOPS",
                    data: sortedData.map(item => getMetricValue(item.metrics, "iops")),
                    backgroundColor: colors[0],
                    borderColor: colors[0],
                    borderWidth: 1,
                    originalData: sortedData,
                },
            ],
        };
    }

    // Group data by the specified field
    const groups = new Map<string, PerformanceData[]>();
    sortedData.forEach((item) => {
        const groupKey = formatGroupKey(groupBy, item);

        if (!groups.has(groupKey)) {
            groups.set(groupKey, []);
        }
        groups.get(groupKey)?.push(item);
    });

    // Helper function to create consistent labels for grouping
    const createItemLabel = (item: PerformanceData): string => {
        let labelParts = [item.test_name, item.drive_model];
        
        // Add the groupBy field to ensure X-axis separation when grouping
        const excludedFromLabel: GroupOption[] = ["none", "drive", "test"];
        if (!excludedFromLabel.includes(groupBy)) {
            // Add grouping field value for fields not already in the base label
            labelParts.push(formatGroupKey(groupBy, item));
        }
        
        return labelParts.join(' - ');
    };

    // Create labels from all unique test configurations
    const allLabels = new Set<string>();
    sortedData.forEach((item) => {
        allLabels.add(createItemLabel(item));
    });
    const labels = Array.from(allLabels);

    const datasets: ChartDataset[] = [];
    let colorIndex = 0;

    // Create datasets for each group
    Array.from(groups.entries()).forEach(([groupName, groupData]) => {
        const iopsData = labels.map(label => {
            const item = groupData.find(item => createItemLabel(item) === label);
            return item ? getMetricValue(item.metrics, "iops") : 0;
        });

        datasets.push({
            label: `${groupName} - IOPS`,
            data: iopsData,
            backgroundColor: colors[colorIndex % colors.length],
            borderColor: colors[colorIndex % colors.length],
            borderWidth: 1,
            originalData: groupData,
        });

        colorIndex++;
    });

    return { labels, datasets };
};

// OPTIMIZED: Process data for radar grid template
export const processRadarGridData = (
    data: PerformanceData[],
    colors: string[],
    options: ProcessorOptions,
): RadarGridData[] => {
    return measurePerformance(() => {
        const sortedData = applySortingAndGrouping(data, options);
        
        // Use groupByMap utility for efficient grouping
        const hostGroups = groupByMap(sortedData, (item) => item.hostname || 'Unknown');

        // OPTIMIZED: Single-pass metric value collection and normalization
        const normalizeMetrics = (allData: PerformanceData[]): Map<string, { min: number; max: number }> => {
            const metrics = new Map<string, { min: number; max: number }>();
            
            // Single-pass collection of all metric values
            const metricArrays = {
                iops: [] as number[],
                latency: [] as number[],
                bandwidth: [] as number[],
                p95_latency: [] as number[],
                p99_latency: [] as number[]
            };
            
            for (const item of allData) {
                const iops = getMetricValue(item.metrics, "iops");
                const latency = getMetricValue(item.metrics, "avg_latency");
                const bandwidth = getMetricValue(item.metrics, "bandwidth");
                const p95 = getMetricValue(item.metrics, "p95_latency");
                const p99 = getMetricValue(item.metrics, "p99_latency");
                
                if (iops > 0) metricArrays.iops.push(iops);
                if (latency > 0) metricArrays.latency.push(latency);
                if (bandwidth > 0) metricArrays.bandwidth.push(bandwidth);
                if (p95 > 0) metricArrays.p95_latency.push(p95);
                if (p99 > 0) metricArrays.p99_latency.push(p99);
            }
            
            // Calculate min/max for each metric type
            Object.entries(metricArrays).forEach(([key, values]) => {
                if (values.length > 0) {
                    metrics.set(key, { 
                        min: Math.min(...values), 
                        max: Math.max(...values) 
                    });
                } else {
                    metrics.set(key, { min: 0, max: 1 });
                }
            });
            
            return metrics;
        };

        const normalizationRanges = normalizeMetrics(sortedData);
        
        // Memoized normalize value function
        const normalizeValue = createMemoizer((value: number, metricName: string): number => {
            const range = normalizationRanges.get(metricName);
            if (!range || range.max === range.min) return 0;
            
            // For latency metrics, lower is better, so invert the scale
            if (metricName.includes('latency')) {
                return 100 - ((value - range.min) / (range.max - range.min)) * 100;
            }
            
            // For IOPS and bandwidth, higher is better
            return ((value - range.min) / (range.max - range.min)) * 100;
        }, 100, (value, metricName) => `${value}-${metricName}`);
        
        // OPTIMIZED: Calculate consistency score with single-pass variance calculation
        const calculateConsistencyScore = (hostData: PerformanceData[]): number => {
            if (hostData.length < 2) return 100;
            
            let sum = 0;
            let sumSquares = 0;
            let count = 0;
            
            // Single-pass mean and variance calculation
            for (const item of hostData) {
                const iops = getMetricValue(item.metrics, "iops");
                sum += iops;
                sumSquares += iops * iops;
                count++;
            }
            
            const mean = sum / count;
            const variance = (sumSquares / count) - (mean * mean);
            const cv = Math.sqrt(variance) / mean; // Coefficient of variation
            
            // Convert CV to consistency score (lower CV = higher consistency)
            return Math.max(0, 100 - (cv * 100));
        };

        const result: RadarGridData[] = [];
        let colorIndex = 0;

        // OPTIMIZED: Process each host with efficient pool grouping
        hostGroups.forEach((hostData, hostname) => {
            // Use groupByMap utility for pool grouping
            const poolGroups = groupByMap(hostData, (item) => item.drive_model);

            const pools: RadarPoolData[] = [];
            
            // OPTIMIZED: Process each pool with single-pass metric calculation
            poolGroups.forEach((poolData, poolName) => {
                // Single-pass average calculation
                let totalIops = 0, totalLatency = 0, totalBandwidth = 0;
                let totalP95 = 0, totalP99 = 0;
                const count = poolData.length;
                
                for (const item of poolData) {
                    totalIops += getMetricValue(item.metrics, "iops");
                    totalLatency += getMetricValue(item.metrics, "avg_latency");
                    totalBandwidth += getMetricValue(item.metrics, "bandwidth");
                    totalP95 += getMetricValue(item.metrics, "p95_latency");
                    totalP99 += getMetricValue(item.metrics, "p99_latency");
                }
                
                const avgMetrics = {
                    iops: totalIops / count,
                    latency: totalLatency / count,
                    bandwidth: totalBandwidth / count,
                    p95_latency: totalP95 / count,
                    p99_latency: totalP99 / count,
                };
                
                const normalizedMetrics: RadarMetrics = {
                    iops: normalizeValue(avgMetrics.iops, 'iops'),
                    latency: normalizeValue(avgMetrics.latency, 'latency'),
                    bandwidth: normalizeValue(avgMetrics.bandwidth, 'bandwidth'),
                    p95_latency: normalizeValue(avgMetrics.p95_latency, 'p95_latency'),
                    p99_latency: normalizeValue(avgMetrics.p99_latency, 'p99_latency'),
                    consistency: calculateConsistencyScore(poolData),
                };

                pools.push({
                    poolName,
                    metrics: normalizedMetrics,
                    color: colors[colorIndex % colors.length],
                });
                
                colorIndex++;
            });

            result.push({
                hostname,
                protocol: hostData[0]?.protocol || 'Unknown',
                pools,
            });
        });

        return result;
    });
};

// Main processor function that routes to specific processors
export const processDataForTemplate = (
    template: ChartTemplate,
    data: PerformanceData[],
    colors: string[],
    options: ProcessorOptions,
): ChartData => {
    switch (template.id) {
        case "performance-overview":
            return processPerformanceOverview(data, colors, options);
        case "block-size-impact":
            return processBlockSizeImpact(data, colors, options);
        case "read-write-comparison":
            return processReadWriteComparison(data, colors, options);
        case "iops-latency-dual":
            return processIOPSLatencyDual(data, colors, options);
        default:
            return processDefaultChart(data, colors, options);
    }
};