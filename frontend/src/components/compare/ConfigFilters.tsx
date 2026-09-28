// Narrow the matrix to one num_jobs / iodepth / direct value (built from the values in the response)
import type { CompareRow } from '../../services/api/compare';
import { distinctValues, type ConfigFilters as Filters } from './compareUtils';

interface ConfigFiltersProps {
    readonly rows: readonly CompareRow[];
    readonly filters: Filters;
    readonly onChange: (changes: Partial<Filters>) => void;
}

const FIELD = 'px-2 py-1.5 border rounded-lg text-sm theme-bg-primary theme-text-primary theme-border-primary';

const DIRECT_LABELS: Readonly<Record<string, string>> = { '0': 'buffered (0)', '1': 'direct (1)' };

const FilterSelect: React.FC<{
    readonly id: string;
    readonly label: string;
    readonly value: string;
    readonly values: readonly string[];
    readonly format?: (value: string) => string;
    readonly onChange: (value: string) => void;
}> = ({ id, label, value, values, format = (item) => item, onChange }) => (
    <label htmlFor={id} className="inline-flex items-center gap-2 text-sm theme-text-secondary">
        {label}
        <select id={id} className={FIELD} value={value} onChange={(e) => onChange(e.target.value)} disabled={values.length < 2 && value === ''}>
            <option value="">All ({values.length})</option>
            {values.map((item) => (
                <option key={item} value={item}>{format(item)}</option>
            ))}
        </select>
    </label>
);

const ConfigFilters: React.FC<ConfigFiltersProps> = ({ rows, filters, onChange }) => (
    <div className="flex flex-wrap items-center gap-4">
        <span className="text-sm font-medium theme-text-primary">Configuration</span>
        <FilterSelect
            id="compare-numjobs"
            label="Jobs"
            value={filters.numJobs}
            values={distinctValues(rows, 'num_jobs')}
            onChange={(numJobs) => onChange({ numJobs })}
        />
        <FilterSelect
            id="compare-iodepth"
            label="IO depth"
            value={filters.iodepth}
            values={distinctValues(rows, 'iodepth')}
            onChange={(iodepth) => onChange({ iodepth })}
        />
        <FilterSelect
            id="compare-direct"
            label="Direct"
            value={filters.direct}
            values={distinctValues(rows, 'direct')}
            format={(item) => DIRECT_LABELS[item] ?? item}
            onChange={(direct) => onChange({ direct })}
        />
    </div>
);

export default ConfigFilters;
