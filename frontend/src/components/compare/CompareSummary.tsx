// Per-target summary: configurations compared and median differences to the baseline
import type { CompareMetric, CompareResponse } from '../../services/api/compare';
import { betterForMetric, diffTone, formatDiff, METRIC_OPTIONS, targetLabel } from './compareUtils';

interface CompareSummaryProps {
    readonly data: CompareResponse;
    readonly metric: CompareMetric;
}

const CompareSummary: React.FC<CompareSummaryProps> = ({ data, metric }) => {
    const others = data.targets.slice(1);
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full text-sm" aria-label="Summary per target">
                <thead>
                    <tr className="text-left theme-text-secondary border-b theme-border-primary">
                        <th scope="col" className="py-2 pr-4 font-medium">Target vs baseline</th>
                        <th scope="col" className="py-2 pr-4 font-medium text-right">Configs</th>
                        {METRIC_OPTIONS.map((option) => (
                            <th
                                key={option.value}
                                scope="col"
                                className={`py-2 pr-4 font-medium text-right ${option.value === metric ? 'theme-text-primary' : ''}`}
                            >
                                Median {option.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {others.map((target) => {
                        const summary = data.summary[target];
                        return (
                            <tr key={target} className="border-b last:border-0 theme-border-primary">
                                <th scope="row" className="py-2 pr-4 text-left font-medium theme-text-primary">{targetLabel(target)}</th>
                                <td className="py-2 pr-4 text-right theme-text-secondary whitespace-nowrap">
                                    {summary?.configs_compared ?? 0}
                                    {summary && summary.configs_mismatched > 0 && (
                                        <span className="ml-1 text-amber-700 dark:text-amber-400" title="Configurations whose test size, duration or layout differ (loose mode)">
                                            ({summary.configs_mismatched} ⚠)
                                        </span>
                                    )}
                                </td>
                                {METRIC_OPTIONS.map((option) => {
                                    const diff = summary?.median_diff_pct[option.value] ?? null;
                                    return (
                                        <td key={option.value} className="py-1 pr-2 text-right">
                                            <span className={`inline-block rounded px-2 py-1 font-mono whitespace-nowrap ${diffTone(diff, betterForMetric(option.value, diff))}`}>
                                                {formatDiff(diff)}
                                            </span>
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

export default CompareSummary;
