import React, { useState, useMemo, useEffect } from "react";
import { Line } from "react-chartjs-2";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    TimeScale,
    Tooltip,
    Legend,
} from "chart.js";
import "chartjs-adapter-date-fns";
import { Maximize2, Minimize2, Activity, RefreshCw } from "lucide-react";
import type { PerformanceData } from "../types";
import type { ActiveFilters } from "../hooks/useTestRunFilters";
import { fetchTimeSeriesHistory } from "../services/api/timeSeries";

// Register chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    TimeScale,
    Tooltip,
    Legend
);

interface PerformanceTimeSeriesChartProps {
    performanceData: PerformanceData[];
    isMaximized: boolean;
    onToggleMaximize: () => void;
    loading?: boolean;
    sharedFilters?: ActiveFilters;
}

interface EnabledMetrics {
    [key: string]: boolean;
    iops: boolean;
    avg_latency: boolean;
    bandwidth: boolean;
}

const PerformanceTimeSeriesChart: React.FC<PerformanceTimeSeriesChartProps> = ({
    isMaximized,
    onToggleMaximize,
    loading = false,
    sharedFilters,
}) => {
    const [enabledMetrics, setEnabledMetrics] = useState<EnabledMetrics>({
        iops: true,
        avg_latency: true,
        bandwidth: false,
    });
    
    const [timeSeriesData, setTimeSeriesData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleMetricToggle = (metric: keyof EnabledMetrics) => {
        setEnabledMetrics(prev => ({
            ...prev,
            [metric]: !prev[metric],
        }));
    };

    // Fetch time series data when filters change
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            
            try {
                // Build query parameters based on shared filters
                const queryParams: any = {
                    days: 30, // Default to last 30 days
                };
                
                // Add filters if they exist
                if (sharedFilters?.hostnames?.length && sharedFilters.hostnames.length > 0) {
                    queryParams.hostname = sharedFilters.hostnames[0];
                }
                if (sharedFilters?.protocols?.length && sharedFilters.protocols.length > 0) {
                    queryParams.protocol = sharedFilters.protocols[0];
                }
                if (sharedFilters?.drive_models?.length && sharedFilters.drive_models.length > 0) {
                    queryParams.driveModel = sharedFilters.drive_models[0];
                }
                if (sharedFilters?.drive_types?.length && sharedFilters.drive_types.length > 0) {
                    queryParams.driveType = sharedFilters.drive_types[0];
                }
                if (sharedFilters?.block_sizes?.length && sharedFilters.block_sizes.length > 0) {
                    queryParams.blockSize = sharedFilters.block_sizes[0];
                }
                if (sharedFilters?.patterns?.length && sharedFilters.patterns.length > 0) {
                    queryParams.readWritePattern = sharedFilters.patterns[0];
                }

                console.log('Fetching time series data with params:', queryParams);
                
                const response = await fetchTimeSeriesHistory(queryParams);
                
                if (response.error) {
                    setError(response.error);
                    setTimeSeriesData([]);
                } else {
                    setTimeSeriesData(response.data || []);
                    console.log('Time series data fetched:', response.data?.length || 0, 'points');
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to fetch time series data');
                setTimeSeriesData([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [sharedFilters]);

    // Process data for chart display
    const chartData = useMemo(() => {
        if (timeSeriesData.length === 0) {
            return { datasets: [] };
        }

        const selectedMetrics = Object.entries(enabledMetrics)
            .filter(([, enabled]) => enabled)
            .map(([metric]) => metric);

        // Transform data to include metric_type for each selected metric
        const transformedData: any[] = [];
        timeSeriesData.forEach((d) => {
            selectedMetrics.forEach((metric) => {
                const value = d[metric as keyof typeof d];
                if (value !== null && value !== undefined) {
                    transformedData.push({
                        ...d,
                        metric_type: metric,
                        value: value
                    });
                }
            });
        });

        // Group data by configuration
        const palette = [
            '#3b82f6', '#10b981', '#f59e0b', '#ef4444', 
            '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'
        ];
        
        const map: Record<string, { label: string; data: { x: string; y: number }[]; color: string }> = {};
        let colorIdx = 0;
        
        transformedData.forEach((d) => {
            const key = `${d.read_write_pattern}/${d.block_size}/qd${d.queue_depth}-${d.metric_type}`;
            if (!map[key]) {
                map[key] = {
                    label: key,
                    data: [],
                    color: palette[colorIdx % palette.length],
                };
                colorIdx += 1;
            }
            map[key].data.push({ x: d.timestamp, y: d.value });
        });
        
        const datasets = Object.values(map).map((ds) => ({
            label: ds.label,
            data: ds.data.sort((a, b) => new Date(a.x).getTime() - new Date(b.x).getTime()),
            borderColor: ds.color,
            backgroundColor: ds.color + '20',
            fill: false,
            tension: 0.1,
            pointRadius: 2,
            pointHoverRadius: 4,
        }));
        
        return { datasets };
    }, [timeSeriesData, enabledMetrics]);

    // Chart options
    const chartOptions = useMemo(() => {
        const enabledMetricsList = Object.entries(enabledMetrics)
            .filter(([, enabled]) => enabled)
            .map(([metric]) => metric);

        return {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index' as const,
                intersect: false,
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom' as const,
                },
                tooltip: {
                    mode: 'index' as const,
                    intersect: false,
                    callbacks: {
                        title: (context: any) => {
                            if (context.length > 0) {
                                const date = new Date(context[0].parsed.x);
                                return date.toLocaleString('en-US', {
                                    year: 'numeric',
                                    month: '2-digit',
                                    day: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit',
                                    hour12: false
                                });
                            }
                            return '';
                        },
                        label: (context: any) => {
                            const value = context.parsed.y;
                            const label = context.dataset.label || '';
                            return `${label}: ${value.toLocaleString()}`;
                        },
                    },
                },
            },
            scales: {
                x: {
                    type: 'time' as const,
                    time: {
                        unit: 'day' as const,
                        displayFormats: {
                            hour: 'HH:mm',
                            day: 'MM/dd',
                            week: 'MM/dd',
                            month: 'MM/yyyy',
                        },
                        tooltipFormat: 'yyyy-MM-dd HH:mm:ss',
                    },
                    title: {
                        display: true,
                        text: 'Time',
                    },
                },
                y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: enabledMetricsList.join(', ').toUpperCase(),
                    },
                },
            },
        };
    }, [enabledMetrics]);

    // Filter validation
    const hasValidMetrics = Object.values(enabledMetrics).some(enabled => enabled);
    const hasData = timeSeriesData.length > 0;
    const actualLoading = loading || isLoading;

    return (
        <div
            className={`theme-card rounded-lg shadow-md border ${
                isMaximized ? "fixed inset-4 z-50 flex flex-col" : "h-auto"
            }`}
        >
            {/* Header Controls */}
            <div className={`p-4 border-b theme-border-primary ${isMaximized ? "flex-shrink-0" : ""}`}>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                        <Activity className="h-6 w-6 theme-text-accent mr-3" />
                        <h3 className="text-xl font-semibold theme-text-primary">
                            Performance Time Series
                        </h3>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={onToggleMaximize}
                            className="p-2 rounded-md theme-text-secondary hover:theme-text-primary hover:theme-bg-tertiary transition-colors"
                            title={isMaximized ? "Minimize" : "Maximize"}
                        >
                            {isMaximized ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                        </button>
                    </div>
                </div>

                {/* Metrics Toggle Controls */}
                <div className="flex items-center space-x-6">
                    <span className="text-sm font-medium theme-text-secondary">Metrics:</span>
                    {Object.entries(enabledMetrics).map(([metric, enabled]) => (
                        <label key={metric} className="flex items-center space-x-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={enabled}
                                onChange={() => handleMetricToggle(metric as keyof EnabledMetrics)}
                                className="rounded border-gray-300 theme-text-accent focus:ring-blue-500"
                            />
                            <span className="text-sm theme-text-primary capitalize">
                                {metric.replace('_', ' ')}
                            </span>
                        </label>
                    ))}
                </div>

                {/* Error Display */}
                {error && (
                    <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded-md">
                        <span className="text-red-700">
                            Error: {error}
                        </span>
                    </div>
                )}

                {/* Validation Messages */}
                {!hasValidMetrics && !error && (
                    <div className="mt-4 p-3 bg-yellow-100 border border-yellow-300 rounded-md">
                        <span className="text-yellow-700">
                            Please select at least one metric to display
                        </span>
                    </div>
                )}

                {!hasData && hasValidMetrics && !error && !actualLoading && (
                    <div className="mt-4 p-3 bg-blue-100 border border-blue-300 rounded-md">
                        <span className="text-blue-700">
                            No time series data available for the selected test runs
                        </span>
                    </div>
                )}
            </div>

            {/* Chart Area */}
            <div className={`p-4 ${isMaximized ? "flex-1 min-h-0" : ""}`}>
                <div className="relative" style={{ height: isMaximized ? '100%' : '400px' }}>
                    {actualLoading && (
                        <div className="absolute inset-0 theme-bg-card bg-opacity-75 flex items-center justify-center z-10 rounded-lg">
                            <div className="flex items-center">
                                <RefreshCw className="animate-spin h-8 w-8 theme-text-accent mr-3" />
                                <span className="theme-text-secondary">
                                    Loading time series data...
                                </span>
                            </div>
                        </div>
                    )}
                    
                    {hasData && hasValidMetrics && !error ? (
                        <Line data={chartData} options={chartOptions} />
                    ) : !actualLoading && !error ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center">
                                <Activity className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                                <h4 className="text-lg font-semibold theme-text-primary mb-2">
                                    No Data Available
                                </h4>
                                <p className="theme-text-secondary">
                                    {!hasValidMetrics 
                                        ? "Select metrics to display the chart"
                                        : "No performance data available for time series visualization"
                                    }
                                </p>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
};

export default PerformanceTimeSeriesChart;