// Chart statistics display component
import React from 'react';
import { BarChart3, Database, Eye, Layers } from 'lucide-react';
import type { ChartTemplate, PerformanceData } from '../../types';

export interface ChartStatsProps {
    data: PerformanceData[];
    template: ChartTemplate;
    visibleSeries: Set<string>;
    totalSeries: number;
    className?: string;
}

const ChartStats: React.FC<ChartStatsProps> = ({
    data,
    template,
    visibleSeries,
    totalSeries,
    className = '',
}) => {
    const stats = [
        {
            label: 'Data Points',
            value: data.length,
            icon: Database,
            color: 'text-blue-600',
        },
        {
            label: 'Total Series',
            value: totalSeries,
            icon: Layers,
            color: 'text-green-600',
        },
        {
            label: 'Visible Series',
            value: visibleSeries.size,
            icon: Eye,
            color: 'text-purple-600',
        },
        {
            label: 'Chart Type',
            value: template.chartType,
            icon: BarChart3,
            color: 'text-orange-600',
            isText: true,
        },
    ];

    return (
        <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 text-sm ${className}`}>
            {stats.map((stat, index) => (
                <StatCard key={index} stat={stat} />
            ))}
        </div>
    );
};

interface StatCardProps {
    stat: {
        label: string;
        value: string | number;
        icon: React.ComponentType<{ size?: number; className?: string }>;
        color: string;
        isText?: boolean;
    };
}

const StatCard: React.FC<StatCardProps> = ({ stat }) => {
    const Icon = stat.icon;

    return (
        <div className="theme-bg-secondary p-3 rounded border theme-border-primary">
            <div className="flex items-center mb-1">
                <Icon size={16} className={`mr-2 ${stat.color}`} />
                <div className="font-medium theme-text-secondary">
                    {stat.label}
                </div>
            </div>
            <div className={`text-lg font-semibold theme-text-primary ${stat.isText ? 'capitalize' : ''}`}>
                {stat.value}
            </div>
        </div>
    );
};

// Detailed chart metrics component
export interface DetailedChartMetricsProps {
    data: PerformanceData[];
    className?: string;
}

export const DetailedChartMetrics: React.FC<DetailedChartMetricsProps> = ({
    data,
    className = '',
}) => {
    const metrics = React.useMemo(() => {
        if (data.length === 0) return null;

        const metricTypes = ['iops', 'avg_latency', 'bandwidth', 'p95_latency', 'p99_latency'];
        const calculations: Record<string, { min: number; max: number; avg: number; count: number }> = {};

        metricTypes.forEach(metricType => {
            const values = data
                .map(item => item.metrics[metricType]?.value)
                .filter((value): value is number => typeof value === 'number');

            if (values.length > 0) {
                calculations[metricType] = {
                    min: Math.min(...values),
                    max: Math.max(...values),
                    avg: values.reduce((sum, val) => sum + val, 0) / values.length,
                    count: values.length,
                };
            }
        });

        return calculations;
    }, [data]);

    if (!metrics || Object.keys(metrics).length === 0) {
        return null;
    }

    const formatValue = (value: number, metricType: string) => {
        switch (metricType) {
            case 'iops':
                return Math.round(value).toLocaleString();
            case 'avg_latency':
            case 'p95_latency':
            case 'p99_latency':
                return `${value.toFixed(2)}ms`;
            case 'bandwidth':
                return `${value.toFixed(2)} MB/s`;
            default:
                return value.toFixed(2);
        }
    };

    const getMetricLabel = (metricType: string) => {
        const labels: Record<string, string> = {
            'iops': 'IOPS',
            'avg_latency': 'Avg Latency',
            'bandwidth': 'Bandwidth',
            'p95_latency': 'P95 Latency',
            'p99_latency': 'P99 Latency',
        };
        return labels[metricType] || metricType;
    };

    return (
        <div className={`space-y-4 ${className}`}>
            <h4 className="text-lg font-semibold theme-text-primary">
                Performance Metrics Summary
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(metrics).map(([metricType, stats]) => (
                    <div 
                        key={metricType}
                        className="border rounded-lg p-4 theme-border-primary theme-bg-secondary"
                    >
                        <h5 className="font-medium mb-3 theme-text-primary">
                            {getMetricLabel(metricType)}
                        </h5>
                        
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="theme-text-secondary">Min:</span>
                                <span className="font-medium theme-text-primary">
                                    {formatValue(stats.min, metricType)}
                                </span>
                            </div>
                            
                            <div className="flex justify-between">
                                <span className="theme-text-secondary">Max:</span>
                                <span className="font-medium theme-text-primary">
                                    {formatValue(stats.max, metricType)}
                                </span>
                            </div>
                            
                            <div className="flex justify-between">
                                <span className="theme-text-secondary">Avg:</span>
                                <span className="font-medium theme-text-primary">
                                    {formatValue(stats.avg, metricType)}
                                </span>
                            </div>
                            
                            <div className="flex justify-between border-t pt-2 theme-border-primary">
                                <span className="theme-text-secondary">Count:</span>
                                <span className="font-medium theme-text-primary">
                                    {stats.count}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ChartStats;