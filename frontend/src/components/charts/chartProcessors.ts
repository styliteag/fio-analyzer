// Chart data processing utilities
import type { ChartTemplate, PerformanceData, RadarGridData, RadarPoolData, RadarMetrics } from '../../types';
import { sortBlockSizes } from '../../utils/sorting';
import { formatBlockSize } from '../../services/data/formatters';
import type { SortOption, GroupOption } from './ChartControls';
import { chartConfig } from '../../services/config';

export interface ProcessorOptions {
    sortBy: SortOption;
    sortOrder: 'asc' | 'desc';
    groupBy: GroupOption;
}

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

// Helper function to format group keys consistently
export const formatGroupKey = (groupBy: GroupOption, item: PerformanceData): string => {
    switch (groupBy) {
        case "drive":
            return item.drive_model;
        case "test":
            return item.read_write_pattern;
        case "blocksize":
            return item.block_size.toString();
        case "protocol":
            return item.protocol || "Unknown";
        case "hostname":
            return item.hostname || "Unknown";
        case "queuedepth": {
            const queueDepth = item.queue_depth || (item as any).iodepth || 0;
            return `QD${queueDepth}`;
        }
        case "iodepth": {
            const ioDepth = (item as any).iodepth || item.queue_depth || 0;
            return `IOD${ioDepth}`;
        }
        case "numjobs": {
            const numJobs = (item as any).num_jobs || 1;
            return `${numJobs} Jobs`;
        }
        case "direct": {
            const direct = (item as any).direct;
            if (direct === null || direct === undefined) return "Direct IO: Unknown";
            return direct === 1 ? "Direct IO: Yes" : "Direct IO: No";
        }
        case "sync": {
            const sync = (item as any).sync;
            if (sync === null || sync === undefined) return "Sync: Unknown";
            return sync === 1 ? "Sync: On" : "Sync: Off";
        }
        case "testsize": {
            const testSize = (item as any).test_size || "Unknown";
            return `Size: ${testSize}`;
        }
        case "duration": {
            const duration = (item as any).duration || 0;
            return `${duration}s`;
        }
        default:
            return "Default";
    }
};

