// Chart data processing utilities
import type { ChartTemplate, PerformanceData } from '../../types';
import { sortBlockSizes } from '../../utils/sorting';
import type { SortOption, GroupOption } from './ChartControls';

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

// Apply sorting and grouping to data
export const applySortingAndGrouping = (
    data: PerformanceData[],
    options: ProcessorOptions,
): PerformanceData[] => {
    const { sortBy, sortOrder } = options;
    
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
                aValue = a.queue_depth || 0;
                bValue = b.queue_depth || 0;
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

    return sortedData;
};

// Process data for performance overview template
export const processPerformanceOverview = (
    data: PerformanceData[],
    colors: string[],
    options: ProcessorOptions,
): ChartData => {
    const sortedData = applySortingAndGrouping(data, options);
    
    const labels = sortedData.map((item) => 
        `${item.drive_model} - ${item.block_size} - ${item.read_write_pattern}`
    );

    const datasets = [
        {
            label: "IOPS",
            data: sortedData.map((item) => getMetricValue(item.metrics, "iops")),
            backgroundColor: colors[0],
            borderColor: colors[0],
            borderWidth: 1,
            yAxisID: "y",
        },
        {
            label: "Avg Latency (ms)",
            data: sortedData.map((item) => getMetricValue(item.metrics, "avg_latency")),
            backgroundColor: colors[1],
            borderColor: colors[1],
            borderWidth: 1,
            yAxisID: "y1",
        },
        {
            label: "Bandwidth (MB/s)",
            data: sortedData.map((item) => getMetricValue(item.metrics, "bandwidth")),
            backgroundColor: colors[2],
            borderColor: colors[2],
            borderWidth: 1,
            yAxisID: "y2",
        },
    ];

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
        });

        // Bandwidth dataset
        datasets.push({
            label: `${driveModel} - Bandwidth`,
            data: sortedBlockSizes.map((size) => bandwidthByBlockSize.get(size.toString()) || 0),
            backgroundColor: colors[(colorIndex + 1) % colors.length],
            borderColor: colors[(colorIndex + 1) % colors.length],
            borderWidth: 2,
            yAxisID: "y1",
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
            },
            {
                label: "Write IOPS",
                data: writeIOPS,
                backgroundColor: colors[1],
                borderColor: colors[1],
                borderWidth: 1,
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
            },
            {
                label: "Avg Latency (ms)",
                data: sortedData.map(item => getMetricValue(item.metrics, "avg_latency")),
                backgroundColor: colors[1],
                borderColor: colors[1],
                borderWidth: 1,
                yAxisID: "y1",
                type: "line",
            },
        ],
    };
};

// Default chart processor
export const processDefaultChart = (
    data: PerformanceData[],
    colors: string[],
    options: ProcessorOptions,
): ChartData => {
    const sortedData = applySortingAndGrouping(data, options);
    
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
            },
        ],
    };
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