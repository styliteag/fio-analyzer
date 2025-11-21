import React from 'react';
import type { DriveAnalysis } from '../../services/api/hostAnalysis';
import { formatLatencyMicroseconds } from '../../services/data/formatters';

interface PerformanceChartsProps {
    drives: DriveAnalysis[];
}

interface ChartRow {
    hostname: string;
    pattern: string;
    driveModel: string;
    protocol: string;
    driveType: string;
    hostKey: string;
    blockSize: string;
    queueDepth: number;
    numJobs?: number | null;
    iodepth?: number | null;
    iops: number;
    bandwidth?: number;
    avgLatency?: number;
    p70Latency?: number;
    p90Latency?: number;
    p95Latency?: number;
    p99Latency?: number;
    timestamp: string;
}

type BarMode = 'stacked' | 'grouped';
type RowSortOption = 'hostname' | 'pattern' | 'blockSize';

const PerformanceCharts: React.FC<PerformanceChartsProps> = ({ drives }) => {
    const [hoveredRow, setHoveredRow] = React.useState<{ row: ChartRow; x: number; y: number } | null>(null);
    const [barMode, setBarMode] = React.useState<BarMode>('grouped');
    const [rowSort, setRowSort] = React.useState<RowSortOption>('hostname');

    // Helper function to parse block size to bytes
    const parseBlockSizeToBytes = (size: string): number => {
        const match = size.match(/^(\d+(?:\.\d+)?)([KMGT]?)$/i);
        if (!match) return 0;
        const [, num, unit] = match;
        const value = parseFloat(num);
        const multipliers: Record<string, number> = { 'K': 1024, 'M': 1024*1024, 'G': 1024*1024*1024, 'T': 1024*1024*1024*1024 };
        return value * (multipliers[unit.toUpperCase()] || 1);
    };

    // Helper function to get pattern sort priority
    const getPatternSortPriority = (pattern: string): number => {
        if (pattern.includes('read') && !pattern.includes('write')) return 1;
        if (pattern.includes('write') && !pattern.includes('read')) return 2;
        return 3;
    };

    // Map API patterns to display patterns
    const patternMapping: Record<string, string> = React.useMemo(() => ({
        'randread': 'RANDOM READ',
        'randwrite': 'RANDOM WRITE',
        'read': 'SEQUENTIAL READ',
        'write': 'SEQUENTIAL WRITE'
    }), []);

    // Calculate maximum values for normalization
    let maxIOPS = 0;
    let maxBandwidth = 0;
    let maxResponsiveness = 0;
    let maxLatency = 0;

    drives.forEach((drive) => {
        drive.configurations.forEach(config => {
            if (config.iops !== null && config.iops !== undefined) {
                const iopsValue = typeof config.iops === 'string' ? parseFloat(config.iops) : config.iops;
                if (!isNaN(iopsValue) && iopsValue > 0) {
                    maxIOPS = Math.max(maxIOPS, iopsValue);
                }
            }
            if (config.bandwidth !== null && config.bandwidth !== undefined && config.bandwidth > 0) {
                maxBandwidth = Math.max(maxBandwidth, config.bandwidth);
            }
            if (config.avg_latency !== null && config.avg_latency !== undefined && config.avg_latency > 0) {
                const responsiveness = 1000 / config.avg_latency;
                maxResponsiveness = Math.max(maxResponsiveness, responsiveness);
                maxLatency = Math.max(maxLatency, config.avg_latency);
            }
        });
    });

    const iopsRange = maxIOPS > 0 ? maxIOPS : 1;
    const bandwidthRange = maxBandwidth > 0 ? maxBandwidth : 1;
    const responsivenessRange = maxResponsiveness > 0 ? maxResponsiveness : 1;
    const latencyRange = maxLatency > 0 ? maxLatency : 1;

    // Build chart rows - each row represents one test configuration
    const chartRows = React.useMemo(() => {
        const rows: ChartRow[] = [];

        drives.forEach((drive) => {
            const hostname = drive.hostname;
            const driveModel = drive.drive_model || '';
            const protocol = drive.protocol || 'unknown';
            const driveType = drive.drive_type || '';
            const hostKey = `${hostname}-${protocol}-${driveModel}-${driveType}`;

            drive.configurations.forEach((config) => {
                const iopsValue = typeof config.iops === 'string' ? parseFloat(config.iops) : config.iops;
                if (!iopsValue || iopsValue <= 0) return;

                const mappedPattern = patternMapping[config.read_write_pattern] || config.read_write_pattern.toUpperCase();

                rows.push({
                    hostname,
                    pattern: mappedPattern,
                    driveModel,
                    protocol,
                    driveType,
                    hostKey,
                    blockSize: config.block_size,
                    queueDepth: config.queue_depth,
                    numJobs: config.num_jobs ?? undefined,
                    iodepth: config.iodepth ?? undefined,
                    iops: iopsValue,
                    bandwidth: config.bandwidth !== null && config.bandwidth !== undefined ? config.bandwidth : undefined,
                    avgLatency: config.avg_latency !== null && config.avg_latency !== undefined ? config.avg_latency : undefined,
                    p70Latency: config.p70_latency !== null && config.p70_latency !== undefined ? config.p70_latency : undefined,
                    p90Latency: config.p90_latency !== null && config.p90_latency !== undefined ? config.p90_latency : undefined,
                    p95Latency: config.p95_latency !== null && config.p95_latency !== undefined ? config.p95_latency : undefined,
                    p99Latency: config.p99_latency !== null && config.p99_latency !== undefined ? config.p99_latency : undefined,
                    timestamp: config.timestamp,
                });
            });
        });

        // Sort rows based on selected option
        return rows.sort((a, b) => {
            switch (rowSort) {
                case 'hostname': {
                    const hostCompare = a.hostname.localeCompare(b.hostname, undefined, { numeric: true, sensitivity: 'base' });
                    if (hostCompare !== 0) return hostCompare;
                    const hostKeyCompare = a.hostKey.localeCompare(b.hostKey, undefined, { numeric: true, sensitivity: 'base' });
                    if (hostKeyCompare !== 0) return hostKeyCompare;
                    const aPriority = getPatternSortPriority(a.pattern);
                    const bPriority = getPatternSortPriority(b.pattern);
                    if (aPriority !== bPriority) return aPriority - bPriority;
                    return parseBlockSizeToBytes(a.blockSize) - parseBlockSizeToBytes(b.blockSize);
                }
                case 'pattern': {
                    const aPriority = getPatternSortPriority(a.pattern);
                    const bPriority = getPatternSortPriority(b.pattern);
                    if (aPriority !== bPriority) return aPriority - bPriority;
                    const patternCompare = a.pattern.localeCompare(b.pattern);
                    if (patternCompare !== 0) return patternCompare;
                    const hostCompare = a.hostname.localeCompare(b.hostname, undefined, { numeric: true, sensitivity: 'base' });
                    if (hostCompare !== 0) return hostCompare;
                    return parseBlockSizeToBytes(a.blockSize) - parseBlockSizeToBytes(b.blockSize);
                }
                case 'blockSize': {
                    const blockSizeCompare = parseBlockSizeToBytes(a.blockSize) - parseBlockSizeToBytes(b.blockSize);
                    if (blockSizeCompare !== 0) return blockSizeCompare;
                    const hostCompare = a.hostname.localeCompare(b.hostname, undefined, { numeric: true, sensitivity: 'base' });
                    if (hostCompare !== 0) return hostCompare;
                    const aPriority = getPatternSortPriority(a.pattern);
                    const bPriority = getPatternSortPriority(b.pattern);
                    return aPriority - bPriority;
                }
                default:
                    return 0;
            }
        });
    }, [drives, patternMapping, rowSort]);

    const formatIOPS = (iops: number): string => {
        if (iops >= 1000000) return (iops / 1000000).toFixed(1) + 'M';
        if (iops >= 1000) return (iops / 1000).toFixed(0) + 'k';
        return iops.toFixed(0);
    };

    const formatBandwidth = (bw: number): string => {
        if (bw >= 1000) return (bw / 1000).toFixed(1) + ' GB/s';
        return bw.toFixed(0) + ' MB/s';
    };

    if (!drives || drives.length === 0) {
        return (
            <div className="w-full p-8 text-center">
                <p className="text-lg theme-text-primary">No data available for charts</p>
                <p className="text-sm theme-text-secondary mt-2">Please select hosts with performance data</p>
            </div>
        );
    }

    return (
        <div className="w-full">
            <div className="mb-6">
                <h4 className="text-xl font-bold theme-text-primary mb-2">
                    Performance Charts
                </h4>
                <p className="text-sm theme-text-secondary mb-4">
                    Horizontal bar visualization of performance metrics across all test configurations.
                    Each row represents a single test configuration with metrics displayed as bars.
                </p>
                <div className="text-xs theme-text-secondary mb-4 space-y-1">
                    <p>
                        <strong>Bandwidth Calculation:</strong> Bandwidth (MB/s) = (IOPS × BlockSize) / (1024 × 1024)
                    </p>
                    <p>
                        <strong>Responsiveness</strong> = 1000 ÷ Latency (ops/ms) • Higher values = Better performance
                    </p>
                </div>

                {/* Customization Controls */}
                <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                    <h5 className="text-sm font-semibold theme-text-primary mb-3">Customization Options</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Bar Mode */}
                        <div>
                            <label className="block text-xs font-medium theme-text-secondary mb-2">
                                Bar Display Mode
                            </label>
                            <select
                                value={barMode}
                                onChange={(e) => setBarMode(e.target.value as BarMode)}
                                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="grouped">Grouped Bars (Separate bars for each metric)</option>
                                <option value="stacked">Stacked Bars (All metrics in one bar)</option>
                            </select>
                        </div>

                        {/* Row Sorting */}
                        <div>
                            <label className="block text-xs font-medium theme-text-secondary mb-2">
                                Row Sorting
                            </label>
                            <select
                                value={rowSort}
                                onChange={(e) => setRowSort(e.target.value as RowSortOption)}
                                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="hostname">Hostname</option>
                                <option value="pattern">Pattern</option>
                                <option value="blockSize">Block Size</option>
                            </select>
                        </div>
                    </div>
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
                    <div className="text-xs opacity-75">
                        Hover rows for detailed metrics • Longer bars = Better performance (except Latency: shorter = better)
                    </div>
                </div>
            </div>

            {/* Chart Rows */}
            <div className="space-y-3">
                {chartRows.map((row, index) => {
                    const iopsPercent = (row.iops / iopsRange) * 100;
                    const bandwidthPercent = row.bandwidth ? (row.bandwidth / bandwidthRange) * 100 : 0;
                    const responsivenessPercent = row.avgLatency ? ((1000 / row.avgLatency) / responsivenessRange) * 100 : 0;
                    const latencyPercent = row.avgLatency ? (row.avgLatency / latencyRange) * 100 : 0;

                    const isNewHost = index === 0 || chartRows[index - 1].hostKey !== row.hostKey;

                    return (
                        <div
                            key={`${row.hostKey}-${row.pattern}-${row.blockSize}-${index}`}
                            className={`p-4 border rounded-lg transition-all hover:shadow-lg cursor-pointer ${
                                isNewHost 
                                    ? 'border-blue-500 dark:border-blue-400 border-2 bg-blue-50/30 dark:bg-blue-950/20' 
                                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
                            }`}
                            onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setHoveredRow({
                                    row,
                                    x: rect.left + rect.width / 2,
                                    y: rect.top
                                });
                            }}
                            onMouseLeave={() => setHoveredRow(null)}
                        >
                            {/* Row Header */}
                            <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
                                <span className="font-bold theme-text-primary">{row.hostname}</span>
                                <span className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 theme-text-secondary">
                                    {row.pattern}
                                </span>
                                <span className="text-xs px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                                    {row.blockSize}
                                </span>
                                <span className="text-xs theme-text-secondary">
                                    {row.protocol} • {row.driveModel}
                                </span>
                                <span className="text-xs theme-text-secondary">
                                    QD: {row.queueDepth}
                                </span>
                            </div>

                            {/* Bars */}
                            {barMode === 'grouped' ? (
                                <div className="space-y-2">
                                    {/* IOPS Bar */}
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-medium text-blue-600 dark:text-blue-300 w-16">IOPS</span>
                                        <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-6 relative overflow-hidden">
                                            <div
                                                className="bg-blue-500 dark:bg-blue-500/70 h-6 rounded-full flex items-center justify-end pr-2 transition-all duration-300"
                                                style={{ width: `${Math.max(2, Math.min(100, iopsPercent))}%` }}
                                            >
                                                <span className="text-xs font-semibold text-white">
                                                    {formatIOPS(row.iops)}
                                                </span>
                                            </div>
                                        </div>
                                        <span className="text-xs theme-text-secondary w-12 text-right">
                                            {iopsPercent.toFixed(0)}%
                                        </span>
                                    </div>

                                    {/* Bandwidth Bar */}
                                    {row.bandwidth !== undefined && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-medium text-green-600 dark:text-green-300 w-16">BW</span>
                                            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-6 relative overflow-hidden">
                                                <div
                                                    className="bg-green-500 dark:bg-green-500/70 h-6 rounded-full flex items-center justify-end pr-2 transition-all duration-300"
                                                    style={{ width: `${Math.max(2, Math.min(100, bandwidthPercent))}%` }}
                                                >
                                                    <span className="text-xs font-semibold text-white">
                                                        {formatBandwidth(row.bandwidth)}
                                                    </span>
                                                </div>
                                            </div>
                                            <span className="text-xs theme-text-secondary w-12 text-right">
                                                {bandwidthPercent.toFixed(0)}%
                                            </span>
                                        </div>
                                    )}

                                    {/* Responsiveness Bar */}
                                    {row.avgLatency !== undefined && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-medium text-red-600 dark:text-red-300 w-16">RESP</span>
                                            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-6 relative overflow-hidden">
                                                <div
                                                    className="bg-red-500 dark:bg-red-500/70 h-6 rounded-full flex items-center justify-end pr-2 transition-all duration-300"
                                                    style={{ width: `${Math.max(2, Math.min(100, responsivenessPercent))}%` }}
                                                >
                                                    <span className="text-xs font-semibold text-white">
                                                        {(1000 / row.avgLatency).toFixed(1)} ops/ms
                                                    </span>
                                                </div>
                                            </div>
                                            <span className="text-xs theme-text-secondary w-12 text-right">
                                                {responsivenessPercent.toFixed(0)}%
                                            </span>
                                        </div>
                                    )}

                                    {/* Latency Bar */}
                                    {row.avgLatency !== undefined && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-medium text-purple-600 dark:text-purple-300 w-16">LAT</span>
                                            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-6 relative overflow-hidden">
                                                <div
                                                    className="bg-purple-500 dark:bg-purple-500/70 h-6 rounded-full flex items-center justify-end pr-2 transition-all duration-300"
                                                    style={{ width: `${Math.max(2, Math.min(100, latencyPercent))}%` }}
                                                >
                                                    <span className="text-xs font-semibold text-white">
                                                        {formatLatencyMicroseconds(row.avgLatency).text}
                                                    </span>
                                                </div>
                                            </div>
                                            <span className="text-xs theme-text-secondary w-12 text-right">
                                                {latencyPercent.toFixed(0)}%
                                            </span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* Stacked Bar Mode */
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-medium theme-text-primary w-16">Metrics</span>
                                        <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-8 relative overflow-hidden flex">
                                            {/* IOPS segment */}
                                            <div
                                                className="bg-blue-500 dark:bg-blue-500/70 h-8 flex items-center justify-center transition-all duration-300"
                                                style={{ width: `${(iopsPercent / 4)}%` }}
                                                title={`IOPS: ${formatIOPS(row.iops)}`}
                                            >
                                                {iopsPercent > 15 && (
                                                    <span className="text-xs font-semibold text-white">IOPS</span>
                                                )}
                                            </div>
                                            {/* Bandwidth segment */}
                                            {row.bandwidth !== undefined && (
                                                <div
                                                    className="bg-green-500 dark:bg-green-500/70 h-8 flex items-center justify-center transition-all duration-300"
                                                    style={{ width: `${(bandwidthPercent / 4)}%` }}
                                                    title={`Bandwidth: ${formatBandwidth(row.bandwidth)}`}
                                                >
                                                    {bandwidthPercent > 15 && (
                                                        <span className="text-xs font-semibold text-white">BW</span>
                                                    )}
                                                </div>
                                            )}
                                            {/* Responsiveness segment */}
                                            {row.avgLatency !== undefined && (
                                                <div
                                                    className="bg-red-500 dark:bg-red-500/70 h-8 flex items-center justify-center transition-all duration-300"
                                                    style={{ width: `${(responsivenessPercent / 4)}%` }}
                                                    title={`Responsiveness: ${(1000 / row.avgLatency).toFixed(1)} ops/ms`}
                                                >
                                                    {responsivenessPercent > 15 && (
                                                        <span className="text-xs font-semibold text-white">RESP</span>
                                                    )}
                                                </div>
                                            )}
                                            {/* Latency segment */}
                                            {row.avgLatency !== undefined && (
                                                <div
                                                    className="bg-purple-500 dark:bg-purple-500/70 h-8 flex items-center justify-center transition-all duration-300"
                                                    style={{ width: `${(latencyPercent / 4)}%` }}
                                                    title={`Latency: ${formatLatencyMicroseconds(row.avgLatency).text}`}
                                                >
                                                    {latencyPercent > 15 && (
                                                        <span className="text-xs font-semibold text-white">LAT</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {/* Values below stacked bar */}
                                    <div className="flex items-center gap-4 text-xs theme-text-secondary ml-20">
                                        <span>IOPS: {formatIOPS(row.iops)}</span>
                                        {row.bandwidth !== undefined && <span>BW: {formatBandwidth(row.bandwidth)}</span>}
                                        {row.avgLatency !== undefined && <span>RESP: {(1000 / row.avgLatency).toFixed(1)} ops/ms</span>}
                                        {row.avgLatency !== undefined && <span>LAT: {formatLatencyMicroseconds(row.avgLatency).text}</span>}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Hover Tooltip */}
            {hoveredRow && (
                <div
                    className="fixed z-50 pointer-events-none"
                    style={{
                        left: `${hoveredRow.x}px`,
                        top: `${hoveredRow.y - 10}px`,
                        transform: 'translate(-50%, -100%)'
                    }}
                >
                    <div className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-3 rounded-lg shadow-xl text-xs max-w-xs">
                        <div className="font-bold mb-2">{hoveredRow.row.hostname} - {hoveredRow.row.pattern}</div>
                        <div className="space-y-1">
                            <div>Block Size: {hoveredRow.row.blockSize}</div>
                            <div>Queue Depth: {hoveredRow.row.queueDepth}</div>
                            <div>IOPS: {formatIOPS(hoveredRow.row.iops)}</div>
                            {hoveredRow.row.bandwidth !== undefined && <div>Bandwidth: {formatBandwidth(hoveredRow.row.bandwidth)}</div>}
                            {hoveredRow.row.avgLatency !== undefined && (
                                <>
                                    <div>Avg Latency: {formatLatencyMicroseconds(hoveredRow.row.avgLatency).text}</div>
                                    <div>Responsiveness: {(1000 / hoveredRow.row.avgLatency).toFixed(2)} ops/ms</div>
                                </>
                            )}
                            {hoveredRow.row.p99Latency !== undefined && <div>P99 Latency: {formatLatencyMicroseconds(hoveredRow.row.p99Latency).text}</div>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PerformanceCharts;
