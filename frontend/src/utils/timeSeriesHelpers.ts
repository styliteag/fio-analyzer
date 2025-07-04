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
        default:
            return { days: 7, hours: undefined };
    }
};

/**
 * Processes chart data for a specific metric type
 */
export const processMetricData = (
    data: TimeSeriesPoint[],
    metricType: string,
    label: string,
    baseColor: string,
    yAxisID: string,
    borderDash?: number[]
): ChartDataset => {
    const filteredData = data
        .filter((point) => point.metric_type === metricType)
        .map((point) => ({
            x: point.timestamp,
            y: point.value,
        }));

    return {
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
};

/**
 * Generates chart datasets from time series data
 */
export const generateChartDatasets = (
    chartData: { [serverId: string]: any[] },
    serverGroups: ServerGroup[],
    enabledMetrics: EnabledMetrics
): ChartDataset[] => {
    const datasets: ChartDataset[] = [];
    let colorIndex = 0;

    Object.entries(chartData).forEach(([serverId, data]) => {
        const group = serverGroups.find(g => g.id === serverId);
        if (!group || !data.length) return;

        const baseColor = SERVER_COLORS[colorIndex % SERVER_COLORS.length];
        colorIndex++;

        const serverLabel = `${group.hostname} (${group.protocol})`;

        // Process each enabled metric
        if (enabledMetrics.iops) {
            const iopsDataset = processMetricData(
                data,
                "iops",
                `${serverLabel} - IOPS`,
                baseColor,
                "y"
            );
            if (iopsDataset.data.length > 0) {
                datasets.push(iopsDataset);
            }
        }

        if (enabledMetrics.latency) {
            const latencyDataset = processMetricData(
                data,
                "avg_latency",
                `${serverLabel} - Latency`,
                baseColor,
                "y1",
                [5, 5]
            );
            if (latencyDataset.data.length > 0) {
                datasets.push(latencyDataset);
            }
        }

        if (enabledMetrics.bandwidth) {
            const bandwidthDataset = processMetricData(
                data,
                "bandwidth",
                `${serverLabel} - Bandwidth`,
                baseColor,
                "y2",
                [2, 2]
            );
            if (bandwidthDataset.data.length > 0) {
                datasets.push(bandwidthDataset);
            }
        }
    });

    return datasets;
};

/**
 * Calculates server statistics from time series data
 */
export const calculateServerStats = (data: any[]) => {
    if (data.length === 0) return null;

    const iopsData = data.filter((p) => p.metric_type === "iops");
    const latencyData = data.filter((p) => p.metric_type === "avg_latency");
    
    const avgIops = iopsData.length > 0 
        ? Math.round(iopsData.reduce((sum, p) => sum + p.value, 0) / iopsData.length)
        : 0;
    
    const avgLatency = latencyData.length > 0 
        ? (latencyData.reduce((sum, p) => sum + p.value, 0) / latencyData.length).toFixed(2)
        : "0";

    return { avgIops, avgLatency, totalPoints: data.length };
};

/**
 * Formats timestamp as time ago string
 */
export const formatTimeAgo = (timestamp: string): string => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return "< 1h ago";
};

/**
 * Gets chart title based on time range
 */
export const getChartTitle = (timeRange: TimeRange): string => {
    return `Performance Monitoring - ${timeRange.toUpperCase()}`;
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