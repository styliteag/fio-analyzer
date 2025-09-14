import React from 'react';
import type { DriveAnalysis } from '../../services/api/hostAnalysis';
import { useTheme } from '../../contexts/ThemeContext';

interface PerformanceFingerprintHeatmapProps {
    drives: DriveAnalysis[];
}

interface HeatmapCell {
    iops: number;
    normalizedIops: number;
    blockSize: string;
    pattern: string;
    hostname: string;
    driveModel: string;
    queueDepth: number;
    timestamp: string;
    avgLatency?: number;
    bandwidth?: number;
    p95Latency?: number;
    p99Latency?: number;
}

const PerformanceFingerprintHeatmap: React.FC<PerformanceFingerprintHeatmapProps> = ({ drives }) => {
    const { actualTheme } = useTheme();
    const [hoveredCell, setHoveredCell] = React.useState<{ cell: HeatmapCell; x: number; y: number } | null>(null);



    // Get all unique block sizes and hostnames
    const allBlockSizes = [...new Set(
        drives.flatMap(drive =>
            drive.configurations.map(config => config.block_size)
        )
    )].sort((a, b) => {
        // Sort by actual size (convert to bytes for comparison)
        const parseSize = (size: string): number => {
            const match = size.match(/^(\d+(?:\.\d+)?)([KMGT]?)$/i);
            if (!match) return 0;
            const [, num, unit] = match;
            const value = parseFloat(num);
            const multipliers: Record<string, number> = { 'K': 1024, 'M': 1024*1024, 'G': 1024*1024*1024, 'T': 1024*1024*1024*1024 };
            return value * (multipliers[unit.toUpperCase()] || 1);
        };

        return parseSize(a) - parseSize(b);
    });

    const allHostnames = [...new Set(drives.map(drive => drive.hostname))].sort();
    // Get patterns from actual data, but map them to our expected format
    const rawPatterns = [...new Set(drives.flatMap(drive =>
        drive.configurations.map(config => config.read_write_pattern)
    ))];

    // Map API patterns to our display patterns
    const patternMapping: Record<string, string> = {
        'randread': 'random_read',
        'randwrite': 'random_write',
        'read': 'sequential_read',
        'write': 'sequential_write'
    };

    const allPatterns = rawPatterns.map(pattern => patternMapping[pattern] || pattern);

    console.log('Raw patterns from data:', rawPatterns);
    console.log('Mapped patterns:', allPatterns);

    // Create row definitions - each row is hostname + protocol + driveModel + pattern
    const rowDefinitions: { hostname: string; pattern: string; driveModel: string; protocol: string; driveType: string; hostKey: string }[] = [];

    // Group drives by hostname to handle multiple drive models per host
    const drivesByHostname = new Map<string, typeof drives>();
    drives.forEach(drive => {
        if (!drivesByHostname.has(drive.hostname)) {
            drivesByHostname.set(drive.hostname, []);
        }
        drivesByHostname.get(drive.hostname)!.push(drive);
    });

    // For each hostname, create separate sections for each unique protocol-driveModel-driveType combination
    const processedKeys = new Set<string>();
    drivesByHostname.forEach((hostDrives, hostname) => {
        hostDrives.forEach((drive) => {
            const driveModel = drive.drive_model || '';
            const protocol = drive.protocol || 'unknown';
            const driveType = drive.drive_type || '';
            const hostKey = `${hostname}-${protocol}-${driveModel}-${driveType}`;

            // Only skip truly identical drives (same hostname, protocol, driveModel, driveType, and configurations)
            const isDuplicate = processedKeys.has(hostKey) && drive.configurations?.length === 0;
            if (isDuplicate) {
                return;
            }
            processedKeys.add(hostKey);

            allPatterns.forEach(pattern => {
                rowDefinitions.push({
                    hostname,
                    pattern,
                    driveModel,
                    protocol,
                    driveType,
                    hostKey
                });
            });
        });
    });

    // Calculate maximum values from VISIBLE/FILTERED data for normalization
    // This ensures fair comparison within the current filtered dataset
    let visibleMaxIOPS = 0;
    let visibleMaxBandwidth = 0;
    let visibleMaxResponsiveness = 0;

    drives.forEach((drive) => {
        // For each drive, find the maximum values across all its configurations
        drive.configurations.forEach(config => {
            if (config.iops && config.iops > visibleMaxIOPS) {
                visibleMaxIOPS = config.iops;
            }
            if (config.bandwidth && config.bandwidth > visibleMaxBandwidth) {
                visibleMaxBandwidth = config.bandwidth;
            }
            // Calculate responsiveness: 1000 ÷ latency = operations per millisecond
            // Higher responsiveness values indicate better performance
            if (config.avg_latency && config.avg_latency > 0) {
                const responsiveness = 1000 / config.avg_latency;
                if (responsiveness > visibleMaxResponsiveness) {
                    visibleMaxResponsiveness = responsiveness;
                }
            }
        });
    });

    console.log('All block sizes:', allBlockSizes);
    console.log('All hostnames:', allHostnames);
    console.log('All patterns:', allPatterns);

    // Build heatmap data - organized by row definition and block size
    // Each row represents a hostname + pattern combination
    // Each column represents a block size
    const heatmapData: HeatmapCell[][] = [];

    console.log('Building heatmap data for', rowDefinitions.length, 'rows and', allBlockSizes.length, 'block sizes');

    // Initialize heatmap data structure
    rowDefinitions.forEach((rowDef, rowIndex) => {
        heatmapData[rowIndex] = [];

        allBlockSizes.forEach((blockSize, colIndex) => {
            heatmapData[rowIndex][colIndex] = {
                iops: 0,
                normalizedIops: 0,
                blockSize,
                pattern: rowDef.pattern,
                hostname: rowDef.hostname,
                driveModel: rowDef.driveModel,
                queueDepth: 0,
                timestamp: '',
                avgLatency: undefined,
                bandwidth: undefined,
                p95Latency: undefined,
                p99Latency: undefined,
            };
        });
    });

    // Fill with actual data
    drives.forEach((drive) => {
        const hostname = drive.hostname;

        drive.configurations.forEach((config) => {
            // Try to parse IOPS as number if it's a string
            let iopsValue = config.iops;
            if (typeof iopsValue === 'string') {
                iopsValue = parseFloat(iopsValue);
            }

            if (!iopsValue || iopsValue <= 0) {
                return;
            }

            // Use the mapped pattern for row lookup
            const mappedPattern = patternMapping[config.read_write_pattern] || config.read_write_pattern;
            const blockSize = config.block_size;
            const driveModel = drive.drive_model || '';
            const protocol = drive.protocol || 'unknown';
            const driveType = drive.drive_type || '';
            const hostKey = `${hostname}-${protocol}-${driveModel}-${driveType}`;

            // Find the row for this hostname-protocol-driveModel-driveType + mapped pattern combination
            const rowIndex = rowDefinitions.findIndex(row =>
                row.hostKey === hostKey && row.pattern === mappedPattern
            );

            if (rowIndex === -1) {
                console.log('Row not found for:', hostKey, mappedPattern, 'original pattern:', config.read_write_pattern);
                return;
            }

            // Find the column for this block size
            const colIndex = allBlockSizes.indexOf(blockSize);
            if (colIndex === -1) {
                console.log('Column not found for block size:', blockSize);
                return;
            }

            // Normalize IOPS against visible data maximum for fair comparison
            const normalizedIops = visibleMaxIOPS > 0 ? (iopsValue / visibleMaxIOPS) * 100 : 0;


            heatmapData[rowIndex][colIndex] = {
                iops: iopsValue,
                normalizedIops,
                blockSize,
                pattern: mappedPattern,
                hostname,
                driveModel: drive.drive_model,
                queueDepth: config.queue_depth,
                timestamp: config.timestamp,
                avgLatency: config.avg_latency !== null && config.avg_latency !== undefined ? config.avg_latency : undefined,
                bandwidth: config.bandwidth !== null && config.bandwidth !== undefined ? config.bandwidth : undefined,
                p95Latency: config.p95_latency !== null && config.p95_latency !== undefined ? config.p95_latency : undefined,
                p99Latency: config.p99_latency !== null && config.p99_latency !== undefined ? config.p99_latency : undefined,
            };

        });
    });


    const getColorForNormalizedIOPS = (normalizedIops: number, isDark: boolean): string => {
        if (normalizedIops === 0) {
            return isDark ? 'bg-gray-700/50 text-gray-300' : 'bg-gray-200/50 text-gray-600';
        }

        const intensity = normalizedIops / 100;

        // Color mapping with proper dark mode support
        if (isDark) {
            if (intensity > 0.8) return 'bg-green-900/30 text-green-300';
            if (intensity > 0.6) return 'bg-green-900/25 text-green-400';
            if (intensity > 0.4) return 'bg-yellow-900/30 text-yellow-300';
            if (intensity > 0.2) return 'bg-orange-900/30 text-orange-300';
            return 'bg-red-900/30 text-red-300';
        } else {
            // Light mode colors
            if (intensity > 0.8) return 'bg-green-200/70 text-gray-900';
            if (intensity > 0.6) return 'bg-green-100/60 text-gray-900';
            if (intensity > 0.4) return 'bg-yellow-100/70 text-gray-900';
            if (intensity > 0.2) return 'bg-orange-100/70 text-gray-900';
            return 'bg-red-100/70 text-gray-900';
        }
    };

    const formatIOPS = (iops: number): string => {
        if (iops >= 1000000) return (iops / 1000000).toFixed(1) + 'M';
        if (iops >= 1000) return (iops / 1000).toFixed(0) + 'k';
        return iops.toFixed(0);
    };

    // If no data, show a simple message
    if (!drives || drives.length === 0) {
        return (
            <div className="w-full p-8 text-center">
                <p className="text-lg theme-text-primary">No data available for heatmap</p>
                <p className="text-sm theme-text-secondary mt-2">Please select hosts with performance data</p>
            </div>
        );
    }

    return (
        <div className="w-full">
            <div className="mb-6">
                <h4 className="text-xl font-bold theme-text-primary mb-2">
                    Performance Fingerprint Heatmap
                </h4>
                <p className="text-sm theme-text-secondary mb-4">
                    Multi-dimensional performance visualization across block sizes and test patterns.
                    Each cell shows three normalized metrics: IOPS, Bandwidth, and Responsiveness.
                </p>
                <p className="text-xs theme-text-secondary mb-4">
                    <strong>Responsiveness</strong> = 1000 ÷ Latency (ops/ms) • Higher values = Better performance
                </p>

                {/* Legend */}
                <div className="space-y-2 text-xs theme-text-secondary mb-4">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-2 bg-blue-500 dark:bg-blue-400 rounded"></div>
                            <span>IOPS</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-2 bg-green-500 dark:bg-green-400 rounded"></div>
                            <span>Bandwidth</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-2 bg-red-500 dark:bg-red-400 rounded"></div>
                            <span>Responsiveness</span>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded ${getColorForNormalizedIOPS(0, actualTheme === 'dark')}`}></div>
                            <span>0% (No data)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded ${getColorForNormalizedIOPS(25, actualTheme === 'dark')}`}></div>
                            <span>25%</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded ${getColorForNormalizedIOPS(50, actualTheme === 'dark')}`}></div>
                            <span>50%</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded ${getColorForNormalizedIOPS(75, actualTheme === 'dark')}`}></div>
                            <span>75%</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded ${getColorForNormalizedIOPS(100, actualTheme === 'dark')}`}></div>
                            <span>100% (Max)</span>
                        </div>
                    </div>
                    <div className="text-xs opacity-75">
                        Hover cells for detailed metrics • Higher bars = Better performance
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto">
                <div className="inline-block min-w-full">
                    <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-500" style={{ fontSize: '12px' }}>
                        <thead>
                            <tr>
                                <th className="border border-gray-300 dark:border-gray-500 p-3 bg-gray-50 dark:bg-gray-800 text-sm font-semibold theme-text-primary">
                                    Host
                                </th>
                                <th className="border border-gray-300 dark:border-gray-500 p-3 bg-gray-50 dark:bg-gray-800 text-sm font-semibold theme-text-primary">
                                    Pattern
                                </th>
                                {allBlockSizes.map(blockSize => (
                                    <th key={blockSize} className="border border-gray-300 dark:border-gray-500 p-3 bg-gray-50 dark:bg-gray-800 text-sm font-semibold theme-text-primary text-center" style={{ minWidth: '120px' }}>
                                        {blockSize}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rowDefinitions.map((rowDef, rowIndex) => {
                                const rowKey = `${rowDef.hostKey}-${rowDef.pattern}`;
                                const isFirstPatternForHost = rowDef.pattern === 'random_read';
                                const isFirstRowOfHost = rowIndex === 0 || rowDefinitions[rowIndex - 1].hostKey !== rowDef.hostKey;

                                return (
                                    <tr key={rowKey} className={isFirstRowOfHost ? 'border-t-4 border-t-blue-500' : ''}>
                                        <td className={`border border-gray-300 dark:border-gray-500 p-3 text-sm font-medium theme-text-primary ${
                                            isFirstRowOfHost ? 'bg-blue-50 dark:bg-blue-950/20' :
                                            isFirstPatternForHost ? 'bg-gray-50 dark:bg-gray-700/50' : 'bg-white dark:bg-gray-800'}`}>
                                            <div>
                                                <div className="font-bold">{rowDef.hostname}</div>
                                                <div className="text-xs theme-text-secondary mt-1">
                                                    {rowDef.protocol} • {rowDef.driveModel}
                                                </div>
                                                <div className="text-xs theme-text-secondary">
                                                    {rowDef.driveType}
                                                </div>
                                            </div>
                                        </td>
                                        <td className={`border border-gray-300 dark:border-gray-500 p-3 text-sm theme-text-primary ${
                                            isFirstRowOfHost ? 'bg-blue-50 dark:bg-blue-950/20' :
                                            isFirstPatternForHost ? 'bg-gray-50 dark:bg-gray-700/50' : 'bg-white dark:bg-gray-800'}`}>
                                            <div className="text-xs theme-text-secondary">
                                                {rowDef.pattern.replace('_', ' ').toUpperCase()}
                                            </div>
                                        </td>
                                        {allBlockSizes.map((blockSize, blockIndex) => {
                                            const cell = heatmapData[rowIndex][blockIndex];
                                            const colorClass = getColorForNormalizedIOPS(cell.normalizedIops, actualTheme === 'dark');


                                            return (
                                                <td
                                                    key={`${rowDef.hostname}-${rowDef.pattern}-${blockSize}`}
                                                    className={`border border-gray-300 dark:border-gray-500 p-2 text-center cursor-pointer transition-all hover:scale-105 hover:shadow-lg ${
                                                isFirstRowOfHost ? 'border-t-4 border-t-blue-500 dark:border-t-blue-400' : ''} ${colorClass}`}
                                                    onMouseEnter={(e) => {
                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                        setHoveredCell({
                                                            cell,
                                                            x: rect.left + rect.width / 2,
                                                            y: rect.top
                                                        });
                                                    }}
                                                    onMouseLeave={() => setHoveredCell(null)}
                                                    style={{
                                                        minWidth: '120px',
                                                        height: '80px',
                                                        backgroundColor: (cell.iops !== undefined && cell.iops !== null && cell.iops > 0) ? undefined : (actualTheme === 'dark' ? '#374151' : '#f3f4f6')
                                                    }}
                                                >
                                                    {/* Always show bars if cell has any data (IOPS can be 0 but still show configuration exists) */}
                                                    {cell.iops !== undefined && cell.iops !== null ? (
                                                        <div className="space-y-1">
                                                            {/* IOPS Number Display */}
                                                            <div className="text-sm font-bold text-center text-gray-900 dark:text-gray-100">
                                                                IOPS: {cell.iops > 0 ? formatIOPS(cell.iops) : '0'}
                                                            </div>
                                                            {/* IOPS Bar - Always show, even if 0 */}
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-xs text-blue-600 dark:text-blue-300 font-medium w-8">IOPS</span>
                                                                <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                                                                    <div
                                                                        className="bg-blue-500 dark:bg-blue-500/40 h-2 rounded-full"
                                                                        style={{
                                                                            width: cell.iops > 0 ? `${Math.max(5, cell.normalizedIops)}%` : '3px',
                                                                            minWidth: cell.iops > 0 ? 'auto' : '3px'
                                                                        }}
                                                                    ></div>
                                                                </div>
                                                                <span className="text-xs text-gray-600 dark:text-gray-300 w-10 text-right">
                                                                    {cell.iops > 0 ? `${(cell.iops / visibleMaxIOPS * 100).toFixed(0)}%` : '—'}
                                                                </span>
                                                            </div>

                                                            {/* Bandwidth Bar - Show if data exists */}
                                                            {cell.bandwidth !== undefined && cell.bandwidth !== null ? (
                                                                <div className="flex items-center gap-1">
                                                                    <span className="text-xs text-green-600 dark:text-green-300 font-medium w-8">BW</span>
                                                                    <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                                                                        <div
                                                                            className="bg-green-500 dark:bg-green-500/40 h-2 rounded-full"
                                                                            style={{
                                                                                width: cell.bandwidth > 0 ? `${Math.max(5, (cell.bandwidth / visibleMaxBandwidth) * 100)}%` : '3px',
                                                                                minWidth: cell.bandwidth > 0 ? 'auto' : '3px'
                                                                            }}
                                                                        ></div>
                                                                    </div>
                                                                    <span className="text-xs text-gray-600 dark:text-gray-300 w-10 text-right">
                                                                        {cell.bandwidth > 0 ? `${(cell.bandwidth / visibleMaxBandwidth * 100).toFixed(0)}%` : '—'}
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-1">
                                                                    <span className="text-xs text-gray-400 dark:text-gray-500 font-medium w-8">BW</span>
                                                                    <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                                                                        <div className="bg-gray-300 dark:bg-gray-600 h-2 rounded-full" style={{ width: '0%' }}></div>
                                                                    </div>
                                                                    <span className="text-xs text-gray-400 dark:text-gray-500 w-10 text-right">—</span>
                                                                </div>
                                                            )}

                                                            {/* Latency Bar (1000/Latency for responsiveness) - Show if data exists */}
                                                            {/* RESP = 1000 ÷ Latency (operations per millisecond) - Higher = Better performance */}
                                                            {cell.avgLatency !== undefined && cell.avgLatency !== null && cell.avgLatency > 0 ? (
                                                                <div className="flex items-center gap-1">
                                                                    <span className="text-xs text-red-600 dark:text-red-300 font-medium w-8">RESP</span>
                                                                    <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                                                                        <div
                                                                            className="bg-red-500 dark:bg-red-500/40 h-2 rounded-full"
                                                                            style={{
                                                                                width: `${Math.min(100, Math.max(5, ((1000 / cell.avgLatency) / visibleMaxResponsiveness) * 100))}%`,
                                                                                minWidth: 'auto'
                                                                            }}
                                                                        ></div>
                                                                    </div>
                                                                    <span className="text-xs text-gray-600 dark:text-gray-300 w-10 text-right">
                                                                        {cell.avgLatency > 0 ? `${(((1000 / cell.avgLatency) / visibleMaxResponsiveness) * 100).toFixed(0)}%` : '—'}
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-1">
                                                                    <span className="text-xs text-gray-400 dark:text-gray-500 font-medium w-8">RESP</span>
                                                                    <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                                                                        <div className="bg-gray-300 dark:bg-gray-600 h-2 rounded-full" style={{ width: '0%' }}></div>
                                                                    </div>
                                                                    <span className="text-xs text-gray-400 dark:text-gray-500 w-10 text-right">—</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="text-sm font-bold text-gray-400 dark:text-gray-500">—</div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Custom Hover Popup */}
            {hoveredCell && (
                <div
                    className="fixed bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl p-4 z-50 max-w-sm"
                    style={{
                        left: hoveredCell.x - 150, // Center the popup horizontally
                        top: hoveredCell.y - 10,   // Position above the cell
                        transform: 'translateY(-100%)'
                    }}
                >
                    <div className="space-y-3">
                        {/* Header */}
                        <div>
                            <h3 className="font-bold theme-text-primary text-sm">
                                {hoveredCell.cell.hostname}
                            </h3>
                            <p className="text-xs theme-text-secondary">
                                {hoveredCell.cell.driveModel}
                            </p>
                        </div>

                        {/* Test Configuration */}
                        <div>
                            <h4 className="font-semibold theme-text-primary text-xs mb-2">Test Configuration</h4>
                            <div className="text-xs theme-text-secondary space-y-1">
                                <div>Block Size: <span className="font-medium">{hoveredCell.cell.blockSize}</span></div>
                                <div>Pattern: <span className="font-medium">{hoveredCell.cell.pattern.replace('_', ' ')}</span></div>
                                <div>Queue Depth: <span className="font-medium">{hoveredCell.cell.queueDepth}</span></div>
                            </div>
                        </div>

                        {/* Performance Metrics */}
                        <div>
                            <h4 className="font-semibold theme-text-primary text-xs mb-2">Performance Metrics</h4>
                            <div className="text-xs theme-text-secondary space-y-1">
                                <div>IOPS: <span className="font-bold text-blue-600 dark:text-blue-400">{hoveredCell.cell.iops > 0 ? formatIOPS(hoveredCell.cell.iops) : 'N/A'}</span></div>
                                <div>Normalized: <span className="font-medium">{hoveredCell.cell.normalizedIops.toFixed(1)}%</span></div>
                                {hoveredCell.cell.avgLatency && (
                                    <div>Avg Latency: <span className="font-medium">{(hoveredCell.cell.avgLatency * 1000).toFixed(0)}ns</span></div>
                                )}
                                {hoveredCell.cell.bandwidth && (
                                    <div>Bandwidth: <span className="font-medium">{hoveredCell.cell.bandwidth.toFixed(1)} MB/s</span></div>
                                )}
                                {hoveredCell.cell.avgLatency && hoveredCell.cell.avgLatency > 0 && (
                                    <div>Responsiveness: <span className="font-medium">{(1000 / hoveredCell.cell.avgLatency).toFixed(1)} ops/ms</span></div>
                                )}
                                {hoveredCell.cell.p95Latency && (
                                    <div>95th %ile: <span className="font-medium">{(hoveredCell.cell.p95Latency * 1000).toFixed(0)}ns</span></div>
                                )}
                            </div>
                        </div>

                        {/* Test Date */}
                        {hoveredCell.cell.timestamp && (
                            <div>
                                <h4 className="font-semibold theme-text-primary text-xs mb-2">Test Date</h4>
                                <div className="text-xs theme-text-secondary">
                                    {new Date(hoveredCell.cell.timestamp).toLocaleDateString()} {new Date(hoveredCell.cell.timestamp).toLocaleTimeString()}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PerformanceFingerprintHeatmap;
