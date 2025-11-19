import React from 'react';
import type { MetricType } from '../../hooks/useHeatmapData';
import { formatLatencyMicroseconds } from '../../services/data/formatters';

export interface StatisticsTooltipProps {
    count: number;
    average: number;
    min?: number;
    max?: number;
    metric?: MetricType;
    position: { x: number; y: number };
    title?: string;
}

function formatMetricValue(value: number, metric?: MetricType): string {
    if (!metric) {
        return value.toFixed(2);
    }
    
    switch (metric) {
        case 'iops':
            return new Intl.NumberFormat().format(Math.round(value));
        case 'avg_latency':
        case 'p70_latency':
        case 'p90_latency':
        case 'p95_latency':
        case 'p99_latency':
            return formatLatencyMicroseconds(value).text;
        case 'bandwidth':
            return `${Math.round(value)} MB/s`;
        default:
            return String(value);
    }
}

const StatisticsTooltip: React.FC<StatisticsTooltipProps> = ({
    count,
    average,
    min,
    max,
    metric,
    position,
    title = 'Cell Statistics'
}) => {
    return (
        <div
            className="fixed bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl p-3 z-50 pointer-events-none min-w-[180px]"
            style={{
                left: `${position.x}px`,
                top: `${position.y}px`,
                transform: 'translate(-50%, calc(-100% - 12px))'
            }}
        >
            <div className="space-y-2">
                <div className="font-semibold theme-text-primary text-xs border-b border-gray-200 dark:border-gray-700 pb-1.5">
                    {title}
                </div>
                <div className="text-xs theme-text-secondary space-y-1.5">
                    <div className="flex justify-between">
                        <span className="font-medium">Records:</span>
                        <span className="text-gray-900 dark:text-gray-100">{count}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="font-medium">Average:</span>
                        <span className="text-gray-900 dark:text-gray-100">{formatMetricValue(average, metric)}</span>
                    </div>
                    {min !== undefined && (
                        <div className="flex justify-between">
                            <span className="font-medium">Min:</span>
                            <span className="text-gray-900 dark:text-gray-100">{formatMetricValue(min, metric)}</span>
                        </div>
                    )}
                    {max !== undefined && (
                        <div className="flex justify-between">
                            <span className="font-medium">Max:</span>
                            <span className="text-gray-900 dark:text-gray-100">{formatMetricValue(max, metric)}</span>
                        </div>
                    )}
                </div>
            </div>
            {/* Arrow pointing down */}
            <div className="absolute left-1/2 top-full transform -translate-x-1/2 -mt-px w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-gray-300 dark:border-t-gray-600" />
            <div className="absolute left-1/2 top-full transform -translate-x-1/2 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-white dark:border-t-gray-800" />
        </div>
    );
};

export default StatisticsTooltip;

