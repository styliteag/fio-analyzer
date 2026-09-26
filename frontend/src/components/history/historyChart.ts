// Pure helpers that turn time-series history rows into Chart.js input
import type { TooltipItem } from 'chart.js';

export interface HistoryMetric {
    readonly value: string;
    readonly label: string;
    readonly unit: string;
}

export const HISTORY_METRICS: readonly HistoryMetric[] = [
    { value: 'iops', label: 'IOPS', unit: 'IOPS' },
    { value: 'bandwidth', label: 'Bandwidth', unit: 'MB/s' },
    { value: 'avg_latency', label: 'Avg latency', unit: 'ms' },
    { value: 'p70_latency', label: 'P70 latency', unit: 'ms' },
    { value: 'p90_latency', label: 'P90 latency', unit: 'ms' },
    { value: 'p95_latency', label: 'P95 latency', unit: 'ms' },
    { value: 'p99_latency', label: 'P99 latency', unit: 'ms' },
];

export const HISTORY_DAY_OPTIONS: readonly { value: number; label: string }[] = [
    { value: 7, label: 'Last 7 days' },
    { value: 30, label: 'Last 30 days' },
    { value: 90, label: 'Last 90 days' },
    { value: 365, label: 'Last year' },
    { value: 0, label: 'All time' },
];

/** One row from /api/time-series/history: identity fields plus one numeric column per metric */
export interface HistoryRow {
    readonly timestamp: string;
    readonly hostname: string;
    readonly protocol: string;
    readonly drive_model: string;
    readonly block_size: string;
    readonly read_write_pattern: string;
    readonly queue_depth: number;
    readonly [metric: string]: string | number | null | undefined;
}

const PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#84cc16', '#f97316', '#6366f1'];

export const configKey = (row: HistoryRow): string => `${row.read_write_pattern}|${row.block_size}|${row.queue_depth}`;

export const formatConfigKey = (key: string): string => {
    const [pattern, blockSize, queueDepth] = key.split('|');
    return `${pattern} · ${blockSize} · QD${queueDepth}`;
};

const metricInfo = (metric: string): HistoryMetric =>
    HISTORY_METRICS.find((item) => item.value === metric) ?? { value: metric, label: metric, unit: '' };

export const uniqueConfigKeys = (rows: readonly HistoryRow[]): string[] =>
    [...new Set(rows.map(configKey))].sort();

export const buildHistoryChartData = (
    rows: readonly HistoryRow[],
    selectedConfigs: readonly string[],
    metrics: readonly string[],
    includeHost: boolean,
) => {
    const visible = selectedConfigs.length > 0 ? rows.filter((row) => selectedConfigs.includes(configKey(row))) : rows;
    const series = new Map<string, { x: string; y: number }[]>();

    visible.forEach((row) => {
        metrics.forEach((metric) => {
            const value = row[metric];
            if (typeof value !== 'number') return;
            const host = includeHost ? `${row.hostname} · ` : '';
            const label = `${host}${formatConfigKey(configKey(row))} · ${metricInfo(metric).label}`;
            series.set(label, [...(series.get(label) ?? []), { x: row.timestamp, y: value }]);
        });
    });

    const datasets = [...series.entries()].map(([label, data], index) => {
        const color = PALETTE[index % PALETTE.length];
        return {
            label,
            data: [...data].sort((a, b) => a.x.localeCompare(b.x)),
            borderColor: color,
            backgroundColor: color,
            fill: false,
            tension: 0.3,
            pointRadius: 2,
            pointHoverRadius: 4,
        };
    });

    return { datasets };
};

const timeUnitForDays = (days: number): 'day' | 'week' | 'month' => {
    if (days === 0 || days > 90) return 'month';
    return days <= 7 ? 'day' : 'week';
};

export const buildHistoryChartOptions = (days: number, metrics: readonly string[]) => {
    const units = [...new Set(metrics.map((metric) => metricInfo(metric).unit))];
    return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'nearest' as const, intersect: false },
        scales: {
            x: {
                type: 'time' as const,
                time: {
                    unit: timeUnitForDays(days),
                    displayFormats: { day: 'MM/dd', week: 'MM/dd', month: 'MM/yyyy' },
                    tooltipFormat: 'yyyy-MM-dd HH:mm',
                },
                title: { display: true, text: 'Test date' },
            },
            y: {
                beginAtZero: false,
                title: { display: true, text: units.join(' / ') },
            },
        },
        plugins: {
            legend: { display: true, position: 'bottom' as const },
            tooltip: {
                callbacks: {
                    label: (context: TooltipItem<'line'>) =>
                        `${context.dataset.label ?? ''}: ${(context.parsed.y ?? 0).toLocaleString(undefined, { maximumFractionDigits: 3 })}`,
                },
            },
        },
    };
};
