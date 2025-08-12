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


export default ChartStats;