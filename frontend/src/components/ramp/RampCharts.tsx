// Client ramp charts: aggregate throughput, latency (with the P95 threshold) and per-client spread over the client count
import React, { useMemo } from 'react';
import {
    Chart as ChartJS,
    Filler,
    Legend,
    LinearScale,
    LineElement,
    PointElement,
    Tooltip,
    type ChartDataset,
    type ChartOptions,
    type Plugin,
    type PointStyle,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useTheme } from '../../contexts/ThemeContext';
import { useChartColors } from '../../hooks/useChartColors';
import { rampClientLabel, type RampStep, type RampSummaryStep } from '../../services/api/ramp';

ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

type Point = { x: number; y: number | null };
type LineDataset = ChartDataset<'line', Point[]>;

const CHART_HEIGHT = 320;

const useAxisColors = () => {
    const { actualTheme } = useTheme();
    const isDark = actualTheme === 'dark';
    return {
        isDark,
        text: isDark ? '#d1d5db' : '#1f2937',
        grid: isDark ? 'rgba(156, 163, 175, 0.2)' : 'rgba(107, 114, 128, 0.15)',
        threshold: isDark ? 'rgba(252, 129, 129, 0.85)' : 'rgba(220, 38, 38, 0.8)',
    };
};

const clientAxis = (text: string, grid: string, counts: readonly number[]) => ({
    type: 'linear' as const,
    title: { display: true, text: 'Clients', color: text },
    min: Math.min(...counts, 1) - (counts.length > 1 ? 0 : 1),
    max: Math.max(...counts, 1) + (counts.length > 1 ? 0 : 1),
    ticks: { color: text, precision: 0, stepSize: 1 },
    grid: { color: grid },
});

/** Incomplete steps (a client failed) get a hollow cross marker, complete ones a filled circle */
const markers = (steps: readonly RampSummaryStep[], color: string) => ({
    pointStyle: steps.map((step): PointStyle => (step.complete ? 'circle' : 'crossRot')),
    pointRadius: steps.map((step) => (step.complete ? 4 : 7)),
    pointBorderWidth: steps.map((step) => (step.complete ? 1 : 2)),
    pointBackgroundColor: color,
    pointBorderColor: color,
});

const legendOptions = (text: string) => ({
    position: 'bottom' as const,
    labels: { color: text, usePointStyle: true, padding: 16 },
});

const tooltipTitle = (items: { parsed: { x: number | null } }[]) => `${items[0]?.parsed.x ?? ''} clients`;

interface StepsChartProps {
    readonly steps: readonly RampSummaryStep[];
}

/** (a) Aggregate IOPS and bandwidth over the client count */
export const RampThroughputChart: React.FC<StepsChartProps> = ({ steps }) => {
    const axis = useAxisColors();
    const { primaryColors } = useChartColors();
    const [iopsColor, bwColor] = [primaryColors[0], primaryColors[1]];
    const counts = useMemo(() => steps.map((step) => step.clients), [steps]);

    const data = useMemo(
        () => ({
            datasets: [
                {
                    label: 'Aggregate IOPS',
                    data: steps.map((step) => ({ x: step.clients, y: step.iops })),
                    borderColor: iopsColor,
                    backgroundColor: iopsColor,
                    borderWidth: 3,
                    tension: 0.2,
                    yAxisID: 'y-iops',
                    ...markers(steps, iopsColor),
                },
                {
                    label: 'Aggregate bandwidth (MB/s)',
                    data: steps.map((step) => ({ x: step.clients, y: step.bandwidth })),
                    borderColor: bwColor,
                    backgroundColor: bwColor,
                    borderWidth: 2,
                    borderDash: [6, 4],
                    tension: 0.2,
                    yAxisID: 'y-bw',
                    ...markers(steps, bwColor),
                },
            ] as LineDataset[],
        }),
        [steps, iopsColor, bwColor],
    );

    const options = useMemo<ChartOptions<'line'>>(
        () => ({
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { legend: legendOptions(axis.text), tooltip: { callbacks: { title: tooltipTitle } } },
            scales: {
                x: clientAxis(axis.text, axis.grid, counts),
                'y-iops': {
                    type: 'linear',
                    position: 'left',
                    beginAtZero: true,
                    title: { display: true, text: 'IOPS', color: axis.text },
                    ticks: { color: axis.text },
                    grid: { color: axis.grid },
                },
                'y-bw': {
                    type: 'linear',
                    position: 'right',
                    beginAtZero: true,
                    title: { display: true, text: 'MB/s', color: axis.text },
                    ticks: { color: axis.text },
                    grid: { drawOnChartArea: false },
                },
            },
        }),
        [axis.text, axis.grid, counts],
    );

    return (
        <div style={{ height: CHART_HEIGHT }} role="img" aria-label="Aggregate IOPS and bandwidth by client count">
            <Line data={data} options={options} />
        </div>
    );
};

