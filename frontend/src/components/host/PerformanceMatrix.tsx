import React from 'react';
import type { DriveAnalysis } from '../../services/api/hostAnalysis';
import { extractColorFromName } from '../../utils/colorMapping';

interface PerformanceMatrixProps {
    drives: DriveAnalysis[];
    metric: 'iops' | 'avg_latency' | 'bandwidth';
}

interface MatrixCell {
    value: number;
    configuration: string;
    drive: string;
    hostname: string;
    intensity: number;
    fullConfig?: {
        block_size: string;
        read_write_pattern: string;
        queue_depth: number;
        iops: number | null | undefined;
        avg_latency: number | null | undefined;
        bandwidth: number | null | undefined;
        p95_latency: number | null | undefined;
        p99_latency: number | null | undefined;
        timestamp: string;
    };
    driveInfo?: {
        drive_type: string;
        protocol: string;
    };
}

const PerformanceMatrix: React.FC<PerformanceMatrixProps> = ({ drives, metric }) => {
    const [hoveredCell, setHoveredCell] = React.useState<{ cell: MatrixCell; x: number; y: number } | null>(null);
    // Get all unique block sizes and patterns
    const allBlockSizes = [...new Set(
        drives.flatMap(drive => 
            drive.configurations.map(config => config.block_size)
        )
    )].sort();

    const allPatterns = [...new Set(
        drives.flatMap(drive => 
            drive.configurations.map(config => config.read_write_pattern)
        )
    )].sort();

    // Create matrix data
    const matrixData: MatrixCell[][] = [];
    const allValues: number[] = [];

    // Collect all values for normalization
    drives.forEach(drive => {
        drive.configurations.forEach(config => {
            const value = config[metric];
            if (value !== null && value !== undefined) {
                allValues.push(value);
            }
        });
    });

    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);

    // Build matrix
    allBlockSizes.forEach((blockSize, rowIndex) => {
        matrixData[rowIndex] = [];
        allPatterns.forEach((pattern, colIndex) => {
            // Find best value for this block size + pattern combination across all drives
            let bestValue = metric === 'avg_latency' ? Infinity : 0;
            let bestDrive = '';
            let bestHostname = '';
            let bestConfig = '';
            let bestFullConfig: any = null;
            let bestDriveInfo: any = null;

            drives.forEach(drive => {
                const config = drive.configurations.find(c => 
                    c.block_size === blockSize && c.read_write_pattern === pattern
                );
                
                if (config && config[metric] !== null && config[metric] !== undefined) {
                    const value = config[metric]!;
                    const isBetter = metric === 'avg_latency' ? value < bestValue : value > bestValue;
                    
                    if (isBetter) {
                        bestValue = value;
                        bestDrive = drive.drive_model;
                        bestHostname = drive.hostname;
                        bestConfig = `${blockSize} ${pattern} QD${config.queue_depth}`;
                        bestFullConfig = config;
                        bestDriveInfo = {
                            drive_type: drive.drive_type,
                            protocol: drive.protocol
                        };
                    }
                }
            });

            const intensity = bestValue === (metric === 'avg_latency' ? Infinity : 0) ? 0 :
                (bestValue - minValue) / (maxValue - minValue);

            matrixData[rowIndex][colIndex] = {
                value: bestValue === (metric === 'avg_latency' ? Infinity : 0) ? 0 : bestValue,
                configuration: bestConfig,
                drive: bestDrive,
                hostname: bestHostname,
                intensity: metric === 'avg_latency' ? 1 - intensity : intensity,
                fullConfig: bestFullConfig,
                driveInfo: bestDriveInfo
            };
        });
    });

    // This function is kept for potential future use
    // const getIntensityColor = (intensity: number): string => {
    //     if (intensity === 0) return 'bg-gray-100 dark:bg-gray-800';
    //     
    //     // Use different color schemes for different metrics
    //     if (metric === 'iops') {
    //         return `bg-blue-${Math.ceil(intensity * 500)} opacity-${Math.ceil(intensity * 100)}`;
    //     } else if (metric === 'avg_latency') {
    //         return `bg-red-${Math.ceil(intensity * 500)} opacity-${Math.ceil(intensity * 100)}`;
    //     } else {
    //         return `bg-green-${Math.ceil(intensity * 500)} opacity-${Math.ceil(intensity * 100)}`;
    //     }
    // };

    const getMetricLabel = (metric: string): string => {
        switch (metric) {
            case 'iops': return 'IOPS';
            case 'avg_latency': return 'Latency (ms)';
            case 'bandwidth': return 'Bandwidth (MB/s)';
            default: return metric;
        }
    };

    const formatValue = (value: number, metric: string): string => {
        if (value === 0) return 'N/A';
        
        switch (metric) {
            case 'iops': return value.toFixed(0);
            case 'avg_latency': return value.toFixed(2);
            case 'bandwidth': return value.toFixed(1);
            default: return value.toString();
        }
    };

    const getColorBasedIntensityStyle = (cell: MatrixCell): string => {
        if (cell.intensity === 0 || !cell.hostname) {
            return 'bg-gray-100 dark:bg-gray-800 text-gray-500';
        }

        // Extract color from hostname or drive name
        const colorName = extractColorFromName(cell.hostname) || extractColorFromName(cell.drive);
        
        // Generate intensity-based styles with the extracted color
        if (colorName) {
            if (cell.intensity > 0.8) return `bg-gradient-to-br from-${colorName}-400 to-${colorName}-600 text-white`;
            if (cell.intensity > 0.6) return `bg-gradient-to-br from-${colorName}-300 to-${colorName}-500 text-white`;
            if (cell.intensity > 0.4) return `bg-gradient-to-br from-${colorName}-200 to-${colorName}-400 text-gray-900 dark:text-gray-100`;
            if (cell.intensity > 0.2) return `bg-gradient-to-br from-${colorName}-100 to-${colorName}-300 text-gray-900 dark:text-gray-100`;
            if (cell.intensity > 0) return `bg-gradient-to-br from-gray-100 to-${colorName}-200 text-gray-900 dark:text-gray-100`;
        }
        
        // Fallback to blue if no color extracted
        if (cell.intensity > 0.8) return 'bg-gradient-to-br from-blue-400 to-blue-600 text-white';
        if (cell.intensity > 0.6) return 'bg-gradient-to-br from-blue-300 to-blue-500 text-white';
        if (cell.intensity > 0.4) return 'bg-gradient-to-br from-blue-200 to-blue-400 text-gray-900 dark:text-gray-100';
        if (cell.intensity > 0.2) return 'bg-gradient-to-br from-blue-100 to-blue-300 text-gray-900 dark:text-gray-100';
        if (cell.intensity > 0) return 'bg-gradient-to-br from-gray-100 to-blue-200 text-gray-900 dark:text-gray-100';
        
        return 'bg-gray-100 dark:bg-gray-800 text-gray-500';
    };


    return (
        <div className="w-full">
            <div className="mb-4">
                <h4 className="text-lg font-semibold theme-text-primary mb-2">
                    Performance Matrix - {getMetricLabel(metric)}
                </h4>
                <p className="text-sm theme-text-secondary">
                    Best performing drive for each block size and pattern combination
                </p>
            </div>

            <div className="overflow-x-auto">
                <div className="inline-block min-w-full">
                    <table className="min-w-full border-collapse">
                        <thead>
                            <tr>
                                <th className="border border-gray-300 dark:border-gray-600 p-2 bg-gray-50 dark:bg-gray-700 text-sm font-medium theme-text-primary">
                                    Block Size
                                </th>
                                {allPatterns.map(pattern => (
                                    <th key={pattern} className="border border-gray-300 dark:border-gray-600 p-2 bg-gray-50 dark:bg-gray-700 text-sm font-medium theme-text-primary">
                                        {pattern}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {allBlockSizes.map((blockSize, rowIndex) => (
                                <tr key={blockSize}>
                                    <td className="border border-gray-300 dark:border-gray-600 p-2 bg-gray-50 dark:bg-gray-700 text-sm font-medium theme-text-primary">
                                        {blockSize}
                                    </td>
                                    {allPatterns.map((pattern, colIndex) => {
                                        const cell = matrixData[rowIndex][colIndex];
                                        const intensityStyle = getColorBasedIntensityStyle(cell);

                                        return (
                                            <td
                                                key={`${blockSize}-${pattern}`}
                                                className={`border border-gray-300 dark:border-gray-600 p-2 text-center cursor-pointer transition-all hover:scale-105 ${intensityStyle}`}
                                                onMouseEnter={(e) => {
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    setHoveredCell({
                                                        cell,
                                                        x: rect.left + rect.width / 2,
                                                        y: rect.top
                                                    });
                                                }}
                                                onMouseLeave={() => setHoveredCell(null)}
                                            >
                                                <div className="text-xs font-bold">
                                                    {formatValue(cell.value, metric)}
                                                </div>
                                                {cell.drive && (
                                                    <div className="text-xs opacity-75 truncate">
                                                        {cell.drive}
                                                    </div>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="mt-4 flex items-center gap-4 text-xs theme-text-secondary">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gradient-to-br from-blue-100 to-blue-200"></div>
                    <span>Low</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gradient-to-br from-blue-400 to-blue-600"></div>
                    <span>High</span>
                </div>
                <div className="ml-4">
                    <span>Hover cells for details</span>
                </div>
            </div>
            
            {/* Custom Hover Popup */}
            {hoveredCell && (
                <div
                    className="fixed bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-4 z-50 max-w-sm"
                    style={{
                        left: hoveredCell.x - 150, // Center the popup horizontally
                        top: hoveredCell.y - 10,   // Position above the cell
                        transform: 'translateY(-100%)'
                    }}
                >
                    {hoveredCell.cell.fullConfig && hoveredCell.cell.driveInfo ? (
                        <div className="space-y-3">
                            {/* Drive Info */}
                            <div>
                                <h3 className="font-semibold theme-text-primary text-sm">
                                    {hoveredCell.cell.drive}
                                </h3>
                                <p className="text-xs theme-text-secondary">
                                    {hoveredCell.cell.driveInfo.drive_type} - {hoveredCell.cell.driveInfo.protocol}
                                </p>
                            </div>
                            
                            {/* Test Configuration */}
                            <div>
                                <h4 className="font-medium theme-text-primary text-xs mb-1">Test Configuration</h4>
                                <div className="text-xs theme-text-secondary space-y-1">
                                    <div>Block Size: <span className="font-medium">{hoveredCell.cell.fullConfig.block_size}</span></div>
                                    <div>Pattern: <span className="font-medium">{hoveredCell.cell.fullConfig.read_write_pattern}</span></div>
                                    <div>Queue Depth: <span className="font-medium">{hoveredCell.cell.fullConfig.queue_depth}</span></div>
                                </div>
                            </div>
                            
                            {/* Performance Metrics */}
                            <div>
                                <h4 className="font-medium theme-text-primary text-xs mb-1">Performance Metrics</h4>
                                <div className="text-xs theme-text-secondary space-y-1">
                                    <div>IOPS: <span className="font-medium">{hoveredCell.cell.fullConfig.iops !== null && hoveredCell.cell.fullConfig.iops !== undefined ? hoveredCell.cell.fullConfig.iops.toFixed(0) : 'N/A'}</span></div>
                                    <div>Avg Latency: <span className="font-medium">{hoveredCell.cell.fullConfig.avg_latency !== null && hoveredCell.cell.fullConfig.avg_latency !== undefined ? hoveredCell.cell.fullConfig.avg_latency.toFixed(2) + 'ms' : 'N/A'}</span></div>
                                    <div>Bandwidth: <span className="font-medium">{hoveredCell.cell.fullConfig.bandwidth !== null && hoveredCell.cell.fullConfig.bandwidth !== undefined ? hoveredCell.cell.fullConfig.bandwidth.toFixed(1) + ' MB/s' : 'N/A'}</span></div>
                                    <div>95th Percentile: <span className="font-medium">{hoveredCell.cell.fullConfig.p95_latency !== null && hoveredCell.cell.fullConfig.p95_latency !== undefined ? hoveredCell.cell.fullConfig.p95_latency.toFixed(2) + 'ms' : 'N/A'}</span></div>
                                    <div>99th Percentile: <span className="font-medium">{hoveredCell.cell.fullConfig.p99_latency !== null && hoveredCell.cell.fullConfig.p99_latency !== undefined ? hoveredCell.cell.fullConfig.p99_latency.toFixed(2) + 'ms' : 'N/A'}</span></div>
                                </div>
                            </div>
                            
                            {/* Test Date */}
                            <div>
                                <h4 className="font-medium theme-text-primary text-xs mb-1">Test Date</h4>
                                <div className="text-xs theme-text-secondary">
                                    {new Date(hoveredCell.cell.fullConfig.timestamp).toLocaleDateString()} {new Date(hoveredCell.cell.fullConfig.timestamp).toLocaleTimeString()}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <div className="font-semibold theme-text-primary text-sm">{hoveredCell.cell.drive}</div>
                            <div className="text-xs theme-text-secondary">
                                {formatValue(hoveredCell.cell.value, metric)} {getMetricLabel(metric)}
                            </div>
                            <div className="text-xs theme-text-secondary">{hoveredCell.cell.configuration}</div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default PerformanceMatrix;