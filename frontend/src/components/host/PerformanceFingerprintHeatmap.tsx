import React from 'react';
import type { DriveAnalysis } from '../../services/api/hostAnalysis';
import { useTheme } from '../../contexts/ThemeContext';
import { formatLatencyMicroseconds } from '../../services/data/formatters';

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
    p70Latency?: number;
    p90Latency?: number;
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
    const patternMapping: Record<string, string> = React.useMemo(() => ({
        'randread': 'random_read',
        'randwrite': 'random_write',
        'read': 'sequential_read',
        'write': 'sequential_write'
    }), []);

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
    // We ensure at least one cell will show 100% and empty cells will show 0%
    let visibleMaxIOPS = 0;
    let visibleMaxBandwidth = 0;
    let visibleMaxResponsiveness = 0;
    let visibleMaxLatency = 0;
    let visibleMinIOPS = Infinity;
    let visibleMinBandwidth = Infinity;
    let visibleMinResponsiveness = Infinity;
    let visibleMinLatency = Infinity;

    drives.forEach((drive) => {
        // For each drive, find the maximum and minimum values across all its configurations
        drive.configurations.forEach(config => {
            // IOPS
            if (config.iops !== null && config.iops !== undefined) {
                const iopsValue = typeof config.iops === 'string' ? parseFloat(config.iops) : config.iops;
                if (!isNaN(iopsValue) && iopsValue > 0) {
                    if (iopsValue > visibleMaxIOPS) {
                        visibleMaxIOPS = iopsValue;
                    }
                    if (iopsValue < visibleMinIOPS) {
                        visibleMinIOPS = iopsValue;
                    }
                }
            }
            // Bandwidth
            if (config.bandwidth !== null && config.bandwidth !== undefined && config.bandwidth > 0) {
                if (config.bandwidth > visibleMaxBandwidth) {
                    visibleMaxBandwidth = config.bandwidth;
                }
                if (config.bandwidth < visibleMinBandwidth) {
                    visibleMinBandwidth = config.bandwidth;
                }
            }
            // Calculate responsiveness: 1000 ÷ latency = operations per millisecond
            // Higher responsiveness values indicate better performance
            if (config.avg_latency !== null && config.avg_latency !== undefined && config.avg_latency > 0) {
                const responsiveness = 1000 / config.avg_latency;
                if (responsiveness > visibleMaxResponsiveness) {
                    visibleMaxResponsiveness = responsiveness;
                }
                if (responsiveness < visibleMinResponsiveness) {
                    visibleMinResponsiveness = responsiveness;
                }
                // Track latency directly
                if (config.avg_latency > visibleMaxLatency) {
                    visibleMaxLatency = config.avg_latency;
                }
                if (config.avg_latency < visibleMinLatency) {
                    visibleMinLatency = config.avg_latency;
                }
            }
        });
    });

    // Ensure we have valid ranges (if all values are the same, max = min, so we need to handle that)
    // For normalization: we want max to always be 100%, so we use max as the denominator
    // Empty/zero cells will naturally be 0%
    const iopsRange = visibleMaxIOPS > 0 ? visibleMaxIOPS : 1;
    const bandwidthRange = visibleMaxBandwidth > 0 ? visibleMaxBandwidth : 1;
    const responsivenessRange = visibleMaxResponsiveness > 0 ? visibleMaxResponsiveness : 1;
    const latencyRange = visibleMaxLatency > 0 ? visibleMaxLatency : 1;

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
                p70Latency: undefined,
                p90Latency: undefined,
                p95Latency: undefined,
                p99Latency: undefined,
            };
        });
    });

    // Calculate statistics for each cell (group by hostname, driveModel, blockSize, pattern)
    const cellStatistics = React.useMemo(() => {
        const statsMap = new Map<string, {
            iops: { count: number; values: number[]; min: number; max: number; average: number };
            bandwidth: { count: number; values: number[]; min: number; max: number; average: number };
            latency: { count: number; values: number[]; min: number; max: number; average: number };
        }>();

        drives.forEach((drive) => {
            const hostname = drive.hostname;
            const driveModel = drive.drive_model || '';
            const protocol = drive.protocol || 'unknown';
            const driveType = drive.drive_type || '';
            const hostKey = `${hostname}-${protocol}-${driveModel}-${driveType}`;

            drive.configurations.forEach((config) => {
                const mappedPattern = patternMapping[config.read_write_pattern] || config.read_write_pattern;
                const blockSize = config.block_size;
                const cellKey = `${hostKey}|${mappedPattern}|${blockSize}`;

                if (!statsMap.has(cellKey)) {
                    statsMap.set(cellKey, {
                        iops: { count: 0, values: [], min: Infinity, max: -Infinity, average: 0 },
                        bandwidth: { count: 0, values: [], min: Infinity, max: -Infinity, average: 0 },
                        latency: { count: 0, values: [], min: Infinity, max: -Infinity, average: 0 }
                    });
                }

                const stats = statsMap.get(cellKey)!;

                // IOPS
                if (config.iops !== null && config.iops !== undefined) {
                    const iopsValue = typeof config.iops === 'string' ? parseFloat(config.iops) : config.iops;
                    if (!isNaN(iopsValue) && iopsValue > 0) {
                        stats.iops.count++;
                        stats.iops.values.push(iopsValue);
                        if (iopsValue < stats.iops.min) stats.iops.min = iopsValue;
                        if (iopsValue > stats.iops.max) stats.iops.max = iopsValue;
                    }
                }

                // Bandwidth
                if (config.bandwidth !== null && config.bandwidth !== undefined) {
                    stats.bandwidth.count++;
                    stats.bandwidth.values.push(config.bandwidth);
                    if (config.bandwidth < stats.bandwidth.min) stats.bandwidth.min = config.bandwidth;
                    if (config.bandwidth > stats.bandwidth.max) stats.bandwidth.max = config.bandwidth;
                }

                // Latency
                if (config.avg_latency !== null && config.avg_latency !== undefined) {
                    stats.latency.count++;
                    stats.latency.values.push(config.avg_latency);
                    if (config.avg_latency < stats.latency.min) stats.latency.min = config.avg_latency;
                    if (config.avg_latency > stats.latency.max) stats.latency.max = config.avg_latency;
                }
            });
        });

        // Calculate averages
        statsMap.forEach((stats) => {
            if (stats.iops.values.length > 0) {
                stats.iops.average = stats.iops.values.reduce((sum, val) => sum + val, 0) / stats.iops.values.length;
            }
            if (stats.bandwidth.values.length > 0) {
                stats.bandwidth.average = stats.bandwidth.values.reduce((sum, val) => sum + val, 0) / stats.bandwidth.values.length;
            }
            if (stats.latency.values.length > 0) {
                stats.latency.average = stats.latency.values.reduce((sum, val) => sum + val, 0) / stats.latency.values.length;
            }
        });

        return statsMap;
    }, [drives, patternMapping]);

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

            // Normalize IOPS against visible data maximum - ensures max value shows as 100%
            const normalizedIops = iopsRange > 0 ? Math.min(100, Math.max(0, (iopsValue / iopsRange) * 100)) : 0;

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
                p70Latency: config.p70_latency !== null && config.p70_latency !== undefined ? config.p70_latency : undefined,
                p90Latency: config.p90_latency !== null && config.p90_latency !== undefined ? config.p90_latency : undefined,
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
                    Each cell shows normalized metrics: IOPS, Bandwidth, Responsiveness, and Latency.
                </p>
                <div className="text-xs theme-text-secondary mb-4 space-y-1">
                    <p>
                        <strong>Bandwidth Calculation:</strong> Bandwidth (MB/s) = (IOPS × BlockSize) / (1024 × 1024)
                    </p>
                    <p>
                        <strong>Responsiveness</strong> = 1000 ÷ Latency (ops/ms) • Higher values = Better performance
                    </p>
                </div>

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
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-2 bg-purple-500 dark:bg-purple-400 rounded"></div>
                            <span>Latency</span>
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
                                                            {/* IOPS Bar - Always show, 0% for empty, 100% for max */}
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-xs text-blue-600 dark:text-blue-300 font-medium w-8">IOPS</span>
                                                                <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                                                                    <div
                                                                        className="bg-blue-500 dark:bg-blue-500/40 h-2 rounded-full"
                                                                        style={{
                                                                            width: cell.iops > 0 ? `${Math.max(0, Math.min(100, cell.normalizedIops))}%` : '0%',
                                                                            minWidth: cell.iops > 0 ? '2px' : '0px'
                                                                        }}
                                                                    ></div>
                                                                </div>
                                                                <span className="text-xs text-gray-600 dark:text-gray-300 w-10 text-right">
                                                                    {cell.iops > 0 ? `${Math.min(100, Math.max(0, (cell.iops / iopsRange) * 100)).toFixed(0)}%` : '0%'}
                                                                </span>
                                                            </div>

                                                            {/* Bandwidth Bar - Always show, 0% for empty, 100% for max */}
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-xs text-green-600 dark:text-green-300 font-medium w-8">BW</span>
                                                                <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                                                                    <div
                                                                        className="bg-green-500 dark:bg-green-500/40 h-2 rounded-full"
                                                                        style={{
                                                                            width: cell.bandwidth !== undefined && cell.bandwidth !== null && cell.bandwidth > 0 
                                                                                ? `${Math.max(0, Math.min(100, (cell.bandwidth / bandwidthRange) * 100))}%` 
                                                                                : '0%',
                                                                            minWidth: cell.bandwidth !== undefined && cell.bandwidth !== null && cell.bandwidth > 0 ? '2px' : '0px'
                                                                        }}
                                                                    ></div>
                                                                </div>
                                                                <span className="text-xs text-gray-600 dark:text-gray-300 w-10 text-right">
                                                                    {cell.bandwidth !== undefined && cell.bandwidth !== null && cell.bandwidth > 0 
                                                                        ? `${Math.min(100, Math.max(0, (cell.bandwidth / bandwidthRange) * 100)).toFixed(0)}%` 
                                                                        : '0%'}
                                                                </span>
                                                            </div>

                                                            {/* Latency Bar (1000/Latency for responsiveness) - Always show, 0% for empty, 100% for max */}
                                                            {/* RESP = 1000 ÷ Latency (operations per millisecond) - Higher = Better performance */}
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-xs text-red-600 dark:text-red-300 font-medium w-8">RESP</span>
                                                                <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                                                                    <div
                                                                        className="bg-red-500 dark:bg-red-500/40 h-2 rounded-full"
                                                                        style={{
                                                                            width: cell.avgLatency !== undefined && cell.avgLatency !== null && cell.avgLatency > 0
                                                                                ? `${Math.max(0, Math.min(100, ((1000 / cell.avgLatency) / responsivenessRange) * 100))}%`
                                                                                : '0%',
                                                                            minWidth: cell.avgLatency !== undefined && cell.avgLatency !== null && cell.avgLatency > 0 ? '2px' : '0px'
                                                                        }}
                                                                    ></div>
                                                                </div>
                                                                <span className="text-xs text-gray-600 dark:text-gray-300 w-10 text-right">
                                                                    {cell.avgLatency !== undefined && cell.avgLatency !== null && cell.avgLatency > 0
                                                                        ? `${Math.min(100, Math.max(0, ((1000 / cell.avgLatency) / responsivenessRange) * 100)).toFixed(0)}%`
                                                                        : '0%'}
                                                                </span>
                                                            </div>

                                                            {/* Latency Bar - Always show, 0% for empty, 100% for max */}
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-xs text-purple-600 dark:text-purple-300 font-medium w-8">LAT</span>
                                                                <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                                                                    <div
                                                                        className="bg-purple-500 dark:bg-purple-500/40 h-2 rounded-full"
                                                                        style={{
                                                                            width: cell.avgLatency !== undefined && cell.avgLatency !== null && cell.avgLatency > 0 
                                                                                ? `${Math.max(0, Math.min(100, (cell.avgLatency / latencyRange) * 100))}%` 
                                                                                : '0%',
                                                                            minWidth: cell.avgLatency !== undefined && cell.avgLatency !== null && cell.avgLatency > 0 ? '2px' : '0px'
                                                                        }}
                                                                    ></div>
                                                                </div>
                                                                <span className="text-xs text-gray-600 dark:text-gray-300 w-10 text-right">
                                                                    {cell.avgLatency !== undefined && cell.avgLatency !== null && cell.avgLatency > 0 
                                                                        ? `${Math.min(100, Math.max(0, (cell.avgLatency / latencyRange) * 100)).toFixed(0)}%` 
                                                                        : '0%'}
                                                                </span>
                                                            </div>
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
            {hoveredCell && (() => {
                // Find matching drive to get hostKey
                const matchingDrive = drives.find(d => 
                    d.hostname === hoveredCell.cell.hostname && 
                    d.drive_model === hoveredCell.cell.driveModel
                );
                const protocol = matchingDrive?.protocol || 'unknown';
                const driveType = matchingDrive?.drive_type || '';
                const hostKey = `${hoveredCell.cell.hostname}-${protocol}-${hoveredCell.cell.driveModel}-${driveType}`;
                const cellKey = `${hostKey}|${hoveredCell.cell.pattern}|${hoveredCell.cell.blockSize}`;
                const stats = cellStatistics.get(cellKey);

                return (
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
                                        <div>Avg Latency: <span className={`font-medium ${formatLatencyMicroseconds(hoveredCell.cell.avgLatency).colorClass}`}>{formatLatencyMicroseconds(hoveredCell.cell.avgLatency).text}</span></div>
                                    )}
                                    {hoveredCell.cell.bandwidth && (
                                        <div>Bandwidth: <span className="font-medium">{hoveredCell.cell.bandwidth.toFixed(1)} MB/s</span> <span className="text-xs text-gray-500">(IOPS × BlockSize)</span></div>
                                    )}
                                    {hoveredCell.cell.avgLatency && hoveredCell.cell.avgLatency > 0 && (
                                        <div>Responsiveness: <span className="font-medium">{(1000 / hoveredCell.cell.avgLatency).toFixed(1)} ops/ms</span></div>
                                    )}
                                    {hoveredCell.cell.p70Latency && (
                                        <div>70th %ile: <span className={`font-medium ${formatLatencyMicroseconds(hoveredCell.cell.p70Latency).colorClass}`}>{formatLatencyMicroseconds(hoveredCell.cell.p70Latency).text}</span></div>
                                    )}
                                    {hoveredCell.cell.p90Latency && (
                                        <div>90th %ile: <span className={`font-medium ${formatLatencyMicroseconds(hoveredCell.cell.p90Latency).colorClass}`}>{formatLatencyMicroseconds(hoveredCell.cell.p90Latency).text}</span></div>
                                    )}
                                    {hoveredCell.cell.p95Latency && (
                                        <div>95th %ile: <span className={`font-medium ${formatLatencyMicroseconds(hoveredCell.cell.p95Latency).colorClass}`}>{formatLatencyMicroseconds(hoveredCell.cell.p95Latency).text}</span></div>
                                    )}
                                    {hoveredCell.cell.p99Latency && (
                                        <div>99th %ile: <span className={`font-medium ${formatLatencyMicroseconds(hoveredCell.cell.p99Latency).colorClass}`}>{formatLatencyMicroseconds(hoveredCell.cell.p99Latency).text}</span></div>
                                    )}
                                </div>
                            </div>

                            {/* Statistics Section */}
                            {stats && (stats.iops.count > 0 || stats.bandwidth.count > 0 || stats.latency.count > 0) && (
                                <div>
                                    <h4 className="font-semibold theme-text-primary text-xs mb-2 border-t border-gray-200 dark:border-gray-700 pt-2">Statistics</h4>
                                    <div className="text-xs theme-text-secondary space-y-2">
                                        {stats.iops.count > 0 && (
                                            <div>
                                                <div className="font-medium text-blue-600 dark:text-blue-400 mb-1">IOPS:</div>
                                                <div className="pl-2 space-y-0.5">
                                                    <div className="flex justify-between">
                                                        <span>Records:</span>
                                                        <span className="font-medium">{stats.iops.count}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>Average:</span>
                                                        <span className="font-medium">{formatIOPS(stats.iops.average)}</span>
                                                    </div>
                                                    {stats.iops.min !== Infinity && (
                                                        <div className="flex justify-between">
                                                            <span>Min:</span>
                                                            <span className="font-medium">{formatIOPS(stats.iops.min)}</span>
                                                        </div>
                                                    )}
                                                    {stats.iops.max !== -Infinity && (
                                                        <div className="flex justify-between">
                                                            <span>Max:</span>
                                                            <span className="font-medium">{formatIOPS(stats.iops.max)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        {stats.bandwidth.count > 0 && (
                                            <div>
                                                <div className="font-medium text-green-600 dark:text-green-400 mb-1">Bandwidth:</div>
                                                <div className="pl-2 space-y-0.5">
                                                    <div className="flex justify-between">
                                                        <span>Records:</span>
                                                        <span className="font-medium">{stats.bandwidth.count}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>Average:</span>
                                                        <span className="font-medium">{stats.bandwidth.average.toFixed(1)} MB/s</span>
                                                    </div>
                                                    {stats.bandwidth.min !== Infinity && (
                                                        <div className="flex justify-between">
                                                            <span>Min:</span>
                                                            <span className="font-medium">{stats.bandwidth.min.toFixed(1)} MB/s</span>
                                                        </div>
                                                    )}
                                                    {stats.bandwidth.max !== -Infinity && (
                                                        <div className="flex justify-between">
                                                            <span>Max:</span>
                                                            <span className="font-medium">{stats.bandwidth.max.toFixed(1)} MB/s</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        {stats.latency.count > 0 && (
                                            <div>
                                                <div className="font-medium text-red-600 dark:text-red-400 mb-1">Latency:</div>
                                                <div className="pl-2 space-y-0.5">
                                                    <div className="flex justify-between">
                                                        <span>Records:</span>
                                                        <span className="font-medium">{stats.latency.count}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>Average:</span>
                                                        <span className={`font-medium ${formatLatencyMicroseconds(stats.latency.average).colorClass}`}>{formatLatencyMicroseconds(stats.latency.average).text}</span>
                                                    </div>
                                                    {stats.latency.min !== Infinity && (
                                                        <div className="flex justify-between">
                                                            <span>Min:</span>
                                                            <span className={`font-medium ${formatLatencyMicroseconds(stats.latency.min).colorClass}`}>{formatLatencyMicroseconds(stats.latency.min).text}</span>
                                                        </div>
                                                    )}
                                                    {stats.latency.max !== -Infinity && (
                                                        <div className="flex justify-between">
                                                            <span>Max:</span>
                                                            <span className={`font-medium ${formatLatencyMicroseconds(stats.latency.max).colorClass}`}>{formatLatencyMicroseconds(stats.latency.max).text}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

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
                );
            })()}
        </div>
    );
};

export default PerformanceFingerprintHeatmap;
