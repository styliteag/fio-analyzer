import React, { useState } from 'react';
import {
    Chart as ChartJS,
    RadialLinearScale,
    PointElement,
    LineElement,
    Filler,
    Tooltip,
    Legend,
} from 'chart.js';
import { Radar } from 'react-chartjs-2';
import type { PerformanceData, RadarGridData } from '../types';
import { processRadarGridData } from './charts/chartProcessors';
import { useThemeColors } from '../hooks/useThemeColors';
import { chartConfig } from '../services/config';
import { Target } from 'lucide-react';

ChartJS.register(
    RadialLinearScale,
    PointElement,
    LineElement,
    Filler,
    Tooltip,
    Legend
);

interface PerformanceRadarGridProps {
    data: PerformanceData[];
    isMaximized?: boolean;
    className?: string;
}

const PerformanceRadarGrid: React.FC<PerformanceRadarGridProps> = ({
    data,
    isMaximized = false,
    className = '',
}) => {
    const themeColors = useThemeColors();
    const [hoveredPool, setHoveredPool] = useState<string | null>(null);
    const [selectedHost, setSelectedHost] = useState<string | null>(null);

    // Process data for radar grid
    const radarGridData = processRadarGridData(
        data,
        chartConfig.colors.primary,
        { sortBy: 'name', sortOrder: 'asc', groupBy: 'none' }
    );

    const radarLabels = [
        'IOPS',
        'Latency',
        'Bandwidth',
        'P95 Latency',
        'P99 Latency',
        'Consistency'
    ];

    const createRadarChart = (hostData: RadarGridData) => {
        const datasets = hostData.pools.map((pool) => ({
            label: pool.poolName,
            data: [
                pool.metrics.iops,
                pool.metrics.latency,
                pool.metrics.bandwidth,
                pool.metrics.p95_latency,
                pool.metrics.p99_latency,
                pool.metrics.consistency
            ],
            backgroundColor: pool.color.replace('1)', '0.2)'),
            borderColor: pool.color,
            borderWidth: hoveredPool === `${hostData.hostname}-${pool.poolName}` ? 3 : 2,
            pointBackgroundColor: pool.color,
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: pool.color,
            pointRadius: hoveredPool === `${hostData.hostname}-${pool.poolName}` ? 6 : 4,
            pointHoverRadius: 8,
        }));

        const options = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom' as const,
                    labels: {
                        color: themeColors.chart.text,
                        usePointStyle: true,
                        padding: 15,
                        font: {
                            size: 11,
                        },
                    },
                },
                tooltip: {
                    backgroundColor: themeColors.chart.tooltipBg,
                    titleColor: themeColors.text.primary,
                    bodyColor: themeColors.text.secondary,
                    borderColor: themeColors.chart.tooltipBorder,
                    borderWidth: 1,
                    cornerRadius: 8,
                    padding: 12,
                    callbacks: {
                        title: (context: any) => {
                            const poolLabel = context[0].dataset.label || '';
                            const metricLabel = context[0].label || '';
                            return `${hostData.hostname} - ${poolLabel} - ${metricLabel}`;
                        },
                        label: (context: any) => {
                            const score = context.parsed.r.toFixed(1);
                            const metricName = radarLabels[context.dataIndex];
                            return [
                                `${metricName}: ${score}%`,
                                `Protocol: ${hostData.protocol}`,
                                `Host: ${hostData.hostname}`,
                            ];
                        }
                    }
                },
            },
            scales: {
                r: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        color: themeColors.chart.text,
                        stepSize: 25,
                        callback: function(value: any) {
                            return value + '%';
                        },
                        font: {
                            size: 10,
                        },
                    },
                    grid: {
                        color: themeColors.chart.grid,
                    },
                    angleLines: {
                        color: themeColors.chart.grid,
                    },
                    pointLabels: {
                        color: themeColors.chart.text,
                        font: {
                            size: 11,
                        },
                    }
                }
            },
            interaction: {
                intersect: false,
            },
            animation: {
                duration: 800,
                easing: 'easeOutQuart' as const,
            },
            onHover: (_event: any, activeElements: any) => {
                if (activeElements.length > 0) {
                    const poolName = datasets[activeElements[0].datasetIndex].label;
                    setHoveredPool(`${hostData.hostname}-${poolName}`);
                } else {
                    setHoveredPool(null);
                }
            },
        };

        return (
            <div
                key={hostData.hostname}
                className={`theme-card rounded-lg border ${
                    selectedHost === hostData.hostname ? 'ring-2 ring-blue-500' : ''
                } ${hoveredPool?.startsWith(hostData.hostname) ? 'shadow-lg' : 'shadow-md'}`}
                onClick={() => setSelectedHost(selectedHost === hostData.hostname ? null : hostData.hostname)}
            >
                <div className="p-4 border-b theme-border-primary">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold theme-text-primary flex items-center gap-2">
                            <Target size={18} />
                            {hostData.hostname}
                        </h3>
                        <div className="text-sm theme-text-secondary">
                            {hostData.protocol} • {hostData.pools.length} pools
                        </div>
                    </div>
                </div>
                <div className="p-4">
                    <div className="h-[300px]">
                        <Radar
                            data={{ labels: radarLabels, datasets }}
                            options={options}
                        />
                    </div>
                </div>
            </div>
        );
    };

    if (radarGridData.length === 0) {
        return (
            <div className={`theme-card rounded-lg shadow-md border ${className}`}>
                <div className="p-8 text-center">
                    <Target size={48} className="mx-auto mb-4 theme-text-secondary" />
                    <h3 className="text-lg font-semibold theme-text-primary mb-2">
                        No Performance Data Available
                    </h3>
                    <p className="theme-text-secondary">
                        Select test runs with hostname and drive model data to view radar grid
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className={`${className}`}>
            <div className="mb-6">
                <h2 className="text-2xl font-bold theme-text-primary mb-2">
                    Performance Efficiency Radar Grid
                </h2>
                <p className="theme-text-secondary">
                    Multi-dimensional performance comparison across hosts and storage pools. 
                    Each radar shows normalized performance metrics (0-100%) for easy comparison.
                </p>
            </div>
            
            <div className={`grid gap-6 ${
                isMaximized 
                    ? 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3' 
                    : 'grid-cols-1 lg:grid-cols-2'
            }`}>
                {radarGridData.map((hostData, index) => (
                    <div key={index}>
                        {createRadarChart(hostData)}
                    </div>
                ))}
            </div>
            
            {/* Legend for metrics */}
            <div className="mt-6 p-4 theme-card rounded-lg border">
                <h4 className="text-lg font-semibold theme-text-primary mb-3">
                    Performance Metrics Legend
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                        <strong className="theme-text-primary">IOPS:</strong>
                        <span className="theme-text-secondary ml-2">Input/Output Operations Per Second</span>
                    </div>
                    <div>
                        <strong className="theme-text-primary">Latency:</strong>
                        <span className="theme-text-secondary ml-2">Average response time (inverted - lower is better)</span>
                    </div>
                    <div>
                        <strong className="theme-text-primary">Bandwidth:</strong>
                        <span className="theme-text-secondary ml-2">Data transfer rate (MB/s)</span>
                    </div>
                    <div>
                        <strong className="theme-text-primary">P95 Latency:</strong>
                        <span className="theme-text-secondary ml-2">95th percentile latency (inverted)</span>
                    </div>
                    <div>
                        <strong className="theme-text-primary">P99 Latency:</strong>
                        <span className="theme-text-secondary ml-2">99th percentile latency (inverted)</span>
                    </div>
                    <div>
                        <strong className="theme-text-primary">Consistency:</strong>
                        <span className="theme-text-secondary ml-2">Performance stability (lower variation = higher score)</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PerformanceRadarGrid;