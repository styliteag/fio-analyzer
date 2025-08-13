import type { 
    ServerInfo,
    TimeSeriesMetricsPoint,
    TimeSeriesServerGroup,
    TimeSeriesEnabledMetrics,
    TimeSeriesTimeRange,
    TimeSeriesChartDataset,
} from "../types";

// Re-export types for convenience
export type ServerGroup = TimeSeriesServerGroup;
export type TimeSeriesPoint = TimeSeriesMetricsPoint;
export type ChartDataset = TimeSeriesChartDataset;
export type EnabledMetrics = TimeSeriesEnabledMetrics;
export type TimeRange = TimeSeriesTimeRange;

// Server colors for consistent styling
export const SERVER_COLORS = [
    "#3B82F6", // blue
    "#10B981", // emerald  
    "#F59E0B", // amber
    "#EF4444", // red
    "#8B5CF6", // violet
    "#EC4899", // pink
];

/**
 * Groups servers by hostname and protocol combination
 */
export const groupServers = (servers: ServerInfo[]): ServerGroup[] => {
    const groups = new Map<string, ServerGroup>();
    
    servers.forEach((server) => {
        const groupId = `${server.hostname}::${server.protocol}`;
        
        if (groups.has(groupId)) {
            const group = groups.get(groupId)!;
            group.driveModels.push(server.drive_model);
            group.totalTests += server.test_count;
            // Update time ranges
            if (new Date(server.last_test_time) > new Date(group.lastTestTime)) {
                group.lastTestTime = server.last_test_time;
            }
            if (new Date(server.first_test_time) < new Date(group.firstTestTime)) {
                group.firstTestTime = server.first_test_time;
            }
        } else {
            groups.set(groupId, {
                id: groupId,
                hostname: server.hostname,
                protocol: server.protocol,
                driveModels: [server.drive_model],
                totalTests: server.test_count,
                lastTestTime: server.last_test_time,
                firstTestTime: server.first_test_time,
            });
        }
    });

    return Array.from(groups.values());
};

/**
 * Converts time range string to API parameters
 */
export const getTimeRangeParams = (timeRange: TimeRange) => {
    switch (timeRange) {
        case "24h":
            return { days: undefined, hours: 24 };
        case "7d":
            return { days: 7, hours: undefined };
        case "30d":
            return { days: 30, hours: undefined };
        case "90d":
            return { days: 90, hours: undefined };
        case "6m":
            return { days: 180, hours: undefined };
        case "1y":
            return { days: 365, hours: undefined };
        case "all":
            return { days: undefined, hours: undefined };
        default:
            return { days: 7, hours: undefined };
    }
};

// Memoization cache for expensive operations
const processMetricDataCache = new Map<string, ChartDataset>();
const timestampCache = new Map<string, number>();

/**
 * Optimized timestamp parsing with memoization
 */
const getTimestamp = (dateString: string): number => {
    if (!timestampCache.has(dateString)) {
        const timestamp = new Date(dateString).getTime();
        
        // DEBUG: Log timestamp parsing
        if (import.meta.env.DEV) {
            console.log("🐛 [timeSeriesHelpers] getTimestamp input:", dateString);
            console.log("🐛 [timeSeriesHelpers] getTimestamp parsed Date:", new Date(dateString));
            console.log("🐛 [timeSeriesHelpers] getTimestamp result:", timestamp);
        }
        
        timestampCache.set(dateString, timestamp);
    }
    return timestampCache.get(dateString)!;
};

/**
 * Processes chart data for a specific metric type - OPTIMIZED VERSION
 * Single-pass filtering, mapping, and sorting with memoization
 */
export const processMetricData = (
    data: TimeSeriesPoint[],
    metricType: string,
    label: string,
    baseColor: string,
    yAxisID: string,
    borderDash?: number[]
): ChartDataset => {
    // Create cache key for memoization
    const cacheKey = `${metricType}-${label}-${data.length}-${data[0]?.timestamp || ''}`;
    if (processMetricDataCache.has(cacheKey)) {
        return processMetricDataCache.get(cacheKey)!;
    }

    // Single-pass filter, map, and collect timestamps for sorting
    const filteredPoints: Array<{ point: { x: string; y: number }, timestamp: number }> = [];
    
    for (const point of data) {
        if (point.metric_type === metricType) {
            const timestamp = getTimestamp(point.timestamp);
            
            // DEBUG: Log data processing
            if (import.meta.env.DEV && filteredPoints.length < 3) {
                console.log("🐛 [processMetricData] Processing point:", point);
                console.log("🐛 [processMetricData] Point timestamp:", point.timestamp);
                console.log("🐛 [processMetricData] Processed timestamp:", timestamp);
                console.log("🐛 [processMetricData] Creating chart point x:", point.timestamp);
            }
            
            filteredPoints.push({
                point: { x: point.timestamp, y: point.value },
                timestamp
            });
        }
    }

    // Sort by pre-computed timestamps (more efficient than repeated Date parsing)
    filteredPoints.sort((a, b) => a.timestamp - b.timestamp);
    
    // Extract sorted data points
    const filteredData = filteredPoints.map(item => item.point);

    const dataset: ChartDataset = {
        label,
        data: filteredData,
        borderColor: baseColor,
        backgroundColor: baseColor + (borderDash ? "40" : "20"),
        borderDash,
        tension: 0.1,
        fill: false,
        yAxisID,
        pointRadius: 2,
        pointHoverRadius: 6,
    };

    // Hide vertical segments (duplicate timestamps)
    (dataset as any).spanGaps = false;
    (dataset as any).segment = {
        borderWidth: (ctx: any) => {
            // If two consecutive points share the same timestamp, skip drawing the connecting line
            return ctx.p0.parsed.x === ctx.p1.parsed.x ? 0 : 2;
        },
    };

    // Cache the result
    processMetricDataCache.set(cacheKey, dataset);
    return dataset;
};

