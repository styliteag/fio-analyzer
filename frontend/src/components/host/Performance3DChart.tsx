import React, { useMemo } from 'react';
import type { DriveAnalysis } from '../../services/api/hostAnalysis';

interface Performance3DChartProps {
    drives: DriveAnalysis[];
}

interface PerformancePoint {
    x: number;
    y: number;
    z: number;
    drive: string;
    blockSize: string;
    pattern: string;
    queueDepth: number;
    color: string;
}

const Performance3DChart: React.FC<Performance3DChartProps> = ({ drives }) => {
    const colors = [
        '#3B82F6', // blue
        '#10B981', // green
        '#F56565', // red
        '#8B5CF6', // purple
        '#F59E0B', // yellow
        '#EC4899', // pink
    ];

    // Prepare 3D data points
    const points = useMemo(() => {
        const allPoints: PerformancePoint[] = [];
        
        drives.forEach((drive, driveIndex) => {
            const validConfigs = drive.configurations.filter(c => 
                c.iops !== null && c.avg_latency !== null && c.bandwidth !== null &&
                c.iops !== undefined && c.avg_latency !== undefined && c.bandwidth !== undefined &&
                c.iops > 0 && c.avg_latency > 0 && c.bandwidth > 0
            );

            validConfigs.forEach(config => {
                allPoints.push({
                    x: config.iops || 0,
                    y: config.avg_latency || 0,
                    z: config.bandwidth || 0,
                    drive: drive.drive_model,
                    blockSize: config.block_size,
                    pattern: config.read_write_pattern,
                    queueDepth: config.queue_depth,
                    color: colors[driveIndex % colors.length]
                });
            });
        });

        return allPoints;
    }, [drives]);

    // Calculate ranges for normalization
    const ranges = useMemo(() => {
        if (points.length === 0) return { x: [0, 1] as [number, number], y: [0, 1] as [number, number], z: [0, 1] as [number, number] };

        const xValues = points.map(p => p.x);
        const yValues = points.map(p => p.y);
        const zValues = points.map(p => p.z);

        return {
            x: [Math.min(...xValues), Math.max(...xValues)] as [number, number],
            y: [Math.min(...yValues), Math.max(...yValues)] as [number, number],
            z: [Math.min(...zValues), Math.max(...zValues)] as [number, number]
        };
    }, [points]);

    // Normalize values to 0-300px range for display
    const normalizeValue = (value: number, range: [number, number], scale: number = 300) => {
        return ((value - range[0]) / (range[1] - range[0])) * scale;
    };

    // 3D projection (simple isometric projection)
    const project3D = (x: number, y: number, z: number) => {
        const cos30 = Math.cos(Math.PI / 6);
        const sin30 = Math.sin(Math.PI / 6);
        
        return {
            x: (x - z) * cos30,
            y: (x + z) * sin30 - y
        };
    };

    const chartWidth = 400;
    const chartHeight = 400;
    const offsetX = chartWidth / 2;
    const offsetY = chartHeight / 2;

    return (
        <div className="w-full">
            <div className="mb-4">
                <h4 className="text-lg font-semibold theme-text-primary mb-2">
                    3D Performance Visualization
                </h4>
                <p className="text-sm theme-text-secondary mb-4">
                    Three-dimensional view: IOPS (width), Latency (height), Bandwidth (depth)
                </p>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                {/* 3D Chart */}
                <div className="flex-1">
                    <div className="relative bg-gray-50 dark:bg-gray-900 rounded-lg p-4" style={{ height: '450px' }}>
                        <svg 
                            width="100%" 
                            height="100%" 
                            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                            className="overflow-visible"
                        >
                            {/* Grid lines */}
                            <defs>
                                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.3"/>
                                </pattern>
                            </defs>
                            <rect width="100%" height="100%" fill="url(#grid)" className="theme-text-secondary" />

                            {/* Axes */}
                            <g className="theme-text-secondary" strokeWidth="2">
                                {/* X axis (IOPS) */}
                                <line x1={offsetX} y1={offsetY} x2={offsetX + 150} y2={offsetY - 87} stroke="currentColor" />
                                <text x={offsetX + 160} y={offsetY - 80} fontSize="12" fill="currentColor">IOPS</text>
                                
                                {/* Y axis (Latency) */}
                                <line x1={offsetX} y1={offsetY} x2={offsetX} y2={offsetY - 150} stroke="currentColor" />
                                <text x={offsetX - 30} y={offsetY - 160} fontSize="12" fill="currentColor">Latency</text>
                                
                                {/* Z axis (Bandwidth) */}
                                <line x1={offsetX} y1={offsetY} x2={offsetX - 150} y2={offsetY - 87} stroke="currentColor" />
                                <text x={offsetX - 180} y={offsetY - 80} fontSize="12" fill="currentColor">Bandwidth</text>
                            </g>

                            {/* Data points */}
                            {points.map((point, index) => {
                                const normalizedX = normalizeValue(point.x, ranges.x, 150);
                                const normalizedY = normalizeValue(point.y, ranges.y, 150);
                                const normalizedZ = normalizeValue(point.z, ranges.z, 150);
                                
                                const projected = project3D(normalizedX, normalizedY, normalizedZ);
                                const x = offsetX + projected.x;
                                const y = offsetY - projected.y;
                                
                                // Point size based on performance score
                                const performanceScore = (point.x / ranges.x[1]) * (point.z / ranges.z[1]) / (point.y / ranges.y[1]);
                                const pointSize = Math.max(4, Math.min(12, performanceScore * 8));

                                return (
                                    <g key={index}>
                                        <circle
                                            cx={x}
                                            cy={y}
                                            r={pointSize}
                                            fill={point.color}
                                            opacity="0.7"
                                            stroke="#fff"
                                            strokeWidth="1"
                                            className="cursor-pointer hover:opacity-100 transition-opacity"
                                        >
                                            <title>
                                                {`${point.drive}\n${point.blockSize} ${point.pattern} QD${point.queueDepth}\nIOPS: ${point.x.toFixed(0)}\nLatency: ${point.y.toFixed(2)}ms\nBandwidth: ${point.z.toFixed(1)} MB/s`}
                                            </title>
                                        </circle>
                                    </g>
                                );
                            })}
                        </svg>

                        {/* Legend positioned over the chart */}
                        <div className="absolute top-4 right-4 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border max-w-xs">
                            <h5 className="text-sm font-medium theme-text-primary mb-2">Drives</h5>
                            <div className="space-y-1">
                                {drives.map((drive, index) => (
                                    <div key={drive.drive_model} className="flex items-center gap-2 text-xs">
                                        <div 
                                            className="w-3 h-3 rounded-full" 
                                            style={{ backgroundColor: colors[index % colors.length] }}
                                        ></div>
                                        <span className="theme-text-secondary truncate">{drive.drive_model}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Performance zones indicator */}
                        <div className="absolute bottom-4 left-4 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border">
                            <div className="text-xs theme-text-secondary space-y-1">
                                <div>Larger points = Better performance</div>
                                <div>Top-right-front = Ideal zone</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Performance Summary */}
                <div className="lg:w-80">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border">
                        <h5 className="text-lg font-medium theme-text-primary mb-4">Performance Summary</h5>
                        
                        <div className="space-y-4">
                            {drives.map((drive, index) => {
                                const drivePoints = points.filter(p => p.drive === drive.drive_model);
                                if (drivePoints.length === 0) return null;

                                const avgIOPS = drivePoints.reduce((sum, p) => sum + p.x, 0) / drivePoints.length;
                                const avgLatency = drivePoints.reduce((sum, p) => sum + p.y, 0) / drivePoints.length;
                                const avgBandwidth = drivePoints.reduce((sum, p) => sum + p.z, 0) / drivePoints.length;
                                const performanceScore = (avgIOPS * avgBandwidth) / (avgLatency * 1000);

                                return (
                                    <div key={drive.drive_model} className="border-l-4 pl-3" style={{ borderColor: colors[index % colors.length] }}>
                                        <h6 className="font-medium theme-text-primary text-sm">{drive.drive_model}</h6>
                                        <div className="mt-2 space-y-1 text-xs theme-text-secondary">
                                            <div>Avg IOPS: <span className="font-medium">{avgIOPS.toFixed(0)}</span></div>
                                            <div>Avg Latency: <span className="font-medium">{avgLatency.toFixed(2)}ms</span></div>
                                            <div>Avg Bandwidth: <span className="font-medium">{avgBandwidth.toFixed(1)} MB/s</span></div>
                                            <div>Score: <span className="font-medium">{performanceScore.toFixed(2)}</span></div>
                                            <div>Configs: <span className="font-medium">{drivePoints.length}</span></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
                            <h6 className="text-sm font-medium theme-text-primary mb-2">Top Configurations</h6>
                            <div className="space-y-2 text-xs">
                                {points
                                    .sort((a, b) => ((b.x * b.z) / b.y) - ((a.x * a.z) / a.y))
                                    .slice(0, 3)
                                    .map((point, index) => (
                                        <div key={index} className="bg-gray-50 dark:bg-gray-700 p-2 rounded">
                                            <div className="font-medium theme-text-primary">{point.drive}</div>
                                            <div className="theme-text-secondary">
                                                {point.blockSize} {point.pattern} QD{point.queueDepth}
                                            </div>
                                            <div className="theme-text-secondary">
                                                {point.x.toFixed(0)} IOPS, {point.y.toFixed(2)}ms, {point.z.toFixed(1)} MB/s
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Performance3DChart;