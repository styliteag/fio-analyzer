import React, { useMemo, useCallback } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    LogarithmicScale,
    PointElement,
    LineElement,
    Tooltip,
    Legend,
} from 'chart.js';
import type { Chart, LegendItem, LegendElement, Plugin } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useSaturationData } from '../../hooks/useSaturationData';
import { Loading } from '../ui';
import type { SaturationStep } from '../../services/api/testRuns';

ChartJS.register(
    CategoryScale,
    LinearScale,
    LogarithmicScale,
    PointElement,
    LineElement,
    Tooltip,
    Legend
);

interface SaturationChartProps {
    hostname?: string | null;
}

const SaturationChart: React.FC<SaturationChartProps> = ({ hostname }) => {
    const {
        saturationRuns,
        loadingRuns,
        runsError,
        selectedRunUuid,
        setSelectedRunUuid,
        saturationData,
        loadingData,
        dataError,
    } = useSaturationData(hostname);

    // Build chart data from saturation data
    const chartData = useMemo(() => {
        if (!saturationData) return null;

        const patterns = saturationData.patterns;
        const patternNames = Object.keys(patterns);

        // Collect all unique total_qd values for x-axis labels
        const allQDs = new Set<number>();
        for (const pName of patternNames) {
            for (const step of patterns[pName].steps) {
                allQDs.add(step.total_qd);
            }
        }
        const sortedQDs = Array.from(allQDs).sort((a, b) => a - b);
        const labels = sortedQDs.map(qd => String(qd));

        const datasets = [];

        // Each pattern gets a unique, distinguishable color
        // Solid for IOPS, lighter dashed for latency — same hue pairs them visually
        const patternColors: Record<string, { solid: string; light: string }> = {
            read:      { solid: 'rgb(59, 130, 246)',  light: 'rgba(59, 130, 246, 0.55)' },   // blue
            write:     { solid: 'rgb(16, 185, 129)',  light: 'rgba(16, 185, 129, 0.55)' },   // emerald
            rw:        { solid: 'rgb(139, 92, 246)',  light: 'rgba(139, 92, 246, 0.55)' },   // violet
            randread:  { solid: 'rgb(249, 115, 22)',  light: 'rgba(249, 115, 22, 0.55)' },   // orange
            randwrite: { solid: 'rgb(244, 63, 94)',   light: 'rgba(244, 63, 94, 0.55)' },    // rose
            randrw:    { solid: 'rgb(6, 182, 212)',   light: 'rgba(6, 182, 212, 0.55)' },    // cyan
        };

        for (const pName of patternNames) {
            const steps = patterns[pName].steps;
            const colors = patternColors[pName] || { solid: 'rgb(107, 114, 128)', light: 'rgba(107, 114, 128, 0.5)' };

            // IOPS line — solid, thicker
            const iopsData = sortedQDs.map(qd => {
                const step = steps.find(s => s.total_qd === qd);
                return step?.iops ?? null;
            });

            datasets.push({
                label: `${pName} IOPS`,
                data: iopsData,
                borderColor: colors.solid,
                backgroundColor: colors.solid,
                borderWidth: 3,
                pointRadius: 4,
                pointHoverRadius: 8,
                pointStyle: 'circle' as const,
                tension: 0.3,
                yAxisID: 'y-iops',
            });

            // P95 Latency line — dashed, thinner, lighter shade of same color
            const latencyData = sortedQDs.map(qd => {
                const step = steps.find(s => s.total_qd === qd);
                return step?.p95_latency_ms ?? null;
            });

            datasets.push({
                label: `${pName} P95 Latency`,
                data: latencyData,
                borderColor: colors.light,
                backgroundColor: colors.light,
                borderWidth: 2,
                borderDash: [6, 4],
                pointRadius: 3,
                pointHoverRadius: 8,
                pointStyle: 'triangle' as const,
                tension: 0.3,
                yAxisID: 'y-latency',
            });
        }

        return { labels, datasets };
    }, [saturationData]);

    // Threshold line plugin
    const thresholdPlugin: Plugin<'line'> = useMemo(() => ({
        id: 'thresholdLine',
        afterDraw(chart) {
            if (!saturationData) return;
            const yAxis = chart.scales['y-latency'];
            if (!yAxis) return;
            const threshold = saturationData.threshold_ms;
            const yPixel = yAxis.getPixelForValue(threshold);
            if (yPixel < chart.chartArea.top || yPixel > chart.chartArea.bottom) return;

            // Detect dark mode from document
            const isDark = document.documentElement.classList.contains('dark');

            const ctx = chart.ctx;
            ctx.save();
            ctx.beginPath();
            ctx.setLineDash([10, 5]);
            ctx.strokeStyle = isDark ? 'rgba(252, 129, 129, 0.7)' : 'rgba(239, 68, 68, 0.6)';
            ctx.lineWidth = 2;
            ctx.moveTo(chart.chartArea.left, yPixel);
            ctx.lineTo(chart.chartArea.right, yPixel);
            ctx.stroke();

            ctx.fillStyle = isDark ? 'rgba(252, 165, 165, 0.9)' : 'rgba(239, 68, 68, 0.8)';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(`Threshold: ${threshold}ms`, chart.chartArea.right - 5, yPixel - 5);
            ctx.restore();
        },
    }), [saturationData]);

    // Use linear scale if only 1 data point (log scale needs >= 2)
    const useLogScale = chartData ? chartData.labels.length >= 2 : true;

    // Legend click handler: toggle both IOPS and Latency datasets for the same pattern
    const handleLegendClick = useCallback((_e: unknown, legendItem: LegendItem, legend: LegendElement<'line'>) => {
        const chart = legend.chart as Chart<'line'>;
        const patternName = legendItem.text; // e.g. "randread"
        const iopsLabel = `${patternName} IOPS`;
        const latencyLabel = `${patternName} P95 Latency`;

        chart.data.datasets.forEach((ds, i) => {
            if (ds.label === iopsLabel || ds.label === latencyLabel) {
                const meta = chart.getDatasetMeta(i);
                meta.hidden = !meta.hidden;
            }
        });
        chart.update();
    }, []);

    const chartOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index' as const,
            intersect: false,
        },
        plugins: {
            legend: {
                position: 'bottom' as const,
                labels: {
                    // Show one entry per pattern (not per dataset)
                    generateLabels(chart: Chart<'line'>): LegendItem[] {
                        const seen = new Set<string>();
                        const items: LegendItem[] = [];
                        chart.data.datasets.forEach((ds, i) => {
                            // Extract pattern name from "pattern IOPS" or "pattern P95 Latency"
                            const label = ds.label || '';
                            const pattern = label.replace(/ IOPS$/, '').replace(/ P95 Latency$/, '');
                            if (seen.has(pattern)) return;
                            seen.add(pattern);
                            const meta = chart.getDatasetMeta(i);
                            items.push({
                                text: pattern,
                                fillStyle: ds.borderColor as string,
                                strokeStyle: ds.borderColor as string,
                                lineWidth: 3,
                                hidden: meta.hidden ?? false,
                                datasetIndex: i,
                            });
                        });
                        return items;
                    },
                    padding: 16,
                    usePointStyle: true,
                    pointStyle: 'rectRounded',
                    font: { size: 13 },
                },
                onClick: handleLegendClick,
            },
            tooltip: {
                callbacks: {
                    title: (items: Array<{ label: string }>) => {
                        return `Total Outstanding I/O: ${items[0]?.label}`;
                    },
                },
            },
        },
        scales: {
            x: {
                title: {
                    display: true,
                    text: 'Total Outstanding I/O (iodepth x numjobs)',
                },
                type: (useLogScale ? 'logarithmic' : 'linear') as 'logarithmic' | 'linear',
                ticks: {
                    callback: function (tickValue: string | number) {
                        return String(tickValue);
                    },
                },
            },
            'y-iops': {
                type: 'linear' as const,
                position: 'left' as const,
                title: {
                    display: true,
                    text: 'IOPS',
                },
                beginAtZero: true,
            },
            'y-latency': {
                type: 'linear' as const,
                position: 'right' as const,
                title: {
                    display: true,
                    text: 'P95 Latency (ms)',
                },
                beginAtZero: true,
                grid: {
                    drawOnChartArea: false,
                },
            },
        },
    }), [useLogScale, handleLegendClick]);

    // Build summary table rows from all patterns
    const tableRows = useMemo(() => {
        if (!saturationData) return [];

        const patterns = saturationData.patterns;
        const patternNames = Object.keys(patterns);

        // Collect all QDs
        const allQDs = new Set<number>();
        for (const pName of patternNames) {
            for (const step of patterns[pName].steps) {
                allQDs.add(step.total_qd);
            }
        }
        const sortedQDs = Array.from(allQDs).sort((a, b) => a - b);

        return sortedQDs.map((qd, index) => {
            const row: Record<string, SaturationStep | null> = {};
            let sampleStep: SaturationStep | null = null;

            for (const pName of patternNames) {
                const step = patterns[pName].steps.find(s => s.total_qd === qd) || null;
                row[pName] = step;
                if (step && !sampleStep) sampleStep = step;
            }

            // Determine row highlight
            let highlight: 'sweet' | 'saturated' | null = null;
            for (const pName of patternNames) {
                const sweet = patterns[pName].sweet_spot;
                const sat = patterns[pName].saturation_point;
                if (sweet && sweet.total_qd === qd) highlight = 'sweet';
                if (sat && sat.total_qd === qd) highlight = 'saturated';
            }

            return {
                step: index + 1,
                iodepth: sampleStep?.iodepth ?? '-',
                num_jobs: sampleStep?.num_jobs ?? '-',
                total_qd: qd,
                patterns: row,
                highlight,
            };
        });
    }, [saturationData]);

    // No saturation runs available
    if (!loadingRuns && saturationRuns.length === 0) {
        return (
            <div className="text-center py-12">
                <p className="theme-text-secondary text-lg mb-2">No Saturation Test Data</p>
                <p className="theme-text-secondary text-sm">
                    Run <code>fio-test.sh --saturation</code> to generate data.
                </p>
            </div>
        );
    }

    return (
        <div>
            {/* Run Selector */}
            <div className="mb-6">
                <label className="block text-sm font-medium theme-text-secondary mb-1">
                    Select Saturation Run
                </label>
                <select
                    aria-label="Select saturation test run"
                    className="w-full max-w-lg px-3 py-2 border rounded-lg theme-bg-primary theme-text-primary theme-border-primary"
                    value={selectedRunUuid || ''}
                    onChange={(e) => setSelectedRunUuid(e.target.value || null)}
                >
                    <option value="">-- Select a run --</option>
                    {saturationRuns.map((run) => (
                        <option key={run.run_uuid} value={run.run_uuid}>
                            {run.hostname} - {run.drive_model} ({run.protocol}/{run.drive_type}){run.block_size ? ` [${run.block_size}]` : ''} - {new Date(run.started).toLocaleDateString()} ({run.step_count} steps)
                        </option>
                    ))}
                </select>
            </div>

            {/* Loading states */}
            {(loadingRuns || loadingData) && <Loading />}
            {runsError && <p className="text-red-500 mb-4">{runsError}</p>}
            {dataError && <p className="text-red-500 mb-4">{dataError}</p>}

            {/* Chart */}
            {chartData && saturationData && (
                <div className="mb-8">
                    <div className="mb-2 text-sm theme-text-secondary">
                        Threshold: {saturationData.threshold_ms}ms P95 Latency | Block Size: {saturationData.block_size || 'N/A'} | {saturationData.hostname} - {saturationData.drive_model}
                    </div>
                    <div style={{ height: '450px' }}>
                        <Line
                            data={chartData}
                            options={chartOptions}
                            plugins={[thresholdPlugin]}
                        />
                    </div>
                </div>
            )}

            {/* Summary Table */}
            {tableRows.length > 0 && saturationData && (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse theme-text-primary">
                        <thead>
                            <tr className="theme-bg-tertiary">
                                <th className="px-3 py-2 text-left border theme-border-primary theme-text-secondary">Step</th>
                                <th className="px-3 py-2 text-left border theme-border-primary theme-text-secondary">IO Depth</th>
                                <th className="px-3 py-2 text-left border theme-border-primary theme-text-secondary">Num Jobs</th>
                                <th className="px-3 py-2 text-left border theme-border-primary theme-text-secondary">Total QD</th>
                                {Object.keys(saturationData.patterns).map(pattern => (
                                    <React.Fragment key={pattern}>
                                        <th className="px-3 py-2 text-right border theme-border-primary theme-text-secondary">{pattern} IOPS</th>
                                        <th className="px-3 py-2 text-right border theme-border-primary theme-text-secondary">{pattern} P95 (ms)</th>
                                        <th className="px-3 py-2 text-right border theme-border-primary theme-text-secondary">{pattern} BW (MB/s)</th>
                                    </React.Fragment>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {tableRows.map((row) => {
                                let rowClass = 'theme-bg-primary';
                                if (row.highlight === 'sweet') rowClass = 'bg-green-50 dark:bg-green-900/30';
                                if (row.highlight === 'saturated') rowClass = 'bg-red-50 dark:bg-red-900/30';

                                return (
                                    <tr key={row.total_qd} className={rowClass}>
                                        <td className="px-3 py-2 border theme-border-primary">{row.step}</td>
                                        <td className="px-3 py-2 border theme-border-primary">{row.iodepth}</td>
                                        <td className="px-3 py-2 border theme-border-primary">{row.num_jobs}</td>
                                        <td className="px-3 py-2 border theme-border-primary font-medium">{row.total_qd}</td>
                                        {Object.keys(saturationData.patterns).map(pattern => {
                                            const step = row.patterns[pattern];
                                            return (
                                                <React.Fragment key={pattern}>
                                                    <td className="px-3 py-2 text-right border theme-border-primary">
                                                        {step?.iops != null ? step.iops.toLocaleString() : '-'}
                                                    </td>
                                                    <td className={`px-3 py-2 text-right border theme-border-primary ${
                                                        step?.p95_latency_ms != null && step.p95_latency_ms > saturationData.threshold_ms
                                                            ? 'text-red-600 dark:text-red-400 font-semibold' : ''
                                                    }`}>
                                                        {step?.p95_latency_ms != null ? step.p95_latency_ms.toFixed(2) : '-'}
                                                    </td>
                                                    <td className="px-3 py-2 text-right border theme-border-primary">
                                                        {step?.bandwidth_mbs != null ? step.bandwidth_mbs.toFixed(1) : '-'}
                                                    </td>
                                                </React.Fragment>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {/* Legend */}
                    <div className="mt-3 flex gap-6 text-sm theme-text-secondary">
                        <span><span className="inline-block w-4 h-4 bg-green-100 dark:bg-green-900/40 border border-green-300 dark:border-green-700 rounded mr-1 align-text-bottom" /> Sweet Spot (best within SLA)</span>
                        <span><span className="inline-block w-4 h-4 bg-red-100 dark:bg-red-900/40 border border-red-300 dark:border-red-700 rounded mr-1 align-text-bottom" /> Saturation Point (P95 &gt; {saturationData.threshold_ms}ms)</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SaturationChart;