/**
 * Generates chart datasets from time series data - OPTIMIZED VERSION
 * Single-pass processing with Map-based server lookup and batch metric processing
 */
export const generateChartDatasets = (
    chartData: { [serverId: string]: any[] },
    serverGroups: ServerGroup[],
    enabledMetrics: EnabledMetrics
): ChartDataset[] => {
    const datasets: ChartDataset[] = [];
    let colorIndex = 0;

    // Create Map for O(1) server group lookup
    const serverGroupMap = new Map(serverGroups.map(group => [group.id, group]));

    // Batch process enabled metrics to avoid repeated conditional checks
    const metricsToProcess: Array<{type: string, label: string, yAxis: string, borderDash?: number[]}> = [];
    if (enabledMetrics.iops) metricsToProcess.push({ type: "iops", label: "IOPS", yAxis: "y", borderDash: undefined });
    if (enabledMetrics.latency) metricsToProcess.push({ type: "avg_latency", label: "Latency", yAxis: "y1", borderDash: [5, 5] });
    if (enabledMetrics.bandwidth) metricsToProcess.push({ type: "bandwidth", label: "Bandwidth", yAxis: "y2", borderDash: [2, 2] });

    Object.entries(chartData).forEach(([serverId, data]) => {
        const group = serverGroupMap.get(serverId);
        if (!group || !data.length) return;

        const baseColor = SERVER_COLORS[colorIndex % SERVER_COLORS.length];
        colorIndex++;

        const serverLabel = `${group.hostname} (${group.protocol})`;

        // Process all enabled metrics in a single loop
        for (const metric of metricsToProcess) {
            const dataset = processMetricData(
                data,
                metric.type,
                `${serverLabel} - ${metric.label}`,
                baseColor,
                metric.yAxis,
                metric.borderDash
            );
            if (dataset.data.length > 0) {
                datasets.push(dataset);
            }
        }
    });

    return datasets;
};

// Define TimeSeriesDataSeries interface here since it's needed in helpers
export interface TimeSeriesDataSeries {
    id: string;
    serverId: string;
    hostname: string;
    protocol: string;
    driveModel: string;
    blockSize: string;
    pattern: string;
    queueDepth: number;
    data: any[];
    label: string;
}

/**
 * Generates chart datasets from series data - OPTIMIZED VERSION
 * Batch processing with pre-computed metrics configuration
 */
export const generateSeriesDatasets = (
    seriesData: TimeSeriesDataSeries[],
    enabledMetrics: EnabledMetrics
): ChartDataset[] => {
    const datasets: ChartDataset[] = [];
    let colorIndex = 0;

    // Pre-compute metrics configuration to avoid repeated conditional checks
    const metricsConfig: Array<{type: string, label: string, yAxis: string, borderDash?: number[]}> = [];
    if (enabledMetrics.iops) metricsConfig.push({ type: "iops", label: "IOPS", yAxis: "y", borderDash: undefined });
    if (enabledMetrics.latency) metricsConfig.push({ type: "avg_latency", label: "Latency", yAxis: "y1", borderDash: [5, 5] });
    if (enabledMetrics.bandwidth) metricsConfig.push({ type: "bandwidth", label: "Bandwidth", yAxis: "y2", borderDash: [2, 2] });

    // Early return if no metrics enabled
    if (metricsConfig.length === 0) return datasets;

    seriesData.forEach((series) => {
        const baseColor = SERVER_COLORS[colorIndex % SERVER_COLORS.length];
        colorIndex++;

        // Process all enabled metrics in a single loop
        for (const metric of metricsConfig) {
            const dataset = processMetricData(
                series.data,
                metric.type,
                `${series.label} - ${metric.label}`,
                baseColor,
                metric.yAxis,
                metric.borderDash
            );
            if (dataset.data.length > 0) {
                datasets.push(dataset);
            }
        }
    });

    return datasets;
};

/**
 * Calculates server statistics from time series data - OPTIMIZED VERSION
 * Single-pass calculation with accumulated sums
 */
export const calculateServerStats = (data: any[]) => {
    if (data.length === 0) return null;

    // Single-pass accumulation instead of multiple filter operations
    let iopsSum = 0;
    let iopsCount = 0;
    let latencySum = 0;
    let latencyCount = 0;

    for (const point of data) {
        if (point.metric_type === "iops") {
            iopsSum += point.value;
            iopsCount++;
        } else if (point.metric_type === "avg_latency") {
            latencySum += point.value;
            latencyCount++;
        }
    }
    
    const avgIops = iopsCount > 0 ? Math.round(iopsSum / iopsCount) : 0;
    const avgLatency = latencyCount > 0 ? (latencySum / latencyCount).toFixed(2) : "0";

    return { avgIops, avgLatency, totalPoints: data.length };
};


/**
 * Gets chart title based on time range
 */
export const getChartTitle = (timeRange: TimeRange): string => {
    const titleMap: Record<TimeRange, string> = {
        "24h": "Last 24 Hours",
        "7d": "Last 7 Days", 
        "30d": "Last 30 Days",
        "90d": "Last 90 Days",
        "6m": "Last 6 Months",
        "1y": "Last Year",
        "all": "All Time"
    };
    return `Performance Monitoring - ${titleMap[timeRange] || timeRange.toUpperCase()}`;
};

/**
 * Validates server selection
 */
export const validateServerSelection = (selectedServerIds: string[]): boolean => {
    return selectedServerIds.length > 0;
};

/**
 * Validates metrics selection
 */
export const validateMetricsSelection = (enabledMetrics: EnabledMetrics): boolean => {
    return Object.values(enabledMetrics).some(enabled => enabled);
};