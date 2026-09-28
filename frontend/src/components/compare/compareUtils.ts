// Pure helpers for the Compare page: metric labels, formatting, block size order, diff matrix cells
import type { CompareCell, CompareMetric, CompareRow } from '../../services/api/compare';

export const METRIC_OPTIONS: readonly { readonly value: CompareMetric; readonly label: string; readonly unit: string }[] = [
    { value: 'iops', label: 'IOPS', unit: '' },
    { value: 'bandwidth', label: 'Bandwidth', unit: 'MB/s' },
    { value: 'avg_latency', label: 'Avg latency', unit: 'ms' },
    { value: 'p95_latency', label: 'P95 latency', unit: 'ms' },
    { value: 'p99_latency', label: 'P99 latency', unit: 'ms' },
];

export const METRIC_VALUES = METRIC_OPTIONS.map((option) => option.value);

const HIGHER_IS_BETTER: ReadonlySet<CompareMetric> = new Set(['iops', 'bandwidth']);

/** Direction of a diff for a metric: higher is better for IOPS/bandwidth, lower for latencies */
export const betterForMetric = (metric: CompareMetric, diff: number | null): boolean | null => {
    if (diff === null || diff === 0) return null;
    return HIGHER_IS_BETTER.has(metric) ? diff > 0 : diff < 0;
};

/** "host|proto|type|model" as "host · proto · type · model" (a wildcard reads "any") */
export const targetLabel = (target: string): string =>
    target.split('|').map((part) => (part === '*' ? 'any' : part)).join(' · ');

export const metricLabel = (metric: CompareMetric): string =>
    METRIC_OPTIONS.find((option) => option.value === metric)?.label ?? metric;

const UNIT_FACTORS: Readonly<Record<string, number>> = { '': 1, k: 1024, m: 1024 ** 2, g: 1024 ** 3, t: 1024 ** 4 };

/** Bytes of a fio size like 4K, 64k, 1M or 512; unparseable values sort last */
export const blockSizeBytes = (value: string): number => {
    const match = /^\s*(\d+(?:\.\d+)?)\s*([kmgt]?)(?:i?b)?\s*$/i.exec(value);
    return match ? Number(match[1]) * UNIT_FACTORS[match[2].toLowerCase()] : Number.POSITIVE_INFINITY;
};

export const compareBlockSizes = (a: string, b: string): number => blockSizeBytes(a) - blockSizeBytes(b) || a.localeCompare(b);

export const median = (values: readonly number[]): number | null => {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

/** Signed percentage with a real minus sign, so the direction never depends on colour alone */
export const formatDiff = (value: number | null): string => {
    if (value === null) return '–';
    const rounded = Math.round(value * 10) / 10;
    if (rounded === 0) return '±0%';
    return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
};

export const formatMetric = (metric: CompareMetric, value: number | null | undefined): string => {
    if (value === null || value === undefined) return '–';
    if (metric === 'iops') return Math.round(value).toLocaleString();
    if (metric === 'bandwidth') return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} MB/s`;
    return `${value < 1 ? value.toPrecision(3) : value.toFixed(2)} ms`;
};

export const cellValue = (cell: CompareCell | null | undefined, metric: CompareMetric): number | null => cell?.[metric] ?? null;

const TONES = {
    neutral: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100',
    better1: 'bg-green-100 text-green-900 dark:bg-green-900/40 dark:text-green-100',
    better2: 'bg-green-300 text-green-950 dark:bg-green-700/70 dark:text-white',
    better3: 'bg-green-600 text-white dark:bg-green-600 dark:text-white',
    worse1: 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100',
    worse2: 'bg-red-300 text-red-950 dark:bg-red-700/70 dark:text-white',
    worse3: 'bg-red-600 text-white dark:bg-red-600 dark:text-white',
    empty: 'theme-text-tertiary',
} as const;

/** Tailwind classes for a diff: |diff| < 5 % neutral, then < 20 %, < 50 %, ≥ 50 % */
export const diffTone = (diff: number | null, better: boolean | null): string => {
    if (diff === null) return TONES.empty;
    const magnitude = Math.abs(diff);
    if (magnitude < 5 || better === null) return TONES.neutral;
    const level = magnitude < 20 ? 1 : magnitude < 50 ? 2 : 3;
    const key = `${better ? 'better' : 'worse'}${level}` as keyof typeof TONES;
    return TONES[key];
};

export interface ConfigFilters {
    readonly numJobs: string;
    readonly iodepth: string;
    readonly direct: string;
}

const matches = (filter: string, value: number | null): boolean => filter === '' || String(value) === filter;

export const applyConfigFilters = (rows: readonly CompareRow[], filters: ConfigFilters): CompareRow[] =>
    rows.filter(
        (row) => matches(filters.numJobs, row.num_jobs) && matches(filters.iodepth, row.iodepth) && matches(filters.direct, row.direct),
    );

/** Distinct values of a numeric config column, ascending */
export const distinctValues = (rows: readonly CompareRow[], key: 'num_jobs' | 'iodepth' | 'direct'): string[] =>
    [...new Set(rows.map((row) => row[key]).filter((value): value is number => value !== null))]
        .sort((a, b) => a - b)
        .map(String);
