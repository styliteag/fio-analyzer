// Group compare rows into a pattern × block size matrix per target
import type { CompareMetric, CompareRow } from '../../services/api/compare';
import { betterForMetric, cellValue, compareBlockSizes, formatDiff, formatMetric, median } from './compareUtils';

export interface MatrixCell {
    readonly count: number;
    readonly diff: number | null;
    readonly better: boolean | null;
    readonly mismatch: readonly string[];
    readonly tooltip: string;
}

export interface DiffMatrix {
    readonly patterns: readonly string[];
    readonly blockSizes: readonly string[];
    readonly cells: ReadonlyMap<string, MatrixCell>;
}

export const cellKey = (pattern: string, blockSize: string): string => `${pattern}\u0000${blockSize}`;

/** Short config description of a row, e.g. "jobs 4 · QD 32 · direct · sync" */
export const describeConfig = (row: CompareRow): string => {
    const parts = [
        `jobs ${row.num_jobs ?? '–'}`,
        `QD ${row.iodepth ?? '–'}`,
        row.direct === 1 ? 'direct' : 'buffered',
        row.sync ?? '–',
        row.test_size ?? null,
        row.duration != null ? `${row.duration}s` : null,
        row.layout || null,
    ];
    return parts.filter((part): part is string => part !== null).join(' · ');
};

const rowLine = (row: CompareRow, baseline: string, target: string, metric: CompareMetric): string => {
    const base = formatMetric(metric, cellValue(row.results[baseline], metric));
    const other = formatMetric(metric, cellValue(row.results[target], metric));
    const diff = formatDiff(row.diff_pct[target]?.[metric] ?? null);
    const mismatch = row.mismatch && row.mismatch.length > 0 ? ` ⚠ differs: ${row.mismatch.join(', ')}` : '';
    return `${describeConfig(row)}: baseline ${base} → ${other} (${diff})${mismatch}`;
};

const MAX_TOOLTIP_LINES = 12;

const buildCell = (rows: readonly CompareRow[], baseline: string, target: string, metric: CompareMetric): MatrixCell => {
    const diffs = rows.map((row) => row.diff_pct[target]?.[metric] ?? null).filter((value): value is number => value !== null);
    const diff = median(diffs);
    const mismatch = [...new Set(rows.flatMap((row) => row.mismatch ?? []))];
    const lines = rows.slice(0, MAX_TOOLTIP_LINES).map((row) => rowLine(row, baseline, target, metric));
    const more = rows.length > MAX_TOOLTIP_LINES ? [`… ${rows.length - MAX_TOOLTIP_LINES} more`] : [];
    const header = rows.length > 1 ? [`Median of ${rows.length} configurations: ${formatDiff(diff)}`] : [];
    return {
        count: rows.length,
        diff,
        better: rows.length === 1 ? (rows[0].better[target]?.[metric] ?? null) : betterForMetric(metric, diff),
        mismatch,
        tooltip: [...header, ...lines, ...more].join('\n'),
    };
};

/** Only rows where both baseline and target have a result take part */
export const buildDiffMatrix = (rows: readonly CompareRow[], baseline: string, target: string, metric: CompareMetric): DiffMatrix => {
    const present = rows.filter((row) => row.results[baseline] && row.results[target]);
    const groups = present.reduce<Map<string, CompareRow[]>>((acc, row) => {
        const key = cellKey(row.read_write_pattern, row.block_size);
        return new Map(acc).set(key, [...(acc.get(key) ?? []), row]);
    }, new Map());
    const cells = new Map([...groups].map(([key, group]) => [key, buildCell(group, baseline, target, metric)] as const));
    return {
        patterns: [...new Set(present.map((row) => row.read_write_pattern))].sort(),
        blockSizes: [...new Set(present.map((row) => row.block_size))].sort(compareBlockSizes),
        cells,
    };
};
