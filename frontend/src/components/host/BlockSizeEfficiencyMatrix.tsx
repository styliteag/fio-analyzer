import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import type { DriveAnalysis } from '../../services/api/hostAnalysis';

interface BlockSizeEfficiencyMatrixProps {
    drives: DriveAnalysis[];
}

interface EfficiencyCell {
    blockSize: string;
    pattern: string;
    iops: number;
    efficiency: number;
    normalizedEfficiency: number;
}

const BlockSizeEfficiencyMatrix: React.FC<BlockSizeEfficiencyMatrixProps> = ({ drives }) => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    // Process data to calculate efficiency metrics
    const processedData = React.useMemo(() => {
        const allCells: EfficiencyCell[] = [];

        drives.forEach(drive => {
            // Group configurations by block size and pattern
            const blockSizeGroups: Record<string, Record<string, number[]>> = {};

            drive.configurations.forEach(config => {
                if (!config.iops || config.iops === 0) return;

                const blockSize = config.block_size;
                const pattern = config.read_write_pattern;

                if (!blockSizeGroups[blockSize]) {
                    blockSizeGroups[blockSize] = {};
                }
                if (!blockSizeGroups[blockSize][pattern]) {
                    blockSizeGroups[blockSize][pattern] = [];
                }

                blockSizeGroups[blockSize][pattern].push(config.iops);
            });

            // Calculate average IOPS for each block size + pattern combination
            Object.entries(blockSizeGroups).forEach(([blockSize, patterns]) => {
                Object.entries(patterns).forEach(([pattern, iopsValues]) => {
                    const avgIops = iopsValues.reduce((sum, val) => sum + val, 0) / iopsValues.length;

                    // Calculate efficiency as IOPS per unit of block size (normalized)
                    const efficiency = avgIops / parseBlockSizeToBytes(blockSize);

                    allCells.push({
                        blockSize,
                        pattern,
                        iops: avgIops,
                        efficiency,
                        normalizedEfficiency: 0 // Will be calculated after all cells
                    });
                });
            });
        });

        // Find global max efficiency for normalization
        const maxEfficiency = Math.max(...allCells.map(cell => cell.efficiency));

        // Normalize efficiencies to 0-100 scale
        allCells.forEach(cell => {
            cell.normalizedEfficiency = (cell.efficiency / maxEfficiency) * 100;
        });

        return allCells;
    }, [drives]);

    // Get unique block sizes and patterns
    const blockSizes = React.useMemo(() =>
        [...new Set(processedData.map(cell => cell.blockSize))]
            .sort((a, b) => parseBlockSizeToBytes(a) - parseBlockSizeToBytes(b)),
        [processedData]
    );

    const patterns = React.useMemo(() =>
        [...new Set(processedData.map(cell => cell.pattern))].sort(),
        [processedData]
    );

    // Helper function to parse block sizes to bytes for sorting
    function parseBlockSizeToBytes(size: string): number {
        const match = size.match(/^(\d+(?:\.\d+)?)([KMGT]?)$/i);
        if (!match) return 0;
        const [, num, unit] = match;
        const value = parseFloat(num);
        const multipliers: Record<string, number> = { 'K': 1024, 'M': 1024*1024, 'G': 1024*1024*1024, 'T': 1024*1024*1024*1024 };
        return value * (multipliers[unit.toUpperCase()] || 1);
    }

    // Format IOPS for display
    const formatIOPS = (iops: number): string => {
        if (iops >= 1000000) return (iops / 1000000).toFixed(1) + 'M';
        if (iops >= 1000) return (iops / 1000).toFixed(0) + 'k';
        return iops.toFixed(0);
    };

    // Get color for efficiency
    const getEfficiencyColor = (normalizedEfficiency: number): string => {
        if (normalizedEfficiency === 0) {
            return isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600';
        }
        const intensity = normalizedEfficiency / 100;
        if (intensity > 0.8) return 'bg-green-200 text-gray-900';
        if (intensity > 0.6) return 'bg-green-100 text-gray-900';
        if (intensity > 0.4) return 'bg-yellow-100 text-gray-900';
        if (intensity > 0.2) return 'bg-orange-100 text-gray-900';
        return 'bg-red-100 text-gray-900';
    };

    if (processedData.length === 0) {
        return (
            <div className="text-center py-8">
                <p className={`theme-text-secondary ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    No efficiency data available for analysis
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Block Size Efficiency Matrix
                </h3>
                <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    Efficiency = IOPS / Block Size (normalized 0-100%)
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className={`min-w-full border-collapse ${isDark ? 'border-gray-700' : 'border-gray-300'}`}>
                    <thead>
                        <tr className={isDark ? 'bg-gray-800' : 'bg-gray-50'}>
                            <th className={`border ${isDark ? 'border-gray-700' : 'border-gray-300'} px-4 py-3 text-left text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                Block Size
                            </th>
                            {patterns.map(pattern => (
                                <th key={pattern} className={`border ${isDark ? 'border-gray-700' : 'border-gray-300'} px-4 py-3 text-center text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {pattern.replace('_', ' ').toUpperCase()}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {blockSizes.map(blockSize => (
                            <tr key={blockSize} className={isDark ? 'bg-gray-900' : 'bg-white'}>
                                <td className={`border ${isDark ? 'border-gray-700' : 'border-gray-300'} px-4 py-3 text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {blockSize}
                                </td>
                                {patterns.map(pattern => {
                                    const cell = processedData.find(c => c.blockSize === blockSize && c.pattern === pattern);
                                    return (
                                        <td
                                            key={`${blockSize}-${pattern}`}
                                            className={`border ${isDark ? 'border-gray-700' : 'border-gray-300'} px-2 py-3 text-center text-sm ${cell ? getEfficiencyColor(cell.normalizedEfficiency) : (isDark ? 'bg-gray-800 text-gray-500' : 'bg-gray-100 text-gray-400')}`}
                                            title={cell ? `${formatIOPS(cell.iops)} IOPS, Efficiency: ${cell.normalizedEfficiency.toFixed(1)}%` : 'No data'}
                                        >
                                            {cell ? (
                                                <div>
                                                    <div className="font-semibold">{formatIOPS(cell.iops)}</div>
                                                    <div className="text-xs opacity-75">{cell.normalizedEfficiency.toFixed(1)}%</div>
                                                </div>
                                            ) : (
                                                <span className="text-xs">-</span>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'} space-y-2`}>
                <p><strong>How to read this matrix:</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                    <li><strong>Rows:</strong> Different block sizes (sorted by size)</li>
                    <li><strong>Columns:</strong> Different I/O patterns (read/write combinations)</li>
                    <li><strong>Cells:</strong> Show average IOPS and efficiency percentage</li>
                    <li><strong>Efficiency:</strong> Higher values (green) indicate better performance per byte</li>
                    <li><strong>Color coding:</strong> Green = high efficiency, Red = low efficiency</li>
                </ul>
            </div>
        </div>
    );
};

export default BlockSizeEfficiencyMatrix;
