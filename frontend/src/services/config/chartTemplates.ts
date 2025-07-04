// Chart template configurations
import type { ChartTemplate } from '../../types';

// Chart template definitions
export const chartTemplates: ChartTemplate[] = [
    {
        id: "performance-overview",
        name: "📊 Performance Overview",
        description: "Compare IOPS, Latency, and Throughput across selected test runs",
        chartType: "bar",
        xAxis: "test_runs",
        yAxis: "performance_metrics",
        metrics: ["iops", "avg_latency", "bandwidth"],
    },
    {
        id: "block-size-impact",
        name: "📈 Block Size Impact",
        description: "Show how performance changes with different block sizes",
        chartType: "line",
        xAxis: "block_size",
        yAxis: "performance",
        groupBy: "drive_model",
        metrics: ["iops", "bandwidth"],
    },
    {
        id: "read-write-comparison",
        name: "⚖️ Read vs Write",
        description: "Side-by-side comparison of read and write performance",
        chartType: "bar",
        xAxis: "test_runs",
        yAxis: "iops",
        groupBy: "operation_type",
        metrics: ["iops"],
    },
    {
        id: "iops-latency-dual",
        name: "🎯 IOPS vs Latency",
        description: "Dual-axis chart showing both IOPS and latency metrics together",
        chartType: "bar",
        xAxis: "test_runs",
        yAxis: "dual_metrics",
        metrics: ["iops", "avg_latency"],
    },
    {
        id: "3d-bar",
        name: "🧊 3D Chart",
        description: "Interactive 3D bar chart: Block Size × Queue Depth × Metric",
        chartType: "3d-bar",
        xAxis: "blocksize",
        yAxis: "queuedepth",
        metrics: ["iops", "latency", "throughput"],
    },
    {
        id: "time-series-overview",
        name: "🕐 Time Series",
        description: "Monitor performance trends over time with server selection",
        chartType: "time-series",
        xAxis: "timestamp",
        yAxis: "performance",
        groupBy: "server",
        metrics: ["iops", "avg_latency", "bandwidth"],
    },
];

// Chart configuration options
export const chartConfig = {
    colors: {
        primary: [
            "#3B82F6",  // Blue
            "#EF4444",  // Red
            "#10B981",  // Green
            "#F59E0B",  // Amber
            "#8B5CF6",  // Purple
            "#06B6D4",  // Cyan
            "#F97316",  // Orange
            "#84CC16",  // Lime
            "#EC4899",  // Pink
            "#6B7280",  // Gray
        ],
        secondary: [
            "#93C5FD",  // Light Blue
            "#FCA5A5",  // Light Red
            "#6EE7B7",  // Light Green
            "#FCD34D",  // Light Amber
            "#C4B5FD",  // Light Purple
            "#67E8F9",  // Light Cyan
            "#FDBA74",  // Light Orange
            "#BEF264",  // Light Lime
            "#F9A8D4",  // Light Pink
            "#9CA3AF",  // Light Gray
        ],
    },
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
        mode: 'index' as const,
        intersect: false,
    },
    plugins: {
        legend: {
            position: 'top' as const,
        },
        tooltip: {
            enabled: true,
            mode: 'index' as const,
            intersect: false,
        },
    },
    scales: {
        x: {
            display: true,
            grid: {
                display: true,
            },
        },
        y: {
            display: true,
            beginAtZero: true,
            grid: {
                display: true,
            },
        },
    },
};

// Chart type icons mapping
export const chartTypeIcons = {
    bar: "BarChart3",
    line: "TrendingUp", 
    scatter: "Scatter3D",
    "time-series": "Clock",
    "3d-bar": "Zap",
    default: "Zap",
};

// Sort options for interactive controls
export const sortOptions = [
    { value: "name", label: "Name" },
    { value: "iops", label: "IOPS" },
    { value: "latency", label: "Latency" },
    { value: "bandwidth", label: "Bandwidth" },
    { value: "blocksize", label: "Block Size" },
    { value: "drivemodel", label: "Drive Model" },
    { value: "protocol", label: "Protocol" },
    { value: "hostname", label: "Hostname" },
    { value: "queuedepth", label: "Queue Depth" },
] as const;

// Group by options
export const groupByOptions = [
    { value: "none", label: "No Grouping" },
    { value: "drive", label: "Drive Model" },
    { value: "test", label: "Test Type" },
    { value: "blocksize", label: "Block Size" },
    { value: "protocol", label: "Protocol" },
    { value: "hostname", label: "Hostname" },
    { value: "queuedepth", label: "Queue Depth" },
] as const;

// Get template by ID
export const getTemplateById = (id: string): ChartTemplate | undefined => {
    return chartTemplates.find(template => template.id === id);
};

// Get templates by chart type
export const getTemplatesByType = (chartType: string): ChartTemplate[] => {
    return chartTemplates.filter(template => template.chartType === chartType);
};

// Get available metrics for templates
export const getAllMetrics = (): string[] => {
    const metrics = new Set<string>();
    chartTemplates.forEach(template => {
        template.metrics.forEach(metric => metrics.add(metric));
    });
    return Array.from(metrics);
};