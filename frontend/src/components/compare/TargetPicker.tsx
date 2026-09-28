// Ordered multi-select of compare targets; the first one is the baseline
import CreatableSelect from 'react-select/creatable';
import { getSelectStyles } from '../../hooks/useThemeColors';
import type { CompareTarget } from '../../services/api/compare';
import { targetLabel } from './compareUtils';
import { applySelectAction } from './selectAction';

interface TargetPickerProps {
    readonly targets: readonly CompareTarget[];
    readonly selected: readonly string[];
    readonly loading: boolean;
    /** Receives an updater: the live list may be newer than this render while the URL navigation is pending */
    readonly onChange: (update: (current: readonly string[]) => readonly string[]) => void;
}

interface Option {
    readonly value: string;
    readonly label: string;
}

const MAX_TARGETS = 10;

const optionFor = (target: CompareTarget): Option => ({
    value: target.target,
    label: `${targetLabel(target.target)} (${target.test_runs} runs)`,
});

const TargetPicker: React.FC<TargetPickerProps> = ({ targets, selected, loading, onChange }) => {
    const options = targets.map(optionFor);
    const byValue = new Map(options.map((option) => [option.value, option]));
    const value = selected.map((target) => byValue.get(target) ?? { value: target, label: targetLabel(target) });

    const makeBaseline = (target: string) => onChange((current) => [target, ...current.filter((item) => item !== target)]);

    return (
        <div>
            <label htmlFor="compare-targets" className="block text-sm font-medium theme-text-primary mb-1">
                Targets <span className="font-normal theme-text-secondary">(first = baseline, 2–{MAX_TARGETS})</span>
            </label>
            <CreatableSelect
                inputId="compare-targets"
                isMulti
                closeMenuOnSelect={false}
                isLoading={loading}
                options={options}
                value={value}
                isOptionDisabled={() => selected.length >= MAX_TARGETS}
                onChange={(_, meta) => onChange((current) => applySelectAction(current, meta).slice(0, MAX_TARGETS))}
                formatCreateLabel={(input) => `Use pattern "${input}" (host|protocol|type|model, * = any)`}
                placeholder="Search host · protocol · type · model…"
                noOptionsMessage={() => 'No matching target'}
                className="text-sm"
                styles={getSelectStyles()}
            />
            {selected.length > 0 && (
                <ol className="mt-3 flex flex-wrap gap-2" aria-label="Selected targets in order">
                    {selected.map((target, index) => (
                        <li
                            key={target}
                            className="inline-flex items-center gap-2 rounded-lg border theme-border-primary px-2 py-1 text-xs theme-text-secondary"
                        >
                            <span className="font-medium theme-text-primary">{index + 1}. {targetLabel(target)}</span>
                            {index === 0 ? (
                                <span className="rounded-full bg-indigo-100 dark:bg-indigo-900/50 px-2 py-0.5 font-semibold text-indigo-700 dark:text-indigo-300">
                                    Baseline
                                </span>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => makeBaseline(target)}
                                    className="rounded px-1.5 py-0.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
                                    aria-label={`Make ${targetLabel(target)} the baseline`}
                                >
                                    Make baseline
                                </button>
                            )}
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
};

export default TargetPicker;
