import React, { useState, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    type ChartOptions
} from 'chart.js';
import type { DriveAnalysis } from '../../services/api/hostAnalysis';
import { useTrendAnalysis } from '../../hooks/useTrendAnalysis';
import type { MetricType } from '../../hooks/useHeatmapData';
import { createChartJsColors } from '../../utils/colorMapping';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface TrendChartsViewProps {
    drives: DriveAnalysis[];
}

const TrendChartsView: React.FC<TrendChartsViewProps> = ({ drives }) => {
    const [selectedMetric, setSelectedMetric] = useState<MetricType>('iops');
    const [groupBy, setGroupBy] = useState<'hostname' | 'read_write_pattern'>('hostname');

    const { createBlockSizeTrend, createQueueDepthTrend } = useTrendAnalysis();

    // Generate colors for datasets
    const colors = useMemo(() => {
        const items = drives.map(drive => ({
            hostname: drive.hostname,
            driveModel: drive.drive_model,
            label: groupBy === 'hostname' ? drive.hostname : drive.drive_model
        }));

        const chartColors = createChartJsColors(items);
        return chartColors.map(c => c.borderColor);
    }, [drives, groupBy]);

    // Block size trend data
    const blockSizeTrendData = useMemo(() => {
        return createBlockSizeTrend(drives, selectedMetric, groupBy, colors);
    }, [drives, selectedMetric, groupBy, colors, createBlockSizeTrend]);

    // Queue depth trend data
    const queueDepthTrendData = useMemo(() => {
        return createQueueDepthTrend(drives, selectedMetric, groupBy, colors);
    }, [drives, selectedMetric, groupBy, colors, createQueueDepthTrend]);

    const chartOptions: ChartOptions<'line'> = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    boxWidth: 12,
                    padding: 15,
                    color: '#374151' // gray-700
                }
            },
            tooltip: {
                mode: 'index',
                intersect: false,
                callbacks: {
                    label: (context) => {
                        const label = context.dataset.label || '';
                        const value = context.parsed.y;
                        return `${label}: ${formatValue(value, selectedMetric)}`;
                    }
                }
            }
        },
        scales: {
            x: {
                grid: {
                    display: false
                },
                ticks: {
                    color: '#6b7280' // gray-500
                }
            },
            y: {
                beginAtZero: true,
                ticks: {
                    callback: (value) => formatValue(value as number, selectedMetric),
                    color: '#6b7280' // gray-500
                }
            }
        },
        interaction: {
            mode: 'nearest',
            axis: 'x',
            intersect: false
        }
    };

    if (drives.length === 0) {
        return (
            <div className="flex items-center justify-center h-64 text-gray-500">
                No data available for trend analysis
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Controls */}
            <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                    <label htmlFor="metric-select" className="font-medium text-gray-700 dark:text-gray-300">
                        Metric:
                    </label>
                    <select
                        id="metric-select"
                        value={selectedMetric}
                        onChange={(e) => setSelectedMetric(e.target.value as MetricType)}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="iops">IOPS</option>
                        <option value="avg_latency">Average Latency</option>
                        <option value="bandwidth">Bandwidth</option>
                        <option value="p70_latency">P70 Latency</option>
                        <option value="p90_latency">P90 Latency</option>
                        <option value="p95_latency">P95 Latency</option>
                        <option value="p99_latency">P99 Latency</option>
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <label htmlFor="groupby-select" className="font-medium text-gray-700 dark:text-gray-300">
                        Group By:
                    </label>
                    <select
                        id="groupby-select"
                        value={groupBy}
                        onChange={(e) => setGroupBy(e.target.value as 'hostname' | 'read_write_pattern')}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="hostname">Host</option>
                        <option value="read_write_pattern">I/O Pattern</option>
                    </select>
                </div>
            </div>

            {/* Block Size Trend Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
                    Block Size Performance Trend
                </h3>
                <div style={{ height: '400px' }}>
                    <Line data={blockSizeTrendData} options={chartOptions} />
                </div>
            </div>

            {/* Queue Depth Trend Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
                    Queue Depth Scaling
                </h3>
                <div style={{ height: '400px' }}>
                    <Line data={queueDepthTrendData} options={chartOptions} />
                </div>
            </div>
        </div>
    );
};

function formatValue(value: number, metric: MetricType): string {
    switch (metric) {
        case 'iops':
            if (value >= 1000000) {
                return `${(value / 1000000).toFixed(1)}M`;
            } else if (value >= 1000) {
                return `${(value / 1000).toFixed(1)}K`;
            } else {
                return value.toFixed(0);
            }
        case 'avg_latency':
        case 'p70_latency':
        case 'p90_latency':
        case 'p95_latency':
        case 'p99_latency':
            return `${value.toFixed(3)}ms`;
        case 'bandwidth':
            if (value >= 1000) {
                return `${(value / 1000).toFixed(1)} GB/s`;
            } else {
                return `${value.toFixed(0)} MB/s`;
            }
        default:
            return value.toFixed(1);
    }
}

export default TrendChartsView;
