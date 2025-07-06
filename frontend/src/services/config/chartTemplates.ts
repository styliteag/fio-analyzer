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
            "#1F77B4",  // Blue
            "#FF7F0E",  // Orange
            "#2CA02C",  // Green
            "#D62728",  // Red
            "#9467BD",  // Purple
            "#8C564B",  // Brown
            "#E377C2",  // Pink
            "#7F7F7F",  // Gray
            "#BCBD22",  // Olive
            "#17BECF",  // Cyan
            "#FF9896",  // Light Red
            "#98DF8A",  // Light Green
            "#FFBB78",  // Light Orange
            "#AEC7E8",  // Light Blue
            "#C5B0D5",  // Light Purple
            "#C49C94",  // Light Brown
            "#F7B6D2",  // Light Pink
            "#C7C7C7",  // Light Gray
            "#DBDB8D",  // Light Olive
            "#9EDAE5",  // Light Cyan
        ],
        secondary: [
            "#AEC7E8",  // Light Blue
            "#FFBB78",  // Light Orange
            "#98DF8A",  // Light Green
            "#FF9896",  // Light Red
            "#C5B0D5",  // Light Purple
            "#C49C94",  // Light Brown
            "#F7B6D2",  // Light Pink
            "#C7C7C7",  // Light Gray
            "#DBDB8D",  // Light Olive
            "#9EDAE5",  // Light Cyan
            "#FF9896",  // Very Light Red
            "#98DF8A",  // Very Light Green
            "#FFBB78",  // Very Light Orange
            "#AEC7E8",  // Very Light Blue
            "#C5B0D5",  // Very Light Purple
            "#C49C94",  // Very Light Brown
            "#F7B6D2",  // Very Light Pink
            "#C7C7C7",  // Very Light Gray
            "#DBDB8D",  // Very Light Olive
            "#9EDAE5",  // Very Light Cyan
        ],
        // Color schemes for different grouping scenarios
        schemes: {
            // High contrast colors for better visibility
            highContrast: [
                "#000000",  // Black
                "#FF0000",  // Red
                "#00FF00",  // Green
                "#0000FF",  // Blue
                "#FFFF00",  // Yellow
                "#FF00FF",  // Magenta
                "#00FFFF",  // Cyan
                "#FF8000",  // Orange
                "#8000FF",  // Purple
                "#008000",  // Dark Green
            ],
            // Qualitative colors for categorical data
            qualitative: [
                "#1F77B4",  // Blue
                "#FF7F0E",  // Orange
                "#2CA02C",  // Green
                "#D62728",  // Red
                "#9467BD",  // Purple
                "#8C564B",  // Brown
                "#E377C2",  // Pink
                "#7F7F7F",  // Gray
                "#BCBD22",  // Olive
                "#17BECF",  // Cyan
            ],
            // Sequential colors for ordered data
            sequential: [
                "#F7FBFF",  // Very Light Blue
                "#DEEBF7",  // Light Blue
                "#C6DBEF",  // Blue
                "#9ECAE1",  // Medium Blue
                "#6BAED6",  // Dark Blue
                "#3182BD",  // Darker Blue
                "#08519C",  // Very Dark Blue
            ],
            // Diverging colors for centered data
            diverging: [
                "#67001F",  // Dark Red
                "#B2182B",  // Red
                "#D6604D",  // Light Red
                "#F4A582",  // Very Light Red
                "#F7F7F7",  // White
                "#D1E5F0",  // Very Light Blue
                "#92C5DE",  // Light Blue
                "#4393C3",  // Blue
                "#2166AC",  // Dark Blue
                "#053061",  // Very Dark Blue
            ],
        },
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