// Pattern × block size matrix of the diff to the baseline for one target
import { useMemo } from 'react';
import type { CompareMetric, CompareRow } from '../../services/api/compare';
import { diffTone, formatDiff, metricLabel } from './compareUtils';
import { buildDiffMatrix, cellKey, type MatrixCell } from './diffMatrix';

interface DiffMatrixTableProps {
    readonly rows: readonly CompareRow[];
    readonly baseline: string;
    readonly target: string;
    readonly metric: CompareMetric;
}

const DiffCell: React.FC<{ readonly cell: MatrixCell | undefined }> = ({ cell }) => {
    if (!cell) {
        return <td className="px-2 py-1.5 text-center theme-text-tertiary" title="Not compared">–</td>;
    }
    const direction = cell.better === null ? '' : cell.better ? ' (better)' : ' (worse)';
    return (
        <td className="p-0.5">
            <div
                className={`rounded px-2 py-1.5 text-center font-mono text-sm whitespace-nowrap ${diffTone(cell.diff, cell.better)}`}
                title={cell.tooltip}
                data-better={cell.better === null ? 'neutral' : String(cell.better)}
            >
                {formatDiff(cell.diff)}
                <span className="sr-only">{direction}</span>
                {cell.count > 1 && (
                    <span className="ml-1 inline-block rounded-full bg-black/10 dark:bg-white/20 px-1.5 text-[10px] font-sans align-middle" aria-hidden="true">
                        ×{cell.count}
                    </span>
                )}
                {cell.mismatch.length > 0 && (
                    <span className="ml-1 font-sans" data-testid="mismatch-marker" title={`Differs: ${cell.mismatch.join(', ')}`}>⚠</span>
                )}
            </div>
        </td>
    );
};

const DiffMatrixTable: React.FC<DiffMatrixTableProps> = ({ rows, baseline, target, metric }) => {
    const matrix = useMemo(() => buildDiffMatrix(rows, baseline, target, metric), [rows, baseline, target, metric]);

    if (matrix.patterns.length === 0) {
        return <p className="text-sm theme-text-secondary">No configuration of this target matches the baseline with the current filters.</p>;
    }

    return (
        <div className="overflow-x-auto">
            <table className="text-sm border-separate border-spacing-0" aria-label={`${metricLabel(metric)} difference of ${target} vs ${baseline}`}>
                <thead>
                    <tr>
                        <th scope="col" className="px-2 py-1.5 text-left font-medium theme-text-secondary">Pattern \ Block size</th>
                        {matrix.blockSizes.map((blockSize) => (
                            <th key={blockSize} scope="col" className="px-2 py-1.5 text-center font-medium theme-text-secondary">{blockSize}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {matrix.patterns.map((pattern) => (
                        <tr key={pattern}>
                            <th scope="row" className="px-2 py-1.5 text-left font-medium theme-text-primary whitespace-nowrap">{pattern}</th>
                            {matrix.blockSizes.map((blockSize) => (
                                <DiffCell key={blockSize} cell={matrix.cells.get(cellKey(pattern, blockSize))} />
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default DiffMatrixTable;
