import { useMemo } from 'react';
import type { DriveAnalysis, TestConfiguration } from '../services/api/hostAnalysis';
import type { MetricType } from './useHeatmapData';

export interface TrendData {
    labels: (string | number)[];
    datasets: {
        label: string;
        data: number[];
        borderColor: string;
        backgroundColor: string;
        tension: number;
    }[];
}

export const useTrendAnalysis = () => {
    // Flatten configurations with drive context
    const flattenConfigurations = useMemo(() => {
        return (drives: DriveAnalysis[]) => {
            return drives.flatMap(drive =>
                drive.configurations.map(config => ({
                    ...config,
                    hostname: drive.hostname,
                    drive_model: drive.drive_model,
                    drive_type: drive.drive_type,
                    protocol: drive.protocol
                }))
            );
        };
    }, []);

    // Create trend chart for block size performance
    const createBlockSizeTrend = useMemo(() => {
        return (
            drives: DriveAnalysis[],
            metric: MetricType,
            groupBy: 'hostname' | 'read_write_pattern',
            colors: string[]
        ): TrendData => {
            const configs = flattenConfigurations(drives);

            // Group by the dimension
            const groups = new Map<string, typeof configs>();
            configs.forEach(config => {
                const key = groupBy === 'hostname' ? config.hostname : config.read_write_pattern;
                if (!groups.has(key)) {
                    groups.set(key, []);
                }
                groups.get(key)!.push(config);
            });

            // Extract unique block sizes (sorted)
            const blockSizes = Array.from(new Set(configs.map(c => c.block_size)))
                .sort((a, b) => parseBlockSize(a) - parseBlockSize(b));

            // Create datasets
            const datasets = Array.from(groups.entries()).map(([groupName, groupConfigs], index) => {
                const data = blockSizes.map(blockSize => {
                    const matchingConfigs = groupConfigs.filter(c => c.block_size === blockSize);
                    if (matchingConfigs.length === 0) return 0;

                    // Average if multiple configs
                    const values = matchingConfigs
                        .map(c => c[metric])
                        .filter((v): v is number => v !== null && v !== undefined);

                    return values.length > 0
                        ? values.reduce((acc, v) => acc + v, 0) / values.length
                        : 0;
                });

                const color = colors[index % colors.length];

                return {
                    label: groupName,
                    data,
                    borderColor: color,
                    backgroundColor: color,
                    tension: 0.3
                };
            });

            return {
                labels: blockSizes,
                datasets
            };
        };
    }, [flattenConfigurations]);

    // Create trend chart for queue depth scaling
    const createQueueDepthTrend = useMemo(() => {
        return (
            drives: DriveAnalysis[],
            metric: MetricType,
            groupBy: 'hostname' | 'read_write_pattern',
            colors: string[]
        ): TrendData => {
            const configs = flattenConfigurations(drives);

            // Group by the dimension
            const groups = new Map<string, typeof configs>();
            configs.forEach(config => {
                const key = groupBy === 'hostname' ? config.hostname : config.read_write_pattern;
                if (!groups.has(key)) {
                    groups.set(key, []);
                }
                groups.get(key)!.push(config);
            });

            // Extract unique queue depths (sorted)
            const queueDepths = Array.from(new Set(configs.map(c => c.queue_depth)))
                .sort((a, b) => a - b);

            // Create datasets
            const datasets = Array.from(groups.entries()).map(([groupName, groupConfigs], index) => {
                const data = queueDepths.map(qd => {
                    const matchingConfigs = groupConfigs.filter(c => c.queue_depth === qd);
                    if (matchingConfigs.length === 0) return 0;

                    const values = matchingConfigs
                        .map(c => c[metric])
                        .filter((v): v is number => v !== null && v !== undefined);

                    return values.length > 0
                        ? values.reduce((acc, v) => acc + v, 0) / values.length
                        : 0;
                });

                const color = colors[index % colors.length];

                return {
                    label: groupName,
                    data,
                    borderColor: color,
                    backgroundColor: color,
                    tension: 0.3
                };
            });

            return {
                labels: queueDepths,
                datasets
            };
        };
    }, [flattenConfigurations]);

    // Calculate summary statistics
    const calculateSummary = useMemo(() => {
        return (drives: DriveAnalysis[], metric: MetricType) => {
            const configs = flattenConfigurations(drives);

            const values = configs
                .map(c => c[metric])
                .filter((v): v is number => v !== null && v !== undefined);

            if (values.length === 0) {
                return { avg: 0, min: 0, max: 0, count: 0 };
            }

            const sum = values.reduce((acc, v) => acc + v, 0);
            const avg = sum / values.length;
            const min = Math.min(...values);
            const max = Math.max(...values);

            return { avg, min, max, count: values.length };
        };
    }, [flattenConfigurations]);

    // Find best performing configuration
    const findBestConfig = useMemo(() => {
        return (drives: DriveAnalysis[], metric: MetricType): TestConfiguration | null => {
            const configs = flattenConfigurations(drives);

            if (configs.length === 0) return null;

            return configs.reduce((best, current) => {
                const bestValue = best[metric] ?? 0;
                const currentValue = current[metric] ?? 0;

                // For latency metrics, lower is better
                if (metric.includes('latency')) {
                    return currentValue < bestValue ? current : best;
                }
                // For IOPS/bandwidth, higher is better
                return currentValue > bestValue ? current : best;
            });
        };
    }, [flattenConfigurations]);

    return {
        createBlockSizeTrend,
        createQueueDepthTrend,
        calculateSummary,
        findBestConfig,
        flattenConfigurations
    };
};

// Helper function
function parseBlockSize(size: string): number {
    const match = size.match(/^(\d+)([KM]?)$/);
    if (!match) return 0;

    const num = parseInt(match[1]);
    const unit = match[2];

    if (unit === 'K') return num * 1024;
    if (unit === 'M') return num * 1024 * 1024;
    return num;
}
