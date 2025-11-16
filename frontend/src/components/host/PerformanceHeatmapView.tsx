import React, { useState, useMemo } from 'react';
import type { DriveAnalysis } from '../../services/api/hostAnalysis';
import { useHeatmapData, type MetricType } from '../../hooks/useHeatmapData';

interface PerformanceHeatmapViewProps {
    drives: DriveAnalysis[];
}

const PerformanceHeatmapView: React.FC<PerformanceHeatmapViewProps> = ({ drives }) => {
    const [selectedMetric, setSelectedMetric] = useState<MetricType>('iops');
    const { createHostHeatmap, getHeatmapColor } = useHeatmapData();

    const heatmapData = useMemo(() => {
        return createHostHeatmap(drives, selectedMetric);
    }, [drives, selectedMetric, createHostHeatmap]);

    const getCellValue = (row: string, col: string): string => {
        const cell = heatmapData.cells.find(c => c.row === row && c.col === col);
        if (!cell || cell.value === null) return '-';

        return formatMetricValue(cell.value, selectedMetric);
    };

    const getCellColor = (row: string, col: string): string => {
        const cell = heatmapData.cells.find(c => c.row === row && c.col === col);
        if (!cell || cell.value === null) return '#f3f4f6';

        return getHeatmapColor(cell.value, heatmapData.min, heatmapData.max);
    };

    const isDarkCell = (row: string, col: string): boolean => {
        const cell = heatmapData.cells.find(c => c.row === row && c.col === col);
        if (!cell || cell.value === null) return false;

        const normalized = (cell.value - heatmapData.min) / (heatmapData.max - heatmapData.min);
        return normalized > 0.6;
    };

    if (drives.length === 0) {
        return (
            <div className="flex items-center justify-center h-64 text-gray-500">
                No data available for heatmap visualization
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Metric Selector */}
            <div className="flex items-center gap-4">
                <label htmlFor="metric-select" className="font-medium text-gray-700 dark:text-gray-300">
                    Select Metric:
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

            {/* Heatmap Table */}
            <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                    <thead>
                        <tr>
                            <th className="border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 px-3 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                                Configuration
                            </th>
                            {heatmapData.cols.map(col => (
                                <th
                                    key={col}
                                    className="border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 px-3 py-2 text-center text-sm font-medium text-gray-700 dark:text-gray-300"
                                >
                                    {col}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {heatmapData.rows.map(row => (
                            <tr key={row}>
                                <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-medium bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300">
                                    {row}
                                </td>
                                {heatmapData.cols.map(col => (
                                    <td
                                        key={`${row}-${col}`}
                                        style={{ backgroundColor: getCellColor(row, col) }}
                                        className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-center text-sm cursor-pointer hover:opacity-80 transition-opacity"
                                    >
                                        <span
                                            className={`font-semibold ${
                                                isDarkCell(row, col) ? 'text-white' : 'text-gray-900'
                                            }`}
                                        >
                                            {getCellValue(row, col)}
                                        </span>
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                <span>Performance:</span>
                <div className="flex items-center gap-2">
                    <div className="w-8 h-4 bg-red-500"></div>
                    <span>Low</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-8 h-4 bg-yellow-500"></div>
                    <span>Medium</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-8 h-4 bg-green-500"></div>
                    <span>High</span>
                </div>
            </div>
        </div>
    );
};

function formatMetricValue(value: number, metric: MetricType): string {
    switch (metric) {
        case 'iops':
            return new Intl.NumberFormat().format(Math.round(value));
        case 'avg_latency':
        case 'p70_latency':
        case 'p90_latency':
        case 'p95_latency':
        case 'p99_latency':
            return `${value.toFixed(3)}ms`;
        case 'bandwidth':
            return `${Math.round(value)} MB/s`;
        default:
            return String(value);
    }
}

export default PerformanceHeatmapView;
