// Every uploaded step of a ramp with its aggregate result and one row per client
import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { storageInfoSummary } from '../shared/StorageInfo';
import { isRampStepComplete, rampClientLabel, type RampStep } from '../../services/api/ramp';

const num = (value: number | null | undefined, digits = 0): string =>
    value != null ? value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '–';

const CELL = 'px-3 py-2 border-b theme-border-primary';
const NUM = `${CELL} text-right tabular-nums`;

interface RampStepTableProps {
    readonly steps: readonly RampStep[];
    readonly thresholdMs: number;
    /** Step ids the summary ranks (newest upload per client count); other uploads are marked as superseded */
    readonly rankedIds: ReadonlySet<number>;
}

export const RampStepTable: React.FC<RampStepTableProps> = ({ steps, thresholdMs, rankedIds }) => (
    <div className="overflow-x-auto">
        <table className="w-full text-sm theme-text-primary">
            <thead>
                <tr className="theme-bg-tertiary text-left theme-text-secondary">
                    <th scope="col" className={CELL}>Clients / client</th>
                    <th scope="col" className={`${CELL} text-right`}>IOPS</th>
                    <th scope="col" className={`${CELL} text-right`}>Read / write IOPS</th>
                    <th scope="col" className={`${CELL} text-right`}>BW (MB/s)</th>
                    <th scope="col" className={`${CELL} text-right`}>Avg (ms)</th>
                    <th scope="col" className={`${CELL} text-right`}>P95 (ms)</th>
                    <th scope="col" className={`${CELL} text-right`}>P99 (ms)</th>
                    <th scope="col" className={CELL}>Status / storage</th>
                </tr>
            </thead>
            {steps.map((step) => {
                const complete = isRampStepComplete(step);
                const superseded = !rankedIds.has(step.id);
                const missing = (step.clients || 1) - step.clients_detail.length;
                const p95Over = step.p95_latency != null && step.p95_latency > thresholdMs;
                return (
                    <tbody key={step.id} className={superseded ? 'opacity-60' : undefined}>
                        <tr className={complete ? 'theme-bg-secondary font-medium' : 'bg-red-50 dark:bg-red-900/30 font-medium'}>
                            <th scope="rowgroup" className={`${CELL} text-left whitespace-nowrap`}>
                                {step.clients ?? 1} client{step.clients === 1 ? '' : 's'}
                                <span className="ml-2 text-xs font-normal theme-text-secondary">
                                    {step.timestamp ? new Date(step.timestamp).toLocaleString() : ''}
                                </span>
                            </th>
                            <td className={NUM}>{num(step.iops)}</td>
                            <td className={NUM}>–</td>
                            <td className={NUM}>{num(step.bandwidth, 1)}</td>
                            <td className={NUM}>{num(step.avg_latency, 2)}</td>
                            <td className={`${NUM} ${p95Over ? 'text-red-600 dark:text-red-400 font-semibold' : ''}`}>{num(step.p95_latency, 2)}</td>
                            <td className={NUM}>{num(step.p99_latency, 2)}</td>
                            <td className={`${CELL} whitespace-nowrap`}>
                                {complete ? (
                                    <span className="text-green-700 dark:text-green-400">Complete</span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-400">
                                        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                                        Incomplete{missing > 0 ? ` (${missing} client${missing === 1 ? '' : 's'} missing)` : ''}
                                    </span>
                                )}
                                {superseded && <span className="ml-2 text-xs theme-text-secondary">superseded by a newer upload</span>}
                            </td>
                        </tr>
                        {step.clients_detail.map((client) => {
                            const address = client.client_host ? `${client.client_host}${client.client_port ? `:${client.client_port}` : ''}` : null;
                            const label = rampClientLabel(client);
                            return (
                                <tr key={client.client_index} className={client.error ? 'text-red-700 dark:text-red-400' : undefined}>
                                    <td className={`${CELL} pl-8`}>
                                        {label}
                                        {address && address !== label && <span className="ml-2 text-xs theme-text-secondary font-mono">{address}</span>}
                                    </td>
                                    <td className={NUM}>{num(client.iops)}</td>
                                    <td className={NUM}>
                                        {num(client.read_iops)} / {num(client.write_iops)}
                                    </td>
                                    <td className={NUM}>{num(client.bandwidth, 1)}</td>
                                    <td className={NUM}>{num(client.avg_latency, 2)}</td>
                                    <td className={NUM}>{num(client.p95_latency, 2)}</td>
                                    <td className={NUM}>{num(client.p99_latency, 2)}</td>
                                    <td className={`${CELL} text-xs theme-text-secondary`}>
                                        {client.error ? <span className="font-semibold text-red-700 dark:text-red-400">fio error {String(client.error)}</span> : null}
                                        {client.error && storageInfoSummary(client.storage_info) ? ' · ' : null}
                                        {storageInfoSummary(client.storage_info)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                );
            })}
        </table>
        <p className="mt-2 text-xs theme-text-secondary">
            P95 values above the {thresholdMs} ms threshold are red. Incomplete steps (a client failed or is missing) are listed but not ranked in the summary.
        </p>
    </div>
);

export default RampStepTable;