// Apply sorting and grouping to data
export const applySortingAndGrouping = (
    data: PerformanceData[],
    options: ProcessorOptions,
): PerformanceData[] => {
    const { sortBy, sortOrder, groupBy } = options;
    
    // Apply sorting
    const sortedData = [...data];
    sortedData.sort((a, b) => {
        let aValue: any, bValue: any;

        switch (sortBy) {
            case "name":
                aValue = `${a.test_name}_${a.drive_model}_${a.block_size}`;
                bValue = `${b.test_name}_${b.drive_model}_${b.block_size}`;
                break;
            case "iops":
                aValue = getMetricValue(a.metrics, "iops");
                bValue = getMetricValue(b.metrics, "iops");
                break;
            case "latency":
                aValue = getMetricValue(a.metrics, "avg_latency");
                bValue = getMetricValue(b.metrics, "avg_latency");
                break;
            case "bandwidth":
                aValue = getMetricValue(a.metrics, "bandwidth");
                bValue = getMetricValue(b.metrics, "bandwidth");
                break;
            case "blocksize":
                aValue = a.block_size;
                bValue = b.block_size;
                return sortBlockSizes([aValue, bValue])[0] === aValue ? -1 : 1;
            case "drivemodel":
                aValue = a.drive_model;
                bValue = b.drive_model;
                break;
            case "protocol":
                aValue = a.protocol || "";
                bValue = b.protocol || "";
                break;
            case "hostname":
                aValue = a.hostname || "";
                bValue = b.hostname || "";
                break;
            case "queuedepth":
                aValue = a.queue_depth || (a as any).iodepth || 0;
                bValue = b.queue_depth || (b as any).iodepth || 0;
                break;
            default:
                aValue = a.test_name;
                bValue = b.test_name;
        }

        const comparison =
            typeof aValue === "string"
                ? aValue.localeCompare(bValue)
                : aValue - bValue;
        return sortOrder === "asc" ? comparison : -comparison;
    });

    // Apply grouping (affects how data is ordered for better visual grouping)
    if (groupBy !== "none") {
        sortedData.sort((a, b) => {
            let aGroupValue: any, bGroupValue: any;

            // Use the helper function to format group values consistently
            aGroupValue = formatGroupKey(groupBy, a);
            bGroupValue = formatGroupKey(groupBy, b);
            
            // Special handling for block size sorting
            if (groupBy === "blocksize") {
                return sortBlockSizes([a.block_size.toString(), b.block_size.toString()])[0] === a.block_size.toString() ? -1 : 1;
            }

            const groupComparison =
                typeof aGroupValue === "string"
                    ? aGroupValue.localeCompare(bGroupValue)
                    : aGroupValue - bGroupValue;

            // If groups are the same, maintain original sort order
            if (groupComparison === 0) {
                // Apply the original sorting within the group
                let aValue: any, bValue: any;
                switch (sortBy) {
                    case "name":
                        aValue = `${a.test_name}_${a.drive_model}_${a.block_size}`;
                        bValue = `${b.test_name}_${b.drive_model}_${b.block_size}`;
                        break;
                    case "iops":
                        aValue = getMetricValue(a.metrics, "iops");
                        bValue = getMetricValue(b.metrics, "iops");
                        break;
                    case "latency":
                        aValue = getMetricValue(a.metrics, "avg_latency");
                        bValue = getMetricValue(b.metrics, "avg_latency");
                        break;
                    case "bandwidth":
                        aValue = getMetricValue(a.metrics, "bandwidth");
                        bValue = getMetricValue(b.metrics, "bandwidth");
                        break;
                    case "blocksize":
                        aValue = a.block_size;
                        bValue = b.block_size;
                        return sortBlockSizes([aValue, bValue])[0] === aValue ? -1 : 1;
                    case "drivemodel":
                        aValue = a.drive_model;
                        bValue = b.drive_model;
                        break;
                    case "protocol":
                        aValue = a.protocol || "";
                        bValue = b.protocol || "";
                        break;
                    case "hostname":
                        aValue = a.hostname || "";
                        bValue = b.hostname || "";
                        break;
                    case "queuedepth":
                        aValue = a.queue_depth || (a as any).iodepth || 0;
                        bValue = b.queue_depth || (b as any).iodepth || 0;
                        break;
                    default:
                        aValue = a.test_name;
                        bValue = b.test_name;
                }

                const comparison =
                    typeof aValue === "string"
                        ? aValue.localeCompare(bValue)
                        : aValue - bValue;
                return sortOrder === "asc" ? comparison : -comparison;
            }

            return groupComparison;
        });
    }

    return sortedData;
};

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

