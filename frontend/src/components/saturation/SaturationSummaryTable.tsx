// Per pattern: best step within the P95 threshold and the step that crossed it
import { useEffect, useState } from 'react';
import { fetchSaturationSummary, type SaturationSummary, type SaturationSummaryStep } from '../../services/api/testRuns';
import { formatClientCount } from '../../utils/clientCount';
import { formatSyncMode } from '../../utils/syncMode';

interface SaturationSummaryTableProps {
    readonly runUuid: string;
    readonly thresholdMs: number;
}

const formatStep = (step: SaturationSummaryStep | null): string => {
    if (!step) return '–';
    const iops = step.iops !== null ? Math.round(step.iops).toLocaleString() : '–';
    const p95 = step.p95_latency !== null ? step.p95_latency.toFixed(2) : '–';
    return `QD ${step.total_qd} (${step.iodepth}×${step.num_jobs}) · ${iops} IOPS · P95 ${p95} ms`;
};

const SaturationSummaryTable: React.FC<SaturationSummaryTableProps> = ({ runUuid, thresholdMs }) => {
    const [summary, setSummary] = useState<SaturationSummary | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        fetchSaturationSummary(runUuid, thresholdMs, controller.signal).then((response) => {
            if (controller.signal.aborted) return;
            setSummary(response.data ?? null);
            setError(response.error ?? null);
        });
        return () => controller.abort();
    }, [runUuid, thresholdMs]);

    if (error) return <p className="text-sm text-red-600 dark:text-red-400">Summary unavailable: {error}</p>;
    if (!summary) return null;

    return (
        <div className="overflow-x-auto">
            <h3 className="text-sm font-semibold theme-text-primary mb-2">
                Saturation points (P95 threshold {summary.threshold_ms} ms)
            </h3>
            <table className="min-w-full text-sm">
                <thead>
                    <tr className="text-left theme-text-secondary border-b theme-border-primary">
                        <th scope="col" className="py-2 pr-4 font-medium">Pattern</th>
                        <th scope="col" className="py-2 pr-4 font-medium">Status</th>
                        <th scope="col" className="py-2 pr-4 font-medium">Best within threshold</th>
                        <th scope="col" className="py-2 pr-4 font-medium">Crossed at</th>
                        <th scope="col" className="py-2 font-medium text-right">Steps</th>
                    </tr>
                </thead>
                <tbody>
                    {summary.patterns.map((pattern) => (
                        <tr key={`${pattern.read_write_pattern}-${pattern.block_size}-${pattern.sync}-${pattern.clients ?? 1}`} className="border-b last:border-0 theme-border-primary">
                            <td className="py-2 pr-4 theme-text-primary font-medium">
                                {pattern.read_write_pattern}
                                <span className="ml-2 text-xs theme-text-tertiary">
                                    {pattern.block_size} · {formatSyncMode(pattern.sync)}
                                    {formatClientCount(pattern.clients) && ` · ${formatClientCount(pattern.clients)}`}
                                </span>
                            </td>
                            <td className="py-2 pr-4">
                                {pattern.status === 'saturated' ? (
                                    <span className="text-red-600 dark:text-red-400">Saturated</span>
                                ) : (
                                    <span className="theme-text-secondary">Not reached</span>
                                )}
                            </td>
                            <td className="py-2 pr-4 theme-text-secondary whitespace-nowrap">{formatStep(pattern.best_within)}</td>
                            <td className="py-2 pr-4 theme-text-secondary whitespace-nowrap">{formatStep(pattern.crossed_at)}</td>
                            <td className="py-2 text-right theme-text-secondary">{pattern.steps}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default SaturationSummaryTable;
