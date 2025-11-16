import { useMemo } from 'react';
import type { DriveAnalysis, TestConfiguration } from '../services/api/hostAnalysis';

export type MetricType = 'iops' | 'avg_latency' | 'bandwidth' | 'p70_latency' | 'p90_latency' | 'p95_latency' | 'p99_latency';

export interface HeatmapCell {
    row: string;
    col: string;
    value: number | null;
    rawConfig: TestConfiguration;
    hostname: string;
}

export interface HeatmapData {
    rows: string[];
    cols: string[];
    cells: HeatmapCell[];
    min: number;
    max: number;
}

export const useHeatmapData = () => {
    // Flatten DriveAnalysis[] into flat list of configs with hostname
    const flattenConfigurations = useMemo(() => {
        return (drives: DriveAnalysis[]) => {
            const flattened: Array<TestConfiguration & { hostname: string; drive_model: string; protocol: string; drive_type: string }> = [];

            drives.forEach(drive => {
                drive.configurations.forEach(config => {
                    flattened.push({
                        ...config,
                        hostname: drive.hostname,
                        drive_model: drive.drive_model,
                        protocol: drive.protocol,
                        drive_type: drive.drive_type
                    });
                });
            });

            return flattened;
        };
    }, []);

    // Create heatmap: rows = configs, cols = hosts
    const createHostHeatmap = useMemo(() => {
        return (drives: DriveAnalysis[], metric: MetricType): HeatmapData => {
            const configs = flattenConfigurations(drives);
            const rowSet = new Set<string>();
            const colSet = new Set<string>();
            const cells: HeatmapCell[] = [];
            let min = Infinity;
            let max = -Infinity;

            configs.forEach(config => {
                const value = config[metric];
                if (value === null || value === undefined) return;

                const row = getConfigKey(config);
                const col = config.hostname;

                rowSet.add(row);
                colSet.add(col);
                cells.push({ row, col, value, rawConfig: config, hostname: config.hostname });

                if (value < min) min = value;
                if (value > max) max = value;
            });

            return {
                rows: Array.from(rowSet).sort(),
                cols: Array.from(colSet).sort(),
                cells,
                min: min === Infinity ? 0 : min,
                max: max === -Infinity ? 100 : max
            };
        };
    }, [flattenConfigurations]);

    // Create heatmap: configurable dimensions
    const createMatrixHeatmap = useMemo(() => {
        return (
            drives: DriveAnalysis[],
            metric: MetricType,
            rowDimension: 'block_size' | 'queue_depth' | 'protocol',
            colDimension: 'read_write_pattern' | 'drive_type' | 'protocol'
        ): HeatmapData => {
            const configs = flattenConfigurations(drives);
            const rowSet = new Set<string>();
            const colSet = new Set<string>();
            type ExtendedConfig = TestConfiguration & { hostname: string; drive_model: string; protocol: string; drive_type: string };
            const cellMap = new Map<string, { value: number; count: number; configs: ExtendedConfig[] }>();
            let min = Infinity;
            let max = -Infinity;

            configs.forEach(config => {
                const value = config[metric];
                if (value === null || value === undefined) return;

                const row = getDimensionValue(config, rowDimension);
                const col = getDimensionValue(config, colDimension);
                const key = `${row}|${col}`;

                rowSet.add(row);
                colSet.add(col);

                if (!cellMap.has(key)) {
                    cellMap.set(key, { value: 0, count: 0, configs: [] });
                }

                const cell = cellMap.get(key)!;
                cell.value += value;
                cell.count += 1;
                cell.configs.push(config);
            });

            const cells: HeatmapCell[] = [];
            cellMap.forEach((data, key) => {
                const [row, col] = key.split('|');
                const avgValue = data.value / data.count;

                cells.push({
                    row,
                    col,
                    value: avgValue,
                    rawConfig: data.configs[0],
                    hostname: data.configs[0].hostname
                });

                if (avgValue < min) min = avgValue;
                if (avgValue > max) max = avgValue;
            });

            return {
                rows: sortDimension(Array.from(rowSet), rowDimension),
                cols: sortDimension(Array.from(colSet), colDimension),
                cells,
                min: min === Infinity ? 0 : min,
                max: max === -Infinity ? 100 : max
            };
        };
    }, [flattenConfigurations]);

    // Get color based on value (min-max normalization)
    const getHeatmapColor = (value: number, min: number, max: number): string => {
        if (value === null || value === undefined) return '#f3f4f6'; // gray-100

        const range = max - min;
        if (range === 0) return '#fbbf24'; // yellow-400

        const normalized = (value - min) / range;

        // Color scale: red (0) -> yellow (0.5) -> green (1)
        if (normalized < 0.5) {
            // Red to yellow
            const r = 255;
            const g = Math.round(255 * (normalized * 2));
            return `rgb(${r}, ${g}, 0)`;
        } else {
            // Yellow to green
            const r = Math.round(255 * (1 - (normalized - 0.5) * 2));
            const g = 255;
            return `rgb(${r}, ${g}, 0)`;
        }
    };

    return {
        createHostHeatmap,
        createMatrixHeatmap,
        getHeatmapColor,
        getConfigKey,
        flattenConfigurations
    };
};

// Helper functions
function getConfigKey(config: TestConfiguration): string {
    return `${config.read_write_pattern} ${config.block_size} QD${config.queue_depth}`;
}

function getDimensionValue(config: TestConfiguration & { hostname?: string; drive_model?: string; protocol?: string; drive_type?: string }, dimension: string): string {
    switch (dimension) {
        case 'block_size':
            return config.block_size;
        case 'queue_depth':
            return String(config.queue_depth);
        case 'protocol':
            return config.protocol || 'Unknown';
        case 'read_write_pattern':
            return config.read_write_pattern;
        case 'drive_type':
            return config.drive_type || 'Unknown';
        default:
            return 'Unknown';
    }
}

function sortDimension(values: string[], dimension: string): string[] {
    if (dimension === 'block_size') {
        return values.sort((a, b) => {
            const sizeA = parseBlockSize(a);
            const sizeB = parseBlockSize(b);
            return sizeA - sizeB;
        });
    } else if (dimension === 'queue_depth') {
        return values.sort((a, b) => Number(a) - Number(b));
    } else {
        return values.sort();
    }
}

function parseBlockSize(size: string): number {
    const match = size.match(/^(\d+)([KM]?)$/);
    if (!match) return 0;

    const num = parseInt(match[1]);
    const unit = match[2];

    if (unit === 'K') return num * 1024;
    if (unit === 'M') return num * 1024 * 1024;
    return num;
}
