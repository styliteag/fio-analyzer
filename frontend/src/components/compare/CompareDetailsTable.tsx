// Collapsible table of every compared configuration with absolute values and diffs for one metric
import type { CompareMetric, CompareResponse, CompareRow } from '../../services/api/compare';
import { cellValue, diffTone, formatDiff, formatMetric, metricLabel, targetLabel } from './compareUtils';

interface CompareDetailsTableProps {
    readonly data: CompareResponse;
    readonly rows: readonly CompareRow[];
    readonly metric: CompareMetric;
}

const MAX_ROWS = 1000;
const TH = 'py-2 px-2 font-medium whitespace-nowrap';
const TD = 'py-1.5 px-2 whitespace-nowrap';

const layoutCell = (row: CompareRow, strict: boolean): string => {
    if (strict) return [row.test_size, row.duration != null ? `${row.duration}s` : null, row.layout || null].filter(Boolean).join(' · ') || '–';
    return row.mismatch && row.mismatch.length > 0 ? `⚠ ${row.mismatch.join(', ')}` : '–';
};

const CompareDetailsTable: React.FC<CompareDetailsTableProps> = ({ data, rows, metric }) => {
    const shown = rows.slice(0, MAX_ROWS);
    const others = data.targets.slice(1);
    return (
        <details className="group">
            <summary className="cursor-pointer select-none text-sm font-semibold theme-text-primary">
                All {rows.length} configurations ({metricLabel(metric)})
            </summary>
            <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead>
                        <tr className="text-left theme-text-secondary border-b theme-border-primary">
                            <th scope="col" className={TH}>Pattern</th>
                            <th scope="col" className={TH}>Block size</th>
                            <th scope="col" className={TH}>Sync</th>
                            <th scope="col" className={TH}>Direct</th>
                            <th scope="col" className={TH}>Jobs</th>
                            <th scope="col" className={TH}>QD</th>
                            <th scope="col" className={TH}>{data.strict ? 'Size · time · layout' : 'Mismatch'}</th>
                            {data.targets.map((target, index) => (
                                <th key={target} scope="col" className={`${TH} text-right`}>
                                    {targetLabel(target)}
                                    {index === 0 && <span className="ml-1 text-xs font-normal">(baseline)</span>}
                                </th>
                            ))}
                            {others.map((target) => (
                                <th key={`diff-${target}`} scope="col" className={`${TH} text-right`}>Δ {targetLabel(target)}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {shown.map((row, index) => (
                            <tr key={index} className="border-b last:border-0 theme-border-primary theme-text-secondary">
                                <td className={`${TD} theme-text-primary`}>{row.read_write_pattern}</td>
                                <td className={TD}>{row.block_size}</td>
                                <td className={TD}>{row.sync ?? '–'}</td>
                                <td className={TD}>{row.direct ?? '–'}</td>
                                <td className={TD}>{row.num_jobs ?? '–'}</td>
                                <td className={TD}>{row.iodepth ?? '–'}</td>
                                <td className={TD}>{layoutCell(row, data.strict)}</td>
                                {data.targets.map((target) => (
                                    <td key={target} className={`${TD} text-right font-mono`}>{formatMetric(metric, cellValue(row.results[target], metric))}</td>
                                ))}
                                {others.map((target) => {
                                    const diff = row.diff_pct[target]?.[metric] ?? null;
                                    return (
                                        <td key={`diff-${target}`} className={`${TD} text-right`}>
                                            <span className={`inline-block rounded px-1.5 font-mono ${diffTone(diff, row.better[target]?.[metric] ?? null)}`}>
                                                {formatDiff(diff)}
                                            </span>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
                {rows.length > MAX_ROWS && (
                    <p className="mt-2 text-xs theme-text-tertiary">Showing the first {MAX_ROWS} of {rows.length}; narrow the filters to see the rest.</p>
                )}
            </div>
        </details>
    );
};

export default CompareDetailsTable;
