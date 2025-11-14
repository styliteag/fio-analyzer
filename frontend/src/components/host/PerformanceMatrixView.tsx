import React, { useState, useMemo, useEffect } from 'react';
import type { DriveAnalysis } from '../../services/api/hostAnalysis';
import { useHeatmapData, type MetricType } from '../../hooks/useHeatmapData';
import { useTrendAnalysis } from '../../hooks/useTrendAnalysis';

interface PerformanceMatrixViewProps {
    drives: DriveAnalysis[];
}

type RowDimension = 'block_size' | 'queue_depth' | 'protocol';
type ColDimension = 'read_write_pattern' | 'drive_type' | 'protocol';

const PerformanceMatrixView: React.FC<PerformanceMatrixViewProps> = ({ drives }) => {
    const [selectedMetric, setSelectedMetric] = useState<MetricType>('iops');
    const [rowDimension, setRowDimension] = useState<RowDimension>('block_size');
    const [colDimension, setColDimension] = useState<ColDimension>('read_write_pattern');

    const { createMatrixHeatmap, getHeatmapColor } = useHeatmapData();
    const { calculateSummary } = useTrendAnalysis();

    // Validate that dimensions are different
    useEffect(() => {
        if (rowDimension === colDimension) {
            // Reset to defaults
            setRowDimension('block_size');
            setColDimension('read_write_pattern');
        }
    }, [rowDimension, colDimension]);

    const matrixData = useMemo(() => {
        return createMatrixHeatmap(drives, selectedMetric, rowDimension, colDimension);
    }, [drives, selectedMetric, rowDimension, colDimension, createMatrixHeatmap]);

    const summary = useMemo(() => {
        return calculateSummary(drives, selectedMetric);
    }, [drives, selectedMetric, calculateSummary]);

    const getCellValue = (row: string, col: string): string => {
        const cell = matrixData.cells.find(c => c.row === row && c.col === col);
        if (!cell || cell.value === null) return '-';

        return formatMetricValue(cell.value, selectedMetric);
    };

    const getCellColor = (row: string, col: string): string => {
        const cell = matrixData.cells.find(c => c.row === row && c.col === col);
        if (!cell || cell.value === null) return '#f3f4f6';

        return getHeatmapColor(cell.value, matrixData.min, matrixData.max);
    };

    const isDarkCell = (row: string, col: string): boolean => {
        const cell = matrixData.cells.find(c => c.row === row && c.col === col);
        if (!cell || cell.value === null) return false;

        const normalized = (cell.value - matrixData.min) / (matrixData.max - matrixData.min);
        return normalized > 0.6;
    };

    if (drives.length === 0) {
        return (
            <div className="flex items-center justify-center h-64 text-gray-500">
                No data available for performance matrix
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
                        <option value="p95_latency">P95 Latency</option>
                        <option value="p99_latency">P99 Latency</option>
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <label htmlFor="row-dimension" className="font-medium text-gray-700 dark:text-gray-300">
                        Rows:
                    </label>
                    <select
                        id="row-dimension"
                        value={rowDimension}
                        onChange={(e) => setRowDimension(e.target.value as RowDimension)}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="block_size">Block Size</option>
                        <option value="queue_depth">Queue Depth</option>
                        <option value="protocol">Protocol</option>
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <label htmlFor="col-dimension" className="font-medium text-gray-700 dark:text-gray-300">
                        Columns:
                    </label>
                    <select
                        id="col-dimension"
                        value={colDimension}
                        onChange={(e) => setColDimension(e.target.value as ColDimension)}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="read_write_pattern">I/O Pattern</option>
                        <option value="drive_type">Drive Type</option>
                        <option value="protocol">Protocol</option>
                    </select>
                </div>
            </div>

            {/* Matrix Table */}
            <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                    <thead>
                        <tr>
                            <th className="border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 px-3 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                                {getDimensionLabel(rowDimension)} / {getDimensionLabel(colDimension)}
                            </th>
                            {matrixData.cols.map(col => (
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
                        {matrixData.rows.map(row => (
                            <tr key={row}>
                                <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-medium bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300">
                                    {row}
                                </td>
                                {matrixData.cols.map(col => (
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

            {/* Summary Statistics */}
            <div className="grid grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow text-center">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {formatMetricValue(summary.avg, selectedMetric)}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Average</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow text-center">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {formatMetricValue(summary.max, selectedMetric)}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Maximum</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow text-center">
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                        {formatMetricValue(summary.min, selectedMetric)}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Minimum</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow text-center">
                    <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                        {summary.count}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Test Count</div>
                </div>
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
        case 'p95_latency':
        case 'p99_latency':
            return `${value.toFixed(3)}ms`;
        case 'bandwidth':
            return `${Math.round(value)} MB/s`;
        default:
            return String(value);
    }
}

function getDimensionLabel(dimension: RowDimension | ColDimension): string {
    const labels: Record<string, string> = {
        block_size: 'Block Size',
        queue_depth: 'Queue Depth',
        protocol: 'Protocol',
        read_write_pattern: 'I/O Pattern',
        drive_type: 'Drive Type'
    };
    return labels[dimension] || dimension;
}

export default PerformanceMatrixView;
