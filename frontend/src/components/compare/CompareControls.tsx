// Metric, source, strict matching and filters of the test-run comparison
import { Info } from 'lucide-react';
import type { CompareMetric, CompareSource } from '../../services/api/compare';
import { SYNC_MODE_LABELS, SYNC_MODE_ORDER } from '../../utils/syncMode';
import { METRIC_OPTIONS } from './compareUtils';

export interface CompareSettings {
    readonly metric: CompareMetric;
    readonly source: CompareSource;
    readonly strict: boolean;
    readonly syncs: readonly string[];
    readonly tags: string;
    readonly since: string;
    readonly until: string;
    readonly includeIncomplete: boolean;
}

interface CompareControlsProps {
    readonly settings: CompareSettings;
    readonly onChange: (changes: Partial<CompareSettings>) => void;
}

const FIELD = 'px-3 py-2 border rounded-lg text-sm theme-bg-primary theme-text-primary theme-border-primary';
const LABEL = 'block text-sm font-medium theme-text-secondary mb-1';
const STRICT_HELP =
    'Strict: only configurations with identical test size, duration, file layout (prefill / fileperjob / satcap tags), client count and I/O engine (e.g. libaio vs. io_uring) are compared. ' +
    'Turn it off to match on pattern, block size, sync, direct, jobs and queue depth only; differing fields are marked with ⚠.';

/** Text field that writes on blur or Enter, so the comparison is not reloaded per keystroke */
const CommitInput: React.FC<{ readonly id: string; readonly value: string; readonly placeholder: string; readonly onCommit: (value: string) => void }> = ({
    id,
    value,
    placeholder,
    onCommit,
}) => (
    <input
        key={value}
        id={id}
        type="text"
        defaultValue={value}
        placeholder={placeholder}
        onBlur={(event) => event.target.value.trim() !== value && onCommit(event.target.value.trim())}
        onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
        className={`${FIELD} w-40`}
    />
);

const CompareControls: React.FC<CompareControlsProps> = ({ settings, onChange }) => {
    const toggleSync = (mode: string) =>
        onChange({ syncs: settings.syncs.includes(mode) ? settings.syncs.filter((item) => item !== mode) : [...settings.syncs, mode] });

    return (
        <div className="flex flex-wrap items-end gap-4">
            <div>
                <label htmlFor="compare-metric" className={LABEL}>Metric</label>
                <select id="compare-metric" className={FIELD} value={settings.metric} onChange={(e) => onChange({ metric: e.target.value as CompareMetric })}>
                    {METRIC_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </select>
            </div>
            <div>
                <label htmlFor="compare-source" className={LABEL}>Source</label>
                <select id="compare-source" className={FIELD} value={settings.source} onChange={(e) => onChange({ source: e.target.value as CompareSource })}>
                    <option value="newest">Newest comparable run</option>
                    <option value="latest">Latest-results table</option>
                </select>
            </div>
            <fieldset>
                <legend className={LABEL}>Sync mode</legend>
                <div className="flex gap-3 py-2">
                    {SYNC_MODE_ORDER.map((mode) => (
                        <label key={mode} className="inline-flex items-center gap-1.5 text-sm theme-text-primary">
                            <input type="checkbox" checked={settings.syncs.includes(mode)} onChange={() => toggleSync(mode)} />
                            {SYNC_MODE_LABELS[mode]}
                        </label>
                    ))}
                </div>
            </fieldset>
            <div>
                <label htmlFor="compare-tags" className={LABEL}>Tags</label>
                <CommitInput id="compare-tags" value={settings.tags} placeholder="e.g. prefill:1" onCommit={(tags) => onChange({ tags })} />
            </div>
            <div>
                <label htmlFor="compare-since" className={LABEL}>From</label>
                <input id="compare-since" type="date" className={FIELD} value={settings.since} onChange={(e) => onChange({ since: e.target.value })} />
            </div>
            <div>
                <label htmlFor="compare-until" className={LABEL}>To</label>
                <input id="compare-until" type="date" className={FIELD} value={settings.until} onChange={(e) => onChange({ until: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1 py-1">
                <label className="inline-flex items-center gap-2 text-sm theme-text-primary" title={STRICT_HELP}>
                    <input
                        type="checkbox"
                        checked={settings.strict}
                        aria-describedby="compare-strict-help"
                        onChange={(e) => onChange({ strict: e.target.checked })}
                    />
                    Strict matching
                    <Info className="h-4 w-4 theme-text-tertiary" aria-hidden="true" />
                    <span id="compare-strict-help" className="sr-only">{STRICT_HELP}</span>
                </label>
                <label
                    className="inline-flex items-center gap-2 text-sm theme-text-primary"
                    title="Also list configurations that only some targets have (shown as –)"
                >
                    <input type="checkbox" checked={settings.includeIncomplete} onChange={(e) => onChange({ includeIncomplete: e.target.checked })} />
                    Include incomplete
                </label>
            </div>
        </div>
    );
};

export default CompareControls;
