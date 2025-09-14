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

    // Quick debug check
    console.log('Heatmap received drives count:', drives?.length || 0);
    if (drives && drives.length > 0 && drives[0].configurations) {
        const sampleConfig = drives[0].configurations[0];
        console.log('Sample config IOPS:', sampleConfig?.iops);
        console.log('Sample config block_size:', sampleConfig?.block_size);
        console.log('Sample config pattern:', sampleConfig?.read_write_pattern);
    }

    // Debug logging
    React.useEffect(() => {
        console.log('Heatmap received drives:', drives);
        console.log('Number of drives:', drives?.length || 0);
        if (drives && drives.length > 0) {
            console.log('First drive structure:', drives[0]);
        console.log('First drive configurations count:', drives[0].configurations?.length || 0);
        if (drives[0].configurations && drives[0].configurations.length > 0) {
            console.log('First drive configurations:', drives[0].configurations);
            console.log('First config sample:', drives[0].configurations[0]);
            console.log('First config keys:', Object.keys(drives[0].configurations[0]));
            console.log('First config iops:', drives[0].configurations[0].iops);
            console.log('First config iops type:', typeof drives[0].configurations[0].iops);
        }
            console.log('Available hostnames:', [...new Set(drives.map(d => d.hostname))]);
            console.log('Available block sizes:', [...new Set(drives.flatMap(d => d.configurations.map(c => c.block_size)))]);
            console.log('Available patterns:', [...new Set(drives.flatMap(d => d.configurations.map(c => c.read_write_pattern)))]);
        }
    }, [drives]);

    // Get all unique block sizes and hostnames
    const allBlockSizes = [...new Set(
        drives.flatMap(drive =>
            drive.configurations.map(config => config.block_size)
        )
    )].sort((a, b) => {
        // Custom sort for block sizes (4K, 8K, 16K, 64K, 1M)
        const order = ['4K', '8K', '16K', '64K', '1M'];
        const aIndex = order.indexOf(a);
        const bIndex = order.indexOf(b);
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return a.localeCompare(b);
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

    // Create row definitions - each row is hostname + pattern
    const rowDefinitions: { hostname: string; pattern: string; driveModel: string }[] = [];
    allHostnames.forEach(hostname => {
        const drive = drives.find(d => d.hostname === hostname);
        const driveModel = drive?.drive_model || '';
        allPatterns.forEach(pattern => {
            rowDefinitions.push({ hostname, pattern, driveModel });
        });
    });

    // Calculate max IOPS for each hostname for normalization
    const hostMaxIOPS = new Map<string, number>();

    drives.forEach(drive => {
        const hostname = drive.hostname;
        let maxIOPS = 0;

        drive.configurations.forEach(config => {
            if (config.iops && config.iops > maxIOPS) {
                maxIOPS = config.iops;
            }
        });

        if (hostMaxIOPS.has(hostname)) {
            hostMaxIOPS.set(hostname, Math.max(hostMaxIOPS.get(hostname)!, maxIOPS));
        } else {
            hostMaxIOPS.set(hostname, maxIOPS);
        }
    });

    console.log('Host max IOPS:', Object.fromEntries(hostMaxIOPS));
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
            };
        });
    });

    // Fill with actual data
    drives.forEach(drive => {
        console.log('Processing drive:', drive.hostname);
        console.log('Drive full structure:', drive);
        console.log('Drive configurations count:', drive.configurations?.length || 0);

        const hostname = drive.hostname;
        const maxIOPS = hostMaxIOPS.get(hostname) || 1;

        // First, let's find all non-zero IOPS values to understand the data
        const allIOPSValues = drive.configurations
            .map(config => config.iops)
            .filter(iops => iops !== null && iops !== undefined);

        console.log('All IOPS values in drive:', allIOPSValues);
        console.log('Non-zero IOPS values:', allIOPSValues.filter(iops => iops > 0));

        drive.configurations.forEach((config, index) => {
            console.log(`=== Configuration ${index} ===`);
            console.log('Full config object:', JSON.stringify(config, null, 2));

            // Check all possible IOPS field names
            const possibleIOPSFields = ['iops', 'IOPS', 'iops_value', 'IOPS_value'];
            const foundFields = possibleIOPSFields.filter(field => Object.prototype.hasOwnProperty.call(config, field));

            console.log(`Available IOPS fields:`, foundFields);
            foundFields.forEach(field => {
                console.log(`${field}:`, (config as any)[field], 'Type:', typeof (config as any)[field]);
            });

            console.log(`block_size:`, config.block_size);
            console.log(`read_write_pattern:`, config.read_write_pattern);

            // Try to parse IOPS as number if it's a string
            let iopsValue = config.iops;
            if (typeof iopsValue === 'string') {
                iopsValue = parseFloat(iopsValue);
                console.log(`Parsed IOPS from string:`, iopsValue);
            }

            console.log(`Final IOPS value:`, iopsValue, 'Type:', typeof iopsValue);

            if (!iopsValue || iopsValue <= 0) {
                console.log('❌ Skipping config - invalid IOPS:', iopsValue);
                return;
            }

            console.log('✅ Using IOPS value:', iopsValue);

            // Use the mapped pattern for row lookup
            const mappedPattern = patternMapping[config.read_write_pattern] || config.read_write_pattern;
            const blockSize = config.block_size;

            // Find the row for this hostname + mapped pattern combination
            const rowIndex = rowDefinitions.findIndex(row =>
                row.hostname === hostname && row.pattern === mappedPattern
            );

            if (rowIndex === -1) {
                console.log('Row not found for:', hostname, mappedPattern, 'original pattern:', config.read_write_pattern);
                return;
            }

            // Find the column for this block size
            const colIndex = allBlockSizes.indexOf(blockSize);
            if (colIndex === -1) {
                console.log('Column not found for block size:', blockSize);
                return;
            }

            // Update the cell
            const normalizedIops = (iopsValue / maxIOPS) * 100;

            heatmapData[rowIndex][colIndex] = {
                iops: iopsValue,
                normalizedIops,
                blockSize,
                pattern: mappedPattern,
                hostname,
                driveModel: drive.drive_model,
                queueDepth: config.queue_depth,
                timestamp: config.timestamp,
                avgLatency: config.avg_latency || undefined,
                bandwidth: config.bandwidth || undefined,
                p95Latency: config.p95_latency || undefined,
                p99Latency: config.p99_latency || undefined,
            };

            console.log(`Updated cell [${rowIndex}][${colIndex}]:`, hostname, mappedPattern, blockSize, 'IOPS:', iopsValue);
        });
    });

    console.log('Final heatmap data structure created with', heatmapData.length, 'rows and', heatmapData[0]?.length || 0, 'columns');

    const getColorForNormalizedIOPS = (normalizedIops: number, isDark: boolean): string => {
        if (normalizedIops === 0) {
            return isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600';
        }

        const intensity = normalizedIops / 100;

        // Simple color mapping using basic Tailwind classes
        if (intensity > 0.8) return 'bg-green-500 text-white';
        if (intensity > 0.6) return 'bg-green-400 text-black';
        if (intensity > 0.4) return 'bg-yellow-400 text-black';
        if (intensity > 0.2) return 'bg-orange-400 text-black';
        return 'bg-red-400 text-white';
    };

    const formatIOPS = (iops: number): string => {
        if (iops >= 1000000) return (iops / 1000000).toFixed(1) + 'M';
        if (iops >= 1000) return (iops / 1000).toFixed(1) + 'K';
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
                    Normalized IOPS performance across block sizes and test patterns.
                    Each cell shows performance relative to the host&apos;s maximum IOPS (0-100%).
                </p>

                {/* Legend */}
                <div className="flex flex-wrap items-center gap-4 text-xs theme-text-secondary mb-4">
                    <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded ${getColorForNormalizedIOPS(0, actualTheme === 'dark')}`}></div>
                        <span>0% (No data)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded ${getColorForNormalizedIOPS(20, actualTheme === 'dark')}`}></div>
                        <span>20%</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded ${getColorForNormalizedIOPS(50, actualTheme === 'dark')}`}></div>
                        <span>50%</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded ${getColorForNormalizedIOPS(80, actualTheme === 'dark')}`}></div>
                        <span>80%</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded ${getColorForNormalizedIOPS(100, actualTheme === 'dark')}`}></div>
                        <span>100% (Max)</span>
                    </div>
                    <div className="ml-4">
                        <span>Hover cells for details • Higher = Better performance</span>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto">
                <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900 rounded">
                    <p className="text-sm theme-text-primary">
                        Debug: Found {allHostnames.length} hosts, {allPatterns.length} patterns, {allBlockSizes.length} block sizes
                    </p>
                    <p className="text-xs theme-text-secondary">
                        Hostnames: {allHostnames.join(', ')}
                    </p>
                    <p className="text-xs theme-text-secondary">
                        Patterns: {allPatterns.join(', ')}
                    </p>
                    <p className="text-xs theme-text-secondary">
                        Block sizes: {allBlockSizes.join(', ')}
                    </p>
                    <p className="text-xs theme-text-secondary">
                        Theme: {actualTheme}, Table rows: {allHostnames.length * allPatterns.length}, Total cells: {allHostnames.length * allPatterns.length * allBlockSizes.length}
                    </p>
                </div>
                <div className="inline-block min-w-full">
                    <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-600" style={{ fontSize: '12px' }}>
                        <thead>
                            <tr>
                                <th className="border border-gray-300 dark:border-gray-600 p-3 bg-gray-50 dark:bg-gray-700 text-sm font-semibold theme-text-primary">
                                    Host / Pattern
                                </th>
                                {allBlockSizes.map(blockSize => (
                                    <th key={blockSize} className="border border-gray-300 dark:border-gray-600 p-3 bg-gray-50 dark:bg-gray-700 text-sm font-semibold theme-text-primary text-center">
                                        {blockSize}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rowDefinitions.map((rowDef, rowIndex) => {
                                const rowKey = `${rowDef.hostname}-${rowDef.pattern}`;
                                const isFirstPatternForHost = rowDef.pattern === 'random_read';

                                return (
                                    <tr key={rowKey}>
                                        <td className={`border border-gray-300 dark:border-gray-600 p-3 text-sm font-medium theme-text-primary ${
                                            isFirstPatternForHost ? 'bg-gray-50 dark:bg-gray-700' : 'bg-gray-25 dark:bg-gray-750'}`}>
                                            {isFirstPatternForHost ? (
                                                <div>
                                                    <div className="font-bold">{rowDef.hostname}</div>
                                                    <div className="text-xs theme-text-secondary mt-1">
                                                        {rowDef.driveModel}
                                                    </div>
                                                </div>
                                            ) : null}
                                            <div className={`text-xs theme-text-secondary ${isFirstPatternForHost ? 'mt-2' : ''}`}>
                                                {rowDef.pattern.replace('_', ' ').toUpperCase()}
                                            </div>
                                        </td>
                                        {allBlockSizes.map((blockSize, blockIndex) => {
                                            const cell = heatmapData[rowIndex][blockIndex];
                                            const colorClass = getColorForNormalizedIOPS(cell.normalizedIops, actualTheme === 'dark');

            // Debug each cell
            console.log(`Cell ${rowDef.hostname}-${rowDef.pattern}-${blockSize}:`, {
                iops: cell.iops,
                normalizedIops: cell.normalizedIops,
                blockSize: cell.blockSize,
                hasData: cell.iops > 0,
                configFound: !!cell.iops
            });

                                            return (
                                                <td
                                                    key={`${rowDef.hostname}-${rowDef.pattern}-${blockSize}`}
                                                    className={`border border-gray-300 dark:border-gray-600 p-2 text-center cursor-pointer transition-all hover:scale-105 hover:shadow-lg ${colorClass}`}
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
                                                        minWidth: '80px',
                                                        height: '60px',
                                                        backgroundColor: cell.iops > 0 ? undefined : '#f3f4f6'
                                                    }}
                                                >
                                                    <div className="text-xs font-bold">
                                                        {cell.iops > 0 ? formatIOPS(cell.iops) : '—'}
                                                    </div>
                                                    {cell.normalizedIops > 0 && (
                                                        <div className="text-xs opacity-75">
                                                            {cell.normalizedIops.toFixed(0)}%
                                                        </div>
                                                    )}
                                                    {/* Debug info */}
                                                    <div className="text-xs text-red-500 mt-1">
                                                        iops:{cell.iops} norm:{cell.normalizedIops.toFixed(1)}
                                                    </div>
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
                                    <div>Avg Latency: <span className="font-medium">{hoveredCell.cell.avgLatency.toFixed(2)}ms</span></div>
                                )}
                                {hoveredCell.cell.bandwidth && (
                                    <div>Bandwidth: <span className="font-medium">{hoveredCell.cell.bandwidth.toFixed(1)} MB/s</span></div>
                                )}
                                {hoveredCell.cell.p95Latency && (
                                    <div>95th %ile: <span className="font-medium">{hoveredCell.cell.p95Latency.toFixed(2)}ms</span></div>
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
