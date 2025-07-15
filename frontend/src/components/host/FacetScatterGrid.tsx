import React, { useState } from 'react';
import {
    Chart as ChartJS,
    LinearScale,
    PointElement,
    LineElement,
    Tooltip,
    Legend,
    Title,
} from 'chart.js';
import { Scatter } from 'react-chartjs-2';
import type { DriveAnalysis } from '../../services/api/hostAnalysis';
import { useThemeColors } from '../../hooks/useThemeColors';
import { generateUniqueColorsForChart } from '../../utils/colorMapping';

ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Legend, Title);

export interface FacetScatterGridProps {
    data: DriveAnalysis[];
}

type FacetMode = 'pattern' | 'host' | 'drive';

const FacetScatterGrid: React.FC<FacetScatterGridProps> = ({ data }) => {
    const themeColors = useThemeColors();
    const [facetMode, setFacetMode] = useState<FacetMode>('pattern');

    // Get all configurations from all drives
    const allConfigs = data.flatMap(drive => 
        drive.configurations
            .filter(config => 
                config.iops !== null && config.avg_latency !== null && 
                config.iops !== undefined && config.avg_latency !== undefined &&
                config.iops > 0 && config.avg_latency > 0
            )
            .map(config => ({
                ...config,
                drive_model: drive.drive_model,
                drive_type: drive.drive_type,
                protocol: drive.protocol,
                hostname: drive.hostname
            }))
    );

    // Group data by facet mode
    const getFacets = () => {
        switch (facetMode) {
            case 'pattern':
                return Array.from(new Set(allConfigs.map(c => c.read_write_pattern)));
            case 'host':
                return Array.from(new Set(allConfigs.map(c => c.hostname)));
            case 'drive':
                return Array.from(new Set(allConfigs.map(c => c.drive_model)));
            default:
                return [];
        }
    };

    const facets = getFacets();

    // Generate colors based on hostname and drive model
    const getColorsForFacet = (facetConfigs: any[]) => {
        const uniqueDrives = Array.from(new Set(facetConfigs.map(config => 
            `${config.hostname}_${config.drive_model}`
        ))).map(combo => {
            const [hostname, driveModel] = combo.split('_');
            return { hostname, driveModel };
        });
        
        return generateUniqueColorsForChart(uniqueDrives, 'primary');
    };

    // Create chart for each facet
    const createChartForFacet = (facetValue: string) => {
        const facetConfigs = allConfigs.filter(config => {
            switch (facetMode) {
                case 'pattern':
                    return config.read_write_pattern === facetValue;
                case 'host':
                    return config.hostname === facetValue;
                case 'drive':
                    return config.drive_model === facetValue;
                default:
                    return false;
            }
        });

        // Group by secondary dimension for color coding
        const getSecondaryGroups = () => {
            switch (facetMode) {
                case 'pattern':
                    // Group by drive model when faceting by pattern
                    return Array.from(new Set(facetConfigs.map(c => c.drive_model)));
                case 'host':
                    // Group by read/write pattern when faceting by host
                    return Array.from(new Set(facetConfigs.map(c => c.read_write_pattern)));
                case 'drive':
                    // Group by read/write pattern when faceting by drive
                    return Array.from(new Set(facetConfigs.map(c => c.read_write_pattern)));
                default:
                    return [];
            }
        };

        const secondaryGroups = getSecondaryGroups();
        const colors = getColorsForFacet(facetConfigs);

        const datasets = secondaryGroups.map((group, index) => {
            const groupConfigs = facetConfigs.filter(config => {
                switch (facetMode) {
                    case 'pattern':
                        return config.drive_model === group;
                    case 'host':
                        return config.read_write_pattern === group;
                    case 'drive':
                        return config.read_write_pattern === group;
                    default:
                        return false;
                }
            });

            const data = groupConfigs.map(config => ({
                x: config.avg_latency || 0,
                y: config.iops || 0,
                blockSize: config.block_size,
                pattern: config.read_write_pattern,
                queueDepth: config.queue_depth,
                bandwidth: config.bandwidth,
                p95_latency: config.p95_latency,
                p99_latency: config.p99_latency,
                timestamp: config.timestamp,
                driveModel: config.drive_model,
                driveType: config.drive_type,
                protocol: config.protocol,
                hostname: config.hostname
            }));

            // Use color based on index, with fallback
            const backgroundColor = colors[index % colors.length] || 'rgba(59, 130, 246, 0.8)';
            const borderColor = backgroundColor.replace('0.8', '1.0');

            return {
                label: group,
                data,
                backgroundColor,
                borderColor,
                pointRadius: 4,
                pointHoverRadius: 6,
            };
        });

        const chartData = { datasets };

        const options = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top' as const,
                    labels: {
                        color: themeColors.chart.text,
                        usePointStyle: true,
                        padding: 8,
                        font: {
                            size: 10,
                        },
                    },
                },
                title: {
                    display: true,
                    text: facetValue,
                    color: themeColors.chart.text,
                    font: {
                        size: 12,
                        weight: 'bold' as const,
                    },
                    padding: {
                        top: 0,
                        bottom: 10,
                    },
                },
                tooltip: {
                    backgroundColor: themeColors.chart.tooltipBg,
                    titleColor: themeColors.text.primary,
                    bodyColor: themeColors.text.secondary,
                    borderColor: themeColors.chart.tooltipBorder,
                    borderWidth: 1,
                    cornerRadius: 6,
                    padding: 8,
                    callbacks: {
                        title: (context: any) => {
                            const point = context[0].raw;
                            return `${point.driveModel} (${point.hostname})`;
                        },
                        label: (context: any) => {
                            const point = context.raw;
                            return [
                                '',
                                `IOPS: ${point.y.toFixed(0)}`,
                                `Latency: ${point.x.toFixed(2)}ms`,
                                `Pattern: ${point.pattern}`,
                                `Block Size: ${point.blockSize}`,
                                `Queue Depth: ${point.queueDepth}`,
                                `Bandwidth: ${point.bandwidth?.toFixed(1) || 'N/A'} MB/s`,
                            ];
                        }
                    }
                },
            },
            scales: {
                x: {
                    type: 'linear' as const,
                    position: 'bottom' as const,
                    title: {
                        display: true,
                        text: 'Latency (ms)',
                        color: themeColors.chart.text,
                        font: {
                            size: 10,
                        },
                    },
                    ticks: {
                        color: themeColors.chart.text,
                        font: {
                            size: 9,
                        },
                    },
                    grid: {
                        color: themeColors.chart.grid,
                    },
                },
                y: {
                    type: 'linear' as const,
                    title: {
                        display: true,
                        text: 'IOPS',
                        color: themeColors.chart.text,
                        font: {
                            size: 10,
                        },
                    },
                    ticks: {
                        color: themeColors.chart.text,
                        font: {
                            size: 9,
                        },
                    },
                    grid: {
                        color: themeColors.chart.grid,
                    },
                }
            },
            interaction: {
                intersect: false,
            },
            animation: {
                duration: 500,
                easing: 'easeOutQuart' as const,
            },
        };

        return { chartData, options };
    };

    if (facets.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <p className="theme-text-secondary">No data available for faceted scatter plots</p>
            </div>
        );
    }

    // Calculate grid layout based on number of facets
    const getGridCols = () => {
        if (facets.length === 1) return 'grid-cols-1';
        if (facets.length === 2) return 'grid-cols-1 lg:grid-cols-2';
        if (facets.length <= 4) return 'grid-cols-1 md:grid-cols-2';
        if (facets.length <= 6) return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
        return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
    };

    return (
        <div className="w-full space-y-6">
            {/* Header with facet mode selector */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h3 className="text-lg font-semibold theme-text-primary">
                        Faceted IOPS vs Latency Analysis
                    </h3>
                    <p className="text-sm theme-text-secondary mt-1">
                        Compare performance patterns across different {facetMode}s
                    </p>
                </div>
                
                <div className="flex items-center gap-2">
                    <span className="text-sm theme-text-secondary">Facet by:</span>
                    <select
                        value={facetMode}
                        onChange={(e) => setFacetMode(e.target.value as FacetMode)}
                        className="px-3 py-1 text-sm border rounded-md theme-bg-primary theme-text-primary theme-border focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value="pattern">Read/Write Pattern</option>
                        <option value="host">Host</option>
                        <option value="drive">Drive Model</option>
                    </select>
                </div>
            </div>

            {/* Grid of scatter plots */}
            <div className={`grid ${getGridCols()} gap-6`}>
                {facets.map(facetValue => {
                    const { chartData, options } = createChartForFacet(facetValue);
                    
                    return (
                        <div key={facetValue} className="theme-bg-primary rounded-lg border theme-border p-4">
                            <div className="h-80">
                                <Scatter data={chartData} options={options} />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Summary stats */}
            <div className="mt-6 p-4 theme-bg-primary rounded-lg border theme-border">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                        <span className="theme-text-secondary">Total Facets:</span>
                        <span className="ml-2 font-medium theme-text-primary">{facets.length}</span>
                    </div>
                    <div>
                        <span className="theme-text-secondary">Total Data Points:</span>
                        <span className="ml-2 font-medium theme-text-primary">{allConfigs.length}</span>
                    </div>
                    <div>
                        <span className="theme-text-secondary">Avg IOPS:</span>
                        <span className="ml-2 font-medium theme-text-primary">
                            {(allConfigs.reduce((sum, c) => sum + (c.iops || 0), 0) / allConfigs.length).toFixed(0)}
                        </span>
                    </div>
                    <div>
                        <span className="theme-text-secondary">Avg Latency:</span>
                        <span className="ml-2 font-medium theme-text-primary">
                            {(allConfigs.reduce((sum, c) => sum + (c.avg_latency || 0), 0) / allConfigs.length).toFixed(2)}ms
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FacetScatterGrid;
