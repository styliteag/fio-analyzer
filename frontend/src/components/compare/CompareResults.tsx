// Summary, per-target diff matrices and the detail table of one comparison
import { useMemo } from 'react';
import { Card } from '../ui';
import type { CompareMetric, CompareResponse } from '../../services/api/compare';
import { applyConfigFilters, distinctValues, metricLabel, targetLabel, type ConfigFilters as Filters } from './compareUtils';
import CompareDetailsTable from './CompareDetailsTable';
import CompareSummary from './CompareSummary';
import ConfigFilters from './ConfigFilters';
import DiffMatrixTable from './DiffMatrixTable';

interface CompareResultsProps {
    readonly data: CompareResponse;
    readonly metric: CompareMetric;
    readonly filters: Filters;
    readonly onFiltersChange: (changes: Partial<Filters>) => void;
}

const LEGEND = [
    { className: 'bg-green-600', label: 'better' },
    { className: 'bg-red-600', label: 'worse' },
    { className: 'bg-gray-300 dark:bg-gray-600', label: 'within ±5%' },
];

/** Ignore URL filter values the current response does not contain */
const effectiveFilters = (data: CompareResponse, filters: Filters): Filters => ({
    numJobs: distinctValues(data.rows, 'num_jobs').includes(filters.numJobs) ? filters.numJobs : '',
    iodepth: distinctValues(data.rows, 'iodepth').includes(filters.iodepth) ? filters.iodepth : '',
    direct: distinctValues(data.rows, 'direct').includes(filters.direct) ? filters.direct : '',
});

const CompareResults: React.FC<CompareResultsProps> = ({ data, metric, filters, onFiltersChange }) => {
    const active = useMemo(() => effectiveFilters(data, filters), [data, filters]);
    const rows = useMemo(() => applyConfigFilters(data.rows, active), [data.rows, active]);
    const others = data.targets.slice(1);

    return (
        <div className="flex flex-col gap-6">
            <Card className="p-5">
                <h2 className="text-lg font-semibold theme-text-primary mb-1">Summary</h2>
                <p className="text-sm theme-text-secondary mb-3">
                    Median difference to the baseline <span className="font-medium theme-text-primary">{targetLabel(data.baseline)}</span> over
                    all compared configurations{data.strict ? ' (strict matching)' : ' (loose matching)'}.
                </p>
                <CompareSummary data={data} metric={metric} />
            </Card>

            <Card className="p-5">
                <div className="flex flex-col gap-3 mb-4">
                    <h2 className="text-lg font-semibold theme-text-primary">{metricLabel(metric)} difference by pattern and block size</h2>
                    <ConfigFilters rows={data.rows} filters={active} onChange={onFiltersChange} />
                    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs theme-text-secondary">
                        {LEGEND.map((item) => (
                            <span key={item.label} className="inline-flex items-center gap-1">
                                <span className={`inline-block h-3 w-3 rounded-sm ${item.className}`} aria-hidden="true" />
                                {item.label}
                            </span>
                        ))}
                        <span>Stronger colour = larger difference (5 / 20 / 50%)</span>
                        <span>×n = median of n configurations (hover for details)</span>
                        {!data.strict && <span>⚠ = test size, duration or layout differ</span>}
                    </p>
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {others.map((target) => (
                        <section key={target} aria-label={`${targetLabel(target)} vs baseline`}>
                            <h3 className="text-sm font-semibold theme-text-primary mb-2">
                                {targetLabel(target)} <span className="font-normal theme-text-secondary">vs {targetLabel(data.baseline)}</span>
                            </h3>
                            <DiffMatrixTable rows={rows} baseline={data.baseline} target={target} metric={metric} />
                        </section>
                    ))}
                </div>
            </Card>

            <Card className="p-5">
                <CompareDetailsTable data={data} rows={rows} metric={metric} />
            </Card>
        </div>
    );
};

export default CompareResults;
