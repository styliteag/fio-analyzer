import { useMemo } from "react";
import type { ChartOptions } from "chart.js";
import { 
    generateSeriesDatasets,
    getChartTitle,
    type EnabledMetrics,
    type TimeRange,
    type TimeSeriesDataSeries
} from "../utils/timeSeriesHelpers";

interface UseTimeSeriesChartProps {
    seriesData: TimeSeriesDataSeries[];
    enabledMetrics: EnabledMetrics;
    timeRange: TimeRange;
}

interface UseTimeSeriesChartResult {
    processedChartData: { datasets: any[] } | null;
    chartOptions: ChartOptions<'line'>;
    hasData: boolean;
}

export const useTimeSeriesChart = ({
    seriesData,
    enabledMetrics,
    timeRange,
}: UseTimeSeriesChartProps): UseTimeSeriesChartResult => {
    
    /**
     * Processes chart data for Chart.js consumption
     */
    const processedChartData = useMemo(() => {
        if (seriesData.length === 0) return null;

        const datasets = generateSeriesDatasets(seriesData, enabledMetrics);
        
        return datasets.length > 0 ? { datasets } : null;
    }, [seriesData, enabledMetrics]);

    /**
     * Chart.js configuration options
     */
    const chartOptions = useMemo((): ChartOptions<'line'> => ({
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: "index" as const,
            intersect: false,
        },
        plugins: {
            legend: {
                position: "bottom" as const,
                labels: {
                    usePointStyle: true,
                    padding: 20,
                },
            },
            title: {
                display: true,
                text: getChartTitle(timeRange),
                font: {
                    size: 16,
                    weight: "bold" as const,
                },
            },
            tooltip: {
                backgroundColor: "rgba(0, 0, 0, 0.8)",
                titleColor: "white",
                bodyColor: "white",
                borderColor: "rgba(255, 255, 255, 0.2)",
                borderWidth: 1,
                callbacks: {
                    title: (context) => {
                        // Format the date consistently
                        if (context.length > 0 && context[0].parsed.x) {
                            const date = new Date(context[0].parsed.x);
                            const formattedDate = date.toISOString().split('T')[0]; // YYYY-MM-DD
                            const formattedTime = date.toTimeString().split(' ')[0]; // HH:MM:SS
                            return `${formattedDate} ${formattedTime}`;
                        }
                        return '';
                    },
                    label: (context) => {
                        const label = context.dataset.label || '';
                        const value = context.parsed.y;
                        
                        // Format values based on metric type
                        if (label.includes('IOPS')) {
                            return `${label}: ${value.toLocaleString()}`;
                        } else if (label.includes('Latency')) {
                            return `${label}: ${value.toFixed(2)}ms`;
                        } else if (label.includes('Bandwidth')) {
                            return `${label}: ${value.toFixed(2)} MB/s`;
                        }
                        
                        return `${label}: ${value}`;
                    },
                },
            },
        },
        scales: {
            x: {
                type: "time" as const,
                time: {
                    displayFormats: {
                        hour: "MM-dd HH:mm",
                        day: "MM-dd",
                        week: "MM-dd",
                    },
                },
                title: {
                    display: true,
                    text: "Time",
                },
                grid: {
                    display: true,
                    color: "rgba(0, 0, 0, 0.1)",
                },
            },
            y: {
                type: "linear" as const,
                display: enabledMetrics.iops,
                position: "left" as const,
                title: {
                    display: true,
                    text: "IOPS",
                    color: "#3B82F6",
                },
                grid: {
                    display: true,
                    color: "rgba(59, 130, 246, 0.1)",
                },
                ticks: {
                    callback: function(value) {
                        if (typeof value === 'number') {
                            return value.toLocaleString();
                        }
                        return value;
                    },
                },
            },
            y1: {
                type: "linear" as const,
                display: enabledMetrics.latency,
                position: "right" as const,
                title: {
                    display: true,
                    text: "Latency (ms)",
                    color: "#10B981",
                },
                grid: {
                    display: false,
                },
                ticks: {
                    callback: function(value) {
                        if (typeof value === 'number') {
                            return value.toFixed(2);
                        }
                        return value;
                    },
                },
            },
            y2: {
                type: "linear" as const,
                display: enabledMetrics.bandwidth,
                position: "right" as const,
                title: {
                    display: true,
                    text: "Bandwidth (MB/s)",
                    color: "#F59E0B",
                },
                grid: {
                    display: false,
                },
                ticks: {
                    callback: function(value) {
                        if (typeof value === 'number') {
                            return value.toFixed(2);
                        }
                        return value;
                    },
                },
            },
        },
    }), [enabledMetrics, timeRange]);

    /**
     * Determines if chart has data to display
     */
    const hasData = useMemo(() => {
        return processedChartData !== null && processedChartData.datasets.length > 0;
    }, [processedChartData]);

    return {
        processedChartData,
        chartOptions,
        hasData,
    };
};