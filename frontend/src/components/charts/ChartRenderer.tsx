// Chart rendering component with Chart.js integration
import { forwardRef, useMemo } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    Title,
    Tooltip,
    Legend,
    TimeScale,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import type { ChartTemplate } from '../../types';
import { useThemeColors } from '../../hooks/useThemeColors';
import type { ChartData as CustomChartData, ChartDataset } from './chartProcessors';

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    Title,
    Tooltip,
    Legend,
    TimeScale,
);

export interface ChartRendererProps {
    chartData: CustomChartData;
    template: ChartTemplate;
    isMaximized?: boolean;
    onSeriesToggle?: (label: string) => void;
    visibleSeries?: Set<string>;
    className?: string;
}

const ChartRenderer = forwardRef<any, ChartRendererProps>(({
    chartData,
    template,
    isMaximized = false,
    onSeriesToggle,
    visibleSeries,
    className = '',
}, ref) => {
    const themeColors = useThemeColors();

    // Filter datasets based on visible series
    const filteredChartData = useMemo(() => {
        if (!visibleSeries || visibleSeries.size === 0) {
            return chartData;
        }

        return {
            ...chartData,
            datasets: chartData.datasets.filter((dataset: ChartDataset) => 
                visibleSeries.has(dataset.label)
            ),
        };
    }, [chartData, visibleSeries]);

    // Chart options based on template and theme
    const chartOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top' as const,
                onClick: (_e: any, legendItem: any) => {
                    onSeriesToggle?.(legendItem.text);
                },
                labels: {
                    color: themeColors.chart.text,
                    usePointStyle: true,
                    padding: 20,
                },
            },
            title: {
                display: true,
                text: template.name,
                font: {
                    size: 16,
                    weight: 'bold' as const,
                },
                color: themeColors.chart.text,
                padding: {
                    top: 10,
                    bottom: 30,
                },
            },
            tooltip: {
                mode: 'index' as const,
                intersect: false,
                backgroundColor: themeColors.chart.tooltipBg,
                titleColor: themeColors.text.primary,
                bodyColor: themeColors.text.secondary,
                borderColor: themeColors.chart.tooltipBorder,
                borderWidth: 1,
                cornerRadius: 8,
                padding: 12,
                callbacks: {
                    title: (context: any) => {
                        // Get the first data point to extract common information
                        const firstContext = context[0];
                        const dataIndex = firstContext.dataIndex;
                        const originalData = firstContext.dataset.originalData?.[dataIndex];
                        
                        if (!originalData) {
                            return firstContext.label || '';
                        }
                        
                        // Build title with common information
                        const titleParts = [];
                        
                        // Add hostname if available
                        if (originalData.hostname) {
                            titleParts.push(originalData.hostname);
                        }
                        
                        // Add drive model and block size
                        titleParts.push(`${originalData.drive_model} - ${originalData.block_size}`);
                        
                        // Add pattern if available
                        if (originalData.read_write_pattern) {
                            titleParts.push(originalData.read_write_pattern);
                        }
                        
                        // Add protocol if available
                        if (originalData.protocol) {
                            titleParts.push(originalData.protocol);
                        }
                        
                        // Add queue depth if available
                        if (originalData.queue_depth) {
                            titleParts.push(`QD: ${originalData.queue_depth}`);
                        }
                        
                        // Add drive type if available
                        if (originalData.drive_type) {
                            titleParts.push(originalData.drive_type);
                        }
                        
                        // Add timestamp if available
                        if (originalData.timestamp) {
                            const date = new Date(originalData.timestamp);
                            titleParts.push(`${date.toLocaleDateString()} ${date.toLocaleTimeString()}`);
                        }
                        
                        return titleParts.join(' | ');
                    },
                    label: (context: any) => {
                        const label = context.dataset.label || '';
                        const value = context.formattedValue;
                        const dataIndex = context.dataIndex;
                        
                        // Get original data for additional details
                        const originalData = context.dataset.originalData?.[dataIndex];
                        
                        // Add units based on metric type
                        let formattedValue = value;
                        if (label.toLowerCase().includes('latency')) {
                            formattedValue = `${value} ms`;
                        } else if (label.toLowerCase().includes('bandwidth') || label.toLowerCase().includes('throughput')) {
                            formattedValue = `${value} MB/s`;
                        } else if (label.toLowerCase().includes('iops')) {
                            formattedValue = `${value} IOPS`;
                        }
                        
                        // Build enhanced label with metric-specific details only
                        let enhancedLabel = `${label}: ${formattedValue}`;
                        
                        // Add metric-specific details if available
                        if (originalData && originalData.metrics) {
                            const additionalMetrics = [];
                            
                            // Add latency percentiles only for latency metrics
                            if (label.toLowerCase().includes('latency')) {
                                if (originalData.metrics.p95_latency?.value) {
                                    additionalMetrics.push(`P95: ${originalData.metrics.p95_latency.value.toFixed(2)}ms`);
                                }
                                
                                if (originalData.metrics.p99_latency?.value) {
                                    additionalMetrics.push(`P99: ${originalData.metrics.p99_latency.value.toFixed(2)}ms`);
                                }
                                
                                if (originalData.metrics.min_latency?.value) {
                                    additionalMetrics.push(`Min: ${originalData.metrics.min_latency.value.toFixed(2)}ms`);
                                }
                                
                                if (originalData.metrics.max_latency?.value) {
                                    additionalMetrics.push(`Max: ${originalData.metrics.max_latency.value.toFixed(2)}ms`);
                                }
                            }
                            
                            // Add CPU usage for all metrics
                            if ((originalData as any).usr_cpu !== undefined) {
                                additionalMetrics.push(`CPU User: ${(originalData as any).usr_cpu.toFixed(1)}%`);
                            }
                            
                            if ((originalData as any).sys_cpu !== undefined) {
                                additionalMetrics.push(`CPU Sys: ${(originalData as any).sys_cpu.toFixed(1)}%`);
                            }
                            
                            // Add test configuration details
                            if ((originalData as any).duration) {
                                additionalMetrics.push(`Duration: ${(originalData as any).duration}s`);
                            }
                            
                            if ((originalData as any).num_jobs) {
                                additionalMetrics.push(`Jobs: ${(originalData as any).num_jobs}`);
                            }
                            
                            if ((originalData as any).iodepth) {
                                additionalMetrics.push(`IO Depth: ${(originalData as any).iodepth}`);
                            }
                            
                            if ((originalData as any).test_size) {
                                additionalMetrics.push(`Test Size: ${(originalData as any).test_size}`);
                            }
                            
                            if (additionalMetrics.length > 0) {
                                enhancedLabel += `\n${additionalMetrics.join(' | ')}`;
                            }
                        }
                        
                        return enhancedLabel;
                    },
                },
            },
        },
        scales: getScalesForTemplate(template, themeColors),
        interaction: {
            mode: 'nearest' as const,
            axis: 'x' as const,
            intersect: false,
        },
        animation: {
            duration: 750,
            easing: 'easeInOutQuart' as const,
        },
    }), [template, themeColors, onSeriesToggle]);

    // Select appropriate chart component
    const ChartComponent = template.chartType === 'line' ? Line : Bar;

    return (
        <div className={`${isMaximized ? 'h-[calc(100vh-280px)]' : 'h-[600px]'} ${className}`}>
            <ChartComponent
                ref={ref}
                data={filteredChartData as any}
                options={chartOptions}
            />
        </div>
    );
});

