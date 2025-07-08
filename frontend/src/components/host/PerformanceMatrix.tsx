import React from 'react';
import type { DriveAnalysis } from '../../services/api/hostAnalysis';

interface PerformanceMatrixProps {
    drives: DriveAnalysis[];
    metric: 'iops' | 'avg_latency' | 'bandwidth';
}

interface MatrixCell {
    value: number;
    configuration: string;
    drive: string;
    intensity: number;
}

const PerformanceMatrix: React.FC<PerformanceMatrixProps> = ({ drives, metric }) => {
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
            let bestConfig = '';

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
                        bestConfig = `${blockSize} ${pattern} QD${config.queue_depth}`;
                    }
                }
            });

            const intensity = bestValue === (metric === 'avg_latency' ? Infinity : 0) ? 0 :
                (bestValue - minValue) / (maxValue - minValue);

            matrixData[rowIndex][colIndex] = {
                value: bestValue === (metric === 'avg_latency' ? Infinity : 0) ? 0 : bestValue,
                configuration: bestConfig,
                drive: bestDrive,
                intensity: metric === 'avg_latency' ? 1 - intensity : intensity
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
                                        const intensityStyle = cell.intensity > 0.8 ? 'bg-gradient-to-br from-blue-400 to-blue-600 text-white' :
                                                             cell.intensity > 0.6 ? 'bg-gradient-to-br from-blue-300 to-blue-500 text-white' :
                                                             cell.intensity > 0.4 ? 'bg-gradient-to-br from-blue-200 to-blue-400 text-gray-800' :
                                                             cell.intensity > 0.2 ? 'bg-gradient-to-br from-blue-100 to-blue-300 text-gray-800' :
                                                             cell.intensity > 0 ? 'bg-gradient-to-br from-gray-100 to-blue-200 text-gray-800' :
                                                             'bg-gray-100 dark:bg-gray-800 text-gray-500';

                                        return (
                                            <td
                                                key={`${blockSize}-${pattern}`}
                                                className={`border border-gray-300 dark:border-gray-600 p-2 text-center cursor-pointer transition-all hover:scale-105 ${intensityStyle}`}
                                                title={`${cell.drive}: ${formatValue(cell.value, metric)} ${getMetricLabel(metric)}\n${cell.configuration}`}
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
        </div>
    );
};

export default PerformanceMatrix;