import React from 'react';
import {
    Chart as ChartJS,
    LinearScale,
    PointElement,
    LineElement,
    Tooltip,
    Legend,
} from 'chart.js';
import { Scatter } from 'react-chartjs-2';
import type { DriveAnalysis } from '../../services/api/hostAnalysis';
import { useThemeColors } from '../../hooks/useThemeColors';

ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Legend);

interface PerformanceScatterPlotProps {
    drives: DriveAnalysis[];
}

const PerformanceScatterPlot: React.FC<PerformanceScatterPlotProps> = ({ drives }) => {
    const themeColors = useThemeColors();

    const colors = [
        'rgba(59, 130, 246, 0.8)',   // blue
        'rgba(16, 185, 129, 0.8)',   // green
        'rgba(245, 101, 101, 0.8)',  // red
        'rgba(139, 92, 246, 0.8)',   // purple
        'rgba(245, 158, 11, 0.8)',   // yellow
        'rgba(236, 72, 153, 0.8)',   // pink
    ];

    // Create datasets for each drive
    const datasets = drives.map((drive, index) => {
        const validConfigs = drive.configurations.filter(c => 
            c.iops !== null && c.avg_latency !== null && 
            c.iops !== undefined && c.avg_latency !== undefined &&
            c.iops > 0 && c.avg_latency > 0
        );

        const data = validConfigs.map(config => ({
            x: config.avg_latency || 0,
            y: config.iops || 0,
            blockSize: config.block_size,
            pattern: config.read_write_pattern,
            queueDepth: config.queue_depth,
            bandwidth: config.bandwidth,
            p95_latency: config.p95_latency,
            p99_latency: config.p99_latency,
            timestamp: config.timestamp,
            driveType: drive.drive_type,
            protocol: drive.protocol
        }));

        return {
            label: drive.drive_model,
            data,
            backgroundColor: colors[index % colors.length],
            borderColor: colors[index % colors.length].replace('0.8', '1'),
            pointRadius: 6,
            pointHoverRadius: 8,
        };
    });

    const chartData = {
        datasets
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top' as const,
                labels: {
                    color: themeColors.chart.text,
                    usePointStyle: true,
                    padding: 20,
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
                        const point = context[0].raw;
                        return `${context[0].dataset.label} (${point.driveType} - ${point.protocol})`;
                    },
                    label: (context: any) => {
                        const point = context.raw;
                        return [
                            '',
                            '🔧 Test Configuration:',
                            `   Block Size: ${point.blockSize}`,
                            `   Pattern: ${point.pattern}`,
                            `   Queue Depth: ${point.queueDepth}`,
                            '',
                            '📈 Performance Metrics:',
                            `   IOPS: ${point.y.toFixed(0)}`,
                            `   Avg Latency: ${point.x.toFixed(2)}ms`,
                            `   Bandwidth: ${point.bandwidth?.toFixed(1) || 'N/A'} MB/s`,
                            `   95th Percentile: ${point.p95_latency !== null && point.p95_latency !== undefined ? point.p95_latency.toFixed(2) + 'ms' : 'N/A'}`,
                            `   99th Percentile: ${point.p99_latency !== null && point.p99_latency !== undefined ? point.p99_latency.toFixed(2) + 'ms' : 'N/A'}`,
                            '',
                            '🕒 Test Date:',
                            `   ${new Date(point.timestamp).toLocaleDateString()} ${new Date(point.timestamp).toLocaleTimeString()}`
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
                    text: 'Average Latency (ms)',
                    color: themeColors.chart.text,
                    font: {
                        size: 14,
                        weight: 'bold' as const,
                    },
                },
                ticks: {
                    color: themeColors.chart.text,
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
                        size: 14,
                        weight: 'bold' as const,
                    },
                },
                ticks: {
                    color: themeColors.chart.text,
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
            duration: 1000,
            easing: 'easeOutQuart' as const,
        },
    };

    // Calculate efficiency zones
    const allPoints = drives.flatMap(drive => 
        drive.configurations
            .filter(c => c.iops !== null && c.avg_latency !== null && 
                       c.iops !== undefined && c.avg_latency !== undefined &&
                       c.iops > 0 && c.avg_latency > 0)
            .map(c => ({ iops: c.iops || 0, latency: c.avg_latency || 0 }))
    );

    const avgIOPS = allPoints.reduce((sum, p) => sum + p.iops, 0) / allPoints.length;
    const avgLatency = allPoints.reduce((sum, p) => sum + p.latency, 0) / allPoints.length;

    return (
        <div className="w-full h-[600px]">
            <div className="mb-4">
                <h4 className="text-lg font-semibold theme-text-primary mb-2">
                    IOPS vs Latency Analysis
                </h4>
                <p className="text-sm theme-text-secondary mb-4">
                    Performance efficiency scatter plot - closer to top-left is better (high IOPS, low latency)
                </p>
                
                {/* Performance zones legend */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-xs">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                        <span className="theme-text-secondary">High Performance Zone</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
                        <span className="theme-text-secondary">Balanced Zone</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-orange-500 rounded-full"></div>
                        <span className="theme-text-secondary">High Latency Zone</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                        <span className="theme-text-secondary">Low Performance Zone</span>
                    </div>
                </div>
            </div>
            
            <div className="h-[500px] relative">
                <Scatter data={chartData} options={options} />
                
                {/* Performance zone indicators */}
                <div className="absolute top-4 right-4 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border">
                    <div className="text-xs theme-text-secondary space-y-1">
                        <div>Avg IOPS: <span className="font-medium theme-text-primary">{avgIOPS.toFixed(0)}</span></div>
                        <div>Avg Latency: <span className="font-medium theme-text-primary">{avgLatency.toFixed(2)}ms</span></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PerformanceScatterPlot;