ChartRenderer.displayName = 'ChartRenderer';

// Chart scales configuration based on template
const getScalesForTemplate = (template: ChartTemplate, themeColors: any) => {
    const baseScaleConfig = {
        grid: {
            color: themeColors.chart.grid,
            borderColor: themeColors.chart.grid,
        },
        ticks: {
            color: themeColors.chart.text,
        },
        title: {
            color: themeColors.chart.text,
            font: {
                size: 12,
                weight: 'bold' as const,
            },
        },
    };

    switch (template.id) {
        case 'performance-overview':
            return {
                x: {
                    ...baseScaleConfig,
                    title: {
                        ...baseScaleConfig.title,
                        display: true,
                        text: 'Test Configurations',
                    },
                },
                y: {
                    ...baseScaleConfig,
                    type: 'linear' as const,
                    display: true,
                    position: 'left' as const,
                    title: {
                        ...baseScaleConfig.title,
                        display: true,
                        text: 'IOPS',
                    },
                },
                y1: {
                    ...baseScaleConfig,
                    type: 'linear' as const,
                    display: true,
                    position: 'right' as const,
                    title: {
                        ...baseScaleConfig.title,
                        display: true,
                        text: 'Latency (ms)',
                    },
                    grid: {
                        drawOnChartArea: false,
                    },
                },
                y2: {
                    ...baseScaleConfig,
                    type: 'linear' as const,
                    display: false,
                    position: 'right' as const,
                },
            };

        case 'block-size-impact':
            return {
                x: {
                    ...baseScaleConfig,
                    title: {
                        ...baseScaleConfig.title,
                        display: true,
                        text: 'Block Size',
                    },
                },
                y: {
                    ...baseScaleConfig,
                    title: {
                        ...baseScaleConfig.title,
                        display: true,
                        text: 'IOPS',
                    },
                },
                y1: {
                    ...baseScaleConfig,
                    type: 'linear' as const,
                    display: true,
                    position: 'right' as const,
                    title: {
                        ...baseScaleConfig.title,
                        display: true,
                        text: 'Bandwidth (MB/s)',
                    },
                    grid: {
                        drawOnChartArea: false,
                    },
                },
            };

        case 'iops-latency-dual':
            return {
                x: {
                    ...baseScaleConfig,
                    title: {
                        ...baseScaleConfig.title,
                        display: true,
                        text: 'Test Configuration',
                    },
                },
                y: {
                    ...baseScaleConfig,
                    title: {
                        ...baseScaleConfig.title,
                        display: true,
                        text: 'IOPS',
                    },
                },
                y1: {
                    ...baseScaleConfig,
                    type: 'linear' as const,
                    display: true,
                    position: 'right' as const,
                    title: {
                        ...baseScaleConfig.title,
                        display: true,
                        text: 'Latency (ms)',
                    },
                    grid: {
                        drawOnChartArea: false,
                    },
                },
            };

        default:
            return {
                x: {
                    ...baseScaleConfig,
                    title: {
                        ...baseScaleConfig.title,
                        display: true,
                        text: template.xAxis || 'X Axis',
                    },
                },
                y: {
                    ...baseScaleConfig,
                    beginAtZero: true,
                    title: {
                        ...baseScaleConfig.title,
                        display: true,
                        text: template.yAxis || 'Y Axis',
                    },
                },
            };
    }
};

export default ChartRenderer;