interface LatencyChartProps extends StepsChartProps {
    readonly thresholdMs: number;
}

/** (b) Average, P95 and P99 latency over the client count with the P95 threshold as a horizontal line */
export const RampLatencyChart: React.FC<LatencyChartProps> = ({ steps, thresholdMs }) => {
    const axis = useAxisColors();
    const { primaryColors } = useChartColors();
    const [p95Color, avgColor, p99Color] = [primaryColors[4], primaryColors[9], primaryColors[7]];
    const counts = useMemo(() => steps.map((step) => step.clients), [steps]);
    const maxLatency = Math.max(0, ...steps.map((step) => step.p95_latency ?? 0));

    const data = useMemo(
        () => ({
            datasets: [
                {
                    label: 'P95 latency (ms)',
                    data: steps.map((step) => ({ x: step.clients, y: step.p95_latency })),
                    borderColor: p95Color,
                    backgroundColor: p95Color,
                    borderWidth: 3,
                    tension: 0.2,
                    ...markers(steps, p95Color),
                },
                {
                    label: 'Avg latency (ms)',
                    data: steps.map((step) => ({ x: step.clients, y: step.avg_latency })),
                    borderColor: avgColor,
                    backgroundColor: avgColor,
                    borderWidth: 2,
                    tension: 0.2,
                    ...markers(steps, avgColor),
                },
                {
                    label: 'P99 latency (ms)',
                    data: steps.map((step) => ({ x: step.clients, y: step.p99_latency })),
                    borderColor: p99Color,
                    backgroundColor: p99Color,
                    borderWidth: 1.5,
                    borderDash: [4, 4],
                    tension: 0.2,
                    hidden: true,
                    ...markers(steps, p99Color),
                },
            ] as LineDataset[],
        }),
        [steps, p95Color, avgColor, p99Color],
    );

    const thresholdPlugin = useMemo<Plugin<'line'>>(
        () => ({
            id: 'rampThreshold',
            afterDatasetsDraw(chart) {
                const yAxis = chart.scales.y;
                if (!yAxis) return;
                const y = yAxis.getPixelForValue(thresholdMs);
                if (y < chart.chartArea.top || y > chart.chartArea.bottom) return;
                const { ctx } = chart;
                ctx.save();
                ctx.beginPath();
                ctx.setLineDash([10, 5]);
                ctx.strokeStyle = axis.threshold;
                ctx.lineWidth = 2;
                ctx.moveTo(chart.chartArea.left, y);
                ctx.lineTo(chart.chartArea.right, y);
                ctx.stroke();
                ctx.fillStyle = axis.threshold;
                ctx.font = '12px sans-serif';
                ctx.textAlign = 'right';
                ctx.fillText(`P95 threshold: ${thresholdMs} ms`, chart.chartArea.right - 5, y - 5);
                ctx.restore();
            },
        }),
        [thresholdMs, axis.threshold],
    );

    const options = useMemo<ChartOptions<'line'>>(
        () => ({
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { legend: legendOptions(axis.text), tooltip: { callbacks: { title: tooltipTitle } } },
            scales: {
                x: clientAxis(axis.text, axis.grid, counts),
                y: {
                    type: 'linear',
                    beginAtZero: true,
                    // Keep the threshold visible unless it is far above the measured latencies
                    suggestedMax: thresholdMs <= maxLatency * 3 ? thresholdMs * 1.1 : undefined,
                    title: { display: true, text: 'Latency (ms)', color: axis.text },
                    ticks: { color: axis.text },
                    grid: { color: axis.grid },
                },
            },
        }),
        [axis.text, axis.grid, counts, thresholdMs, maxLatency],
    );

    return (
        <>
            <div style={{ height: CHART_HEIGHT }} role="img" aria-label="Latency by client count with the P95 threshold">
                <Line data={data} options={options} plugins={[thresholdPlugin]} />
            </div>
            {thresholdMs > maxLatency * 3 && (
                <p className="mt-2 text-xs theme-text-secondary">
                    The P95 threshold ({thresholdMs} ms) is far above every measured latency and lies outside the chart.
                </p>
            )}
        </>
    );
};

interface SpreadChartProps {
    readonly steps: readonly RampStep[];
}

/** (c) Per-client IOPS per step: min/max band plus one point series per client, to spot unfair clients */
export const RampClientSpreadChart: React.FC<SpreadChartProps> = ({ steps }) => {
    const axis = useAxisColors();
    const { primaryColors } = useChartColors();
    const counts = useMemo(() => steps.map((step) => step.clients || 1), [steps]);

    const data = useMemo(() => {
        const withClients = steps.filter((step) => step.clients_detail.length > 0);
        const band = withClients.map((step) => {
            const values = step.clients_detail.map((client) => client.iops ?? 0);
            return { x: step.clients || 1, min: Math.min(...values), max: Math.max(...values), mean: values.reduce((a, b) => a + b, 0) / values.length };
        });
        const clientNames = Array.from(new Set(withClients.flatMap((step) => step.clients_detail.map(rampClientLabel))));
        const bandColor = axis.isDark ? 'rgba(156, 163, 175, 0.25)' : 'rgba(107, 114, 128, 0.18)';
        const edgeColor = axis.isDark ? 'rgba(209, 213, 219, 0.6)' : 'rgba(75, 85, 99, 0.6)';

        const datasets: LineDataset[] = [
            {
                label: 'Fastest client',
                data: band.map((b) => ({ x: b.x, y: b.max })),
                borderColor: edgeColor,
                backgroundColor: bandColor,
                borderWidth: 1,
                pointRadius: 0,
                fill: false,
            },
            {
                label: 'Slowest client',
                data: band.map((b) => ({ x: b.x, y: b.min })),
                borderColor: edgeColor,
                backgroundColor: bandColor,
                borderWidth: 1,
                pointRadius: 0,
                fill: '-1',
            },
            {
                label: 'Mean per client',
                data: band.map((b) => ({ x: b.x, y: b.mean })),
                borderColor: edgeColor,
                backgroundColor: edgeColor,
                borderWidth: 2,
                borderDash: [6, 4],
                pointRadius: 0,
                fill: false,
            },
            ...clientNames.map((name, index): LineDataset => {
                const color = primaryColors[index % primaryColors.length];
                return {
                    label: name,
                    data: withClients.flatMap((step) =>
                        step.clients_detail.filter((client) => rampClientLabel(client) === name).map((client) => ({ x: step.clients || 1, y: client.iops })),
                    ),
                    borderColor: color,
                    backgroundColor: color,
                    showLine: false,
                    pointRadius: 5,
                    pointHoverRadius: 8,
                };
            }),
        ];
        return { datasets };
    }, [steps, primaryColors, axis.isDark]);

    const options = useMemo<ChartOptions<'line'>>(
        () => ({
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'nearest', intersect: false, axis: 'x' },
            plugins: {
                legend: legendOptions(axis.text),
                tooltip: {
                    callbacks: {
                        title: tooltipTitle,
                        label: (item) => `${item.dataset.label}: ${Math.round(item.parsed.y ?? 0).toLocaleString()} IOPS`,
                    },
                },
            },
            scales: {
                x: clientAxis(axis.text, axis.grid, counts),
                y: {
                    type: 'linear',
                    beginAtZero: true,
                    title: { display: true, text: 'IOPS per client', color: axis.text },
                    ticks: { color: axis.text },
                    grid: { color: axis.grid },
                },
            },
        }),
        [axis.text, axis.grid, counts],
    );

    return (
        <div style={{ height: CHART_HEIGHT }} role="img" aria-label="IOPS of each client per step">
            <Line data={data} options={options} />
        </div>
    );
};