// Process data for performance overview template
export const processPerformanceOverview = (
    data: PerformanceData[],
    colors: string[],
    options: ProcessorOptions,
): ChartData => {
    const sortedData = applySortingAndGrouping(data, options);
    const { groupBy } = options;
    
    // If no grouping, use the original simple approach
    if (groupBy === "none") {
        const labels = sortedData.map((item) => 
            `${item.drive_model} - ${formatBlockSize(item.block_size)} - ${item.read_write_pattern}`
        );

        const datasets = [
            {
                label: "IOPS",
                data: sortedData.map((item) => getMetricValue(item.metrics, "iops")),
                backgroundColor: colors[0],
                borderColor: colors[0],
                borderWidth: 1,
                yAxisID: "y",
                originalData: sortedData,
            },
            {
                label: "Avg Latency (ms)",
                data: sortedData.map((item) => getMetricValue(item.metrics, "avg_latency")),
                backgroundColor: colors[1],
                borderColor: colors[1],
                borderWidth: 1,
                yAxisID: "y1",
                originalData: sortedData,
            },
            {
                label: "Bandwidth (MB/s)",
                data: sortedData.map((item) => getMetricValue(item.metrics, "bandwidth")),
                backgroundColor: colors[2],
                borderColor: colors[2],
                borderWidth: 1,
                yAxisID: "y2",
                originalData: sortedData,
            },
        ];

        return { labels, datasets };
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
        let labelParts = [item.drive_model, formatBlockSize(item.block_size), item.read_write_pattern];
        
        // Add the groupBy field to ensure X-axis separation when grouping
        const excludedFromLabel: GroupOption[] = ["none", "drive", "test", "blocksize"];
        if (!excludedFromLabel.includes(groupBy)) {
            // Add grouping field value for fields not already in the base label
            labelParts.push(formatGroupKey(groupBy, item));
        }
        
        return labelParts.join(' - ');
    };

    // Create labels from all unique test configurations (include groupBy field to ensure uniqueness)
    const allLabels = new Set<string>();
    sortedData.forEach((item) => {
        allLabels.add(createItemLabel(item));
    });
    const labels = Array.from(allLabels);

    const datasets: ChartDataset[] = [];
    const groupColors = getColorsForGrouping(groups.size, 3);
    let colorIndex = 0;

    // Create datasets for each group and metric
    Array.from(groups.entries()).forEach(([groupName, groupData]) => {
        const groupColor = groupColors[colorIndex];
        
        // IOPS dataset for this group
        const iopsData: number[] = [];
        const iopsOriginal: PerformanceData[] = [];
        labels.forEach(label => {
            const item = groupData.find(d => createItemLabel(d) === label);
            iopsData.push(item ? getMetricValue(item.metrics, "iops") : 0);
            iopsOriginal.push(item as any);
        });

        datasets.push({
            label: `${groupName} - IOPS`,
            data: iopsData,
            backgroundColor: groupColor,
            borderColor: groupColor,
            borderWidth: 1,
            yAxisID: "y",
            originalData: iopsOriginal as unknown as PerformanceData[],
        });

        // Latency dataset for this group
        const latencyData: number[] = [];
        const latencyOriginal: PerformanceData[] = [];
        labels.forEach(label => {
            const item = groupData.find(d => createItemLabel(d) === label);
            latencyData.push(item ? getMetricValue(item.metrics, "avg_latency") : 0);
            latencyOriginal.push(item as any);
        });

        datasets.push({
            label: `${groupName} - Avg Latency (ms)`,
            data: latencyData,
            backgroundColor: groupColors[colorIndex + 1],
            borderColor: groupColors[colorIndex + 1],
            borderWidth: 1,
            yAxisID: "y1",
            originalData: latencyOriginal as unknown as PerformanceData[],
        });

        // Bandwidth dataset for this group
        const bandwidthData: number[] = [];
        const bandwidthOriginal: PerformanceData[] = [];
        labels.forEach(label => {
            const item = groupData.find(d => createItemLabel(d) === label);
            bandwidthData.push(item ? getMetricValue(item.metrics, "bandwidth") : 0);
            bandwidthOriginal.push(item as any);
        });

        datasets.push({
            label: `${groupName} - Bandwidth (MB/s)`,
            data: bandwidthData,
            backgroundColor: groupColors[colorIndex + 2],
            borderColor: groupColors[colorIndex + 2],
            borderWidth: 1,
            yAxisID: "y2",
            originalData: bandwidthOriginal as unknown as PerformanceData[],
        });

        colorIndex += 3; // Move to next set of colors for the next group
    });

    return { labels, datasets };
};

// Process data for block size impact template
export const processBlockSizeImpact = (
    data: PerformanceData[],
    colors: string[],
    options: ProcessorOptions,
): ChartData => {
    const sortedData = applySortingAndGrouping(data, options);
    
    // Group by drive model
    const groupedData = new Map<string, PerformanceData[]>();
    sortedData.forEach((item) => {
        const key = item.drive_model;
        if (!groupedData.has(key)) {
            groupedData.set(key, []);
        }
        groupedData.get(key)?.push(item);
    });

    // Get unique block sizes and sort them
    const blockSizes = Array.from(
        new Set(sortedData.map((item) => item.block_size.toString()))
    );
    const sortedBlockSizes = sortBlockSizes(blockSizes);

    const datasets: ChartDataset[] = [];
    let colorIndex = 0;

    groupedData.forEach((items, driveModel) => {
        const iopsByBlockSize = new Map<string, number>();
        const bandwidthByBlockSize = new Map<string, number>();

        items.forEach((item) => {
            const blockSize = item.block_size.toString();
            iopsByBlockSize.set(blockSize, getMetricValue(item.metrics, "iops"));
            bandwidthByBlockSize.set(blockSize, getMetricValue(item.metrics, "bandwidth"));
        });

        // IOPS dataset
        datasets.push({
            label: `${driveModel} - IOPS`,
            data: sortedBlockSizes.map((size) => iopsByBlockSize.get(size.toString()) || 0),
            backgroundColor: colors[colorIndex % colors.length],
            borderColor: colors[colorIndex % colors.length],
            borderWidth: 2,
            yAxisID: "y",
            originalData: items,
        });

        // Bandwidth dataset
        datasets.push({
            label: `${driveModel} - Bandwidth`,
            data: sortedBlockSizes.map((size) => bandwidthByBlockSize.get(size.toString()) || 0),
            backgroundColor: colors[(colorIndex + 1) % colors.length],
            borderColor: colors[(colorIndex + 1) % colors.length],
            borderWidth: 2,
            yAxisID: "y1",
            originalData: items,
        });

        colorIndex += 2;
    });

    return {
        labels: sortedBlockSizes.map(size => size.toString()),
        datasets,
    };
};

// Process data for read/write comparison template
export const processReadWriteComparison = (
    data: PerformanceData[],
    colors: string[],
    options: ProcessorOptions,
): ChartData => {
    const sortedData = applySortingAndGrouping(data, options);
    
    const readData = sortedData.filter(item => 
        item.read_write_pattern.toLowerCase().includes('read') && 
        !item.read_write_pattern.toLowerCase().includes('write')
    );
    
    const writeData = sortedData.filter(item => 
        item.read_write_pattern.toLowerCase().includes('write') && 
        !item.read_write_pattern.toLowerCase().includes('read')
    );

    // Create labels from unique test configurations
    const allConfigs = new Set([
        ...readData.map(item => `${item.drive_model} - ${item.block_size}`),
        ...writeData.map(item => `${item.drive_model} - ${item.block_size}`),
    ]);
    const labels = Array.from(allConfigs);

    const readIOPS = labels.map(label => {
        const item = readData.find(item => 
            `${item.drive_model} - ${item.block_size}` === label
        );
        return item ? getMetricValue(item.metrics, "iops") : 0;
    });

    const writeIOPS = labels.map(label => {
        const item = writeData.find(item => 
            `${item.drive_model} - ${item.block_size}` === label
        );
        return item ? getMetricValue(item.metrics, "iops") : 0;
    });

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

// Process data for IOPS vs Latency dual axis template
export const processIOPSLatencyDual = (
    data: PerformanceData[],
    colors: string[],
    options: ProcessorOptions,
): ChartData => {
    const sortedData = applySortingAndGrouping(data, options);
    const { groupBy } = options;
    
    // If no grouping, use the original simple approach
    if (groupBy === "none") {
        const labels = sortedData.map(item => 
            `${item.drive_model} - ${item.block_size}`
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
                    yAxisID: "y",
                    originalData: sortedData,
                },
                {
                    label: "Avg Latency (ms)",
                    data: sortedData.map(item => getMetricValue(item.metrics, "avg_latency")),
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
        let labelParts = [item.drive_model, item.block_size];
        
        // Add the groupBy field to ensure X-axis separation when grouping
        const excludedFromLabel: GroupOption[] = ["none", "drive", "blocksize"];
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
        // IOPS dataset for this group
        const iopsData: number[] = [];
        const iopsOriginal: PerformanceData[] = [];
        labels.forEach(label => {
            const item = groupData.find(d => createItemLabel(d) === label);
            iopsData.push(item ? getMetricValue(item.metrics, "iops") : 0);
            iopsOriginal.push(item as any);
        });

        datasets.push({
            label: `${groupName} - IOPS`,
            data: iopsData,
            backgroundColor: colors[colorIndex % colors.length],
            borderColor: colors[colorIndex % colors.length],
            borderWidth: 1,
            yAxisID: "y",
            originalData: iopsOriginal as unknown as PerformanceData[],
        });

        // Latency dataset for this group
        const latencyData: number[] = [];
        const latencyOriginal: PerformanceData[] = [];
        labels.forEach(label => {
            const item = groupData.find(d => createItemLabel(d) === label);
            latencyData.push(item ? getMetricValue(item.metrics, "avg_latency") : 0);
            latencyOriginal.push(item as any);
        });

        datasets.push({
            label: `${groupName} - Avg Latency (ms)`,
            data: latencyData,
            backgroundColor: colors[(colorIndex + 1) % colors.length],
            borderColor: colors[(colorIndex + 1) % colors.length],
            borderWidth: 1,
            yAxisID: "y1",
            type: "line",
            originalData: latencyOriginal as unknown as PerformanceData[],
        });

        colorIndex += 2; // Move to next set of colors for the next group
    });

    return { labels, datasets };
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

// Process data for radar grid template
export const processRadarGridData = (
    data: PerformanceData[],
    colors: string[],
    options: ProcessorOptions,
): RadarGridData[] => {
    const sortedData = applySortingAndGrouping(data, options);
    
    // Group data by hostname (host)
    const hostGroups = new Map<string, PerformanceData[]>();
    sortedData.forEach((item) => {
        const hostname = item.hostname || 'Unknown';
        if (!hostGroups.has(hostname)) {
            hostGroups.set(hostname, []);
        }
        hostGroups.get(hostname)?.push(item);
    });

    // Helper function to normalize metrics to 0-100 scale
    const normalizeMetrics = (allData: PerformanceData[]): Map<string, { min: number; max: number }> => {
        const metrics = new Map<string, { min: number; max: number }>();
        
        const iopsValues = allData.map(item => getMetricValue(item.metrics, "iops")).filter(v => v > 0);
        const latencyValues = allData.map(item => getMetricValue(item.metrics, "avg_latency")).filter(v => v > 0);
        const bandwidthValues = allData.map(item => getMetricValue(item.metrics, "bandwidth")).filter(v => v > 0);
        const p95Values = allData.map(item => getMetricValue(item.metrics, "p95_latency")).filter(v => v > 0);
        const p99Values = allData.map(item => getMetricValue(item.metrics, "p99_latency")).filter(v => v > 0);
        
        metrics.set('iops', { min: Math.min(...iopsValues), max: Math.max(...iopsValues) });
        metrics.set('latency', { min: Math.min(...latencyValues), max: Math.max(...latencyValues) });
        metrics.set('bandwidth', { min: Math.min(...bandwidthValues), max: Math.max(...bandwidthValues) });
        metrics.set('p95_latency', { min: Math.min(...p95Values), max: Math.max(...p95Values) });
        metrics.set('p99_latency', { min: Math.min(...p99Values), max: Math.max(...p99Values) });
        
        return metrics;
    };

    const normalizationRanges = normalizeMetrics(sortedData);
    
    // Function to normalize a value to 0-100 scale
    const normalizeValue = (value: number, metricName: string): number => {
        const range = normalizationRanges.get(metricName);
        if (!range || range.max === range.min) return 0;
        
        // For latency metrics, lower is better, so invert the scale
        if (metricName.includes('latency')) {
            return 100 - ((value - range.min) / (range.max - range.min)) * 100;
        }
        
        // For IOPS and bandwidth, higher is better
        return ((value - range.min) / (range.max - range.min)) * 100;
    };
    
    // Calculate consistency score based on variance in performance
    const calculateConsistencyScore = (hostData: PerformanceData[]): number => {
        if (hostData.length < 2) return 100;
        
        const iopsValues = hostData.map(item => getMetricValue(item.metrics, "iops"));
        const mean = iopsValues.reduce((a, b) => a + b, 0) / iopsValues.length;
        const variance = iopsValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / iopsValues.length;
        const cv = Math.sqrt(variance) / mean; // Coefficient of variation
        
        // Convert CV to consistency score (lower CV = higher consistency)
        return Math.max(0, 100 - (cv * 100));
    };

    const result: RadarGridData[] = [];
    let colorIndex = 0;

    // Process each host
    hostGroups.forEach((hostData, hostname) => {
        // Group pools within each host by drive_model
        const poolGroups = new Map<string, PerformanceData[]>();
        hostData.forEach((item) => {
            const poolName = item.drive_model;
            if (!poolGroups.has(poolName)) {
                poolGroups.set(poolName, []);
            }
            poolGroups.get(poolName)?.push(item);
        });

        const pools: RadarPoolData[] = [];
        
        // Process each pool within the host
        poolGroups.forEach((poolData, poolName) => {
            // Calculate average metrics for this pool
            const avgMetrics = poolData.reduce((acc, item) => {
                acc.iops += getMetricValue(item.metrics, "iops");
                acc.latency += getMetricValue(item.metrics, "avg_latency");
                acc.bandwidth += getMetricValue(item.metrics, "bandwidth");
                acc.p95_latency += getMetricValue(item.metrics, "p95_latency");
                acc.p99_latency += getMetricValue(item.metrics, "p99_latency");
                return acc;
            }, { iops: 0, latency: 0, bandwidth: 0, p95_latency: 0, p99_latency: 0 });
            
            const count = poolData.length;
            avgMetrics.iops /= count;
            avgMetrics.latency /= count;
            avgMetrics.bandwidth /= count;
            avgMetrics.p95_latency /= count;
            avgMetrics.p99_latency /= count;
            
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