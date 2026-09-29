// Saturation points of several runs side by side: rows = pattern (+ block size / sync), columns = runs
import type { SaturationPatternSummary, SaturationRun, SaturationSummaryStep } from '../../services/api/testRuns';
import { formatClientCount } from '../../utils/clientCount';
import { formatSyncMode } from '../../utils/syncMode';
import { compareBlockSizes } from './compareUtils';
import type { RunSummary } from './useCompareData';

interface SaturationCompareTableProps {
    readonly runs: readonly SaturationRun[];
    readonly summaries: Readonly<Record<string, RunSummary>>;
}

interface PatternKey {
    readonly key: string;
    readonly pattern: string;
    readonly blockSize: string;
    readonly sync: string | null;
}

const keyOf = (pattern: SaturationPatternSummary): string => `${pattern.read_write_pattern}|${pattern.block_size}|${pattern.sync ?? ''}`;

const collectKeys = (summaries: readonly RunSummary[]): PatternKey[] => {
    const all = summaries.flatMap((summary) => summary.data?.patterns ?? []);
    const unique = new Map(all.map((pattern) => [keyOf(pattern), { key: keyOf(pattern), pattern: pattern.read_write_pattern, blockSize: pattern.block_size, sync: pattern.sync }]));
    return [...unique.values()].sort(
        (a, b) => a.pattern.localeCompare(b.pattern) || compareBlockSizes(a.blockSize, b.blockSize) || String(a.sync).localeCompare(String(b.sync)),
    );
};

const formatBest = (step: SaturationSummaryStep): string => {
    const iops = step.iops !== null ? Math.round(step.iops).toLocaleString() : '–';
    const p95 = step.p95_latency !== null ? step.p95_latency.toFixed(2) : '–';
    return `QD ${step.total_qd} · ${iops} IOPS · P95 ${p95} ms`;
};

const runHeading = (run: SaturationRun): string => {
    const clients = formatClientCount(run.clients);
    return `${run.hostname} · ${run.drive_model}${clients ? ` · ${clients}` : ''}`;
};

const SaturationCompareTable: React.FC<SaturationCompareTableProps> = ({ runs, summaries }) => {
    const keys = collectKeys(runs.map((run) => summaries[run.run_uuid]).filter(Boolean));
    const findPattern = (run: SaturationRun, key: string) => summaries[run.run_uuid]?.data?.patterns.find((pattern) => keyOf(pattern) === key) ?? null;

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full text-sm" aria-label="Saturation comparison">
                <thead>
                    <tr className="text-left theme-text-secondary border-b theme-border-primary align-bottom">
                        <th scope="col" className="py-2 pr-4 font-medium">Pattern</th>
                        {runs.map((run) => {
                            const summary = summaries[run.run_uuid];
                            return (
                                <th key={run.run_uuid} scope="col" className="py-2 pr-4 font-medium">
                                    <span className="block theme-text-primary">{runHeading(run)}</span>
                                    <span className="block text-xs font-normal">
                                        {run.protocol}/{run.drive_type} · {new Date(run.started).toLocaleDateString()}
                                        {summary?.data && ` · P95 ≤ ${summary.data.threshold_ms} ms${summary.defaulted ? ' (default, none stored)' : ''}`}
                                    </span>
                                    {summary?.error && <span className="block text-xs font-normal text-red-600 dark:text-red-400">{summary.error}</span>}
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody>
                    {keys.map(({ key, pattern, blockSize, sync }) => {
                        const cells = runs.map((run) => findPattern(run, key));
                        const bestIops = Math.max(...cells.map((cell) => cell?.best_within?.iops ?? -1));
                        const measured = cells.filter((cell) => cell?.best_within?.iops != null).length;
                        return (
                            <tr key={key} className="border-b last:border-0 theme-border-primary align-top">
                                <th scope="row" className="py-2 pr-4 text-left font-medium theme-text-primary whitespace-nowrap">
                                    {pattern}
                                    <span className="block text-xs font-normal theme-text-tertiary">{blockSize} · {formatSyncMode(sync)}</span>
                                </th>
                                {cells.map((cell, index) => {
                                    const best = cell?.best_within ?? null;
                                    const isBest = best !== null && best.iops !== null && best.iops === bestIops && measured > 1;
                                    return (
                                        <td
                                            key={runs[index].run_uuid}
                                            className={`py-2 pr-4 whitespace-nowrap ${isBest ? 'bg-green-50 dark:bg-green-900/30' : ''}`}
                                            data-best={isBest ? 'true' : undefined}
                                        >
                                            {cell === null ? (
                                                <span className="theme-text-tertiary">Not tested</span>
                                            ) : (
                                                <>
                                                    <span className={`block ${isBest ? 'font-semibold text-green-800 dark:text-green-300' : 'theme-text-primary'}`}>
                                                        {best ? formatBest(best) : 'None within threshold'}
                                                        {isBest && (
                                                            <>
                                                                <span className="ml-1" aria-hidden="true">★</span>
                                                                <span className="sr-only"> (highest IOPS)</span>
                                                            </>
                                                        )}
                                                    </span>
                                                    <span className="block text-xs theme-text-secondary">
                                                        {cell.crossed_at ? `Crossed at QD ${cell.crossed_at.total_qd}` : 'Threshold not reached'}
                                                    </span>
                                                </>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default SaturationCompareTable;
