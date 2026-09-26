import { Calendar } from 'lucide-react';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import type { Cleanup } from '../hooks/useCleanup';
import type { CompactFrequency, DataCleanupState } from '../types';
import { plural } from '../utils';

const FIELD_CLASS =
    'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100';
const LABEL_CLASS = 'block text-sm font-medium theme-text-primary mb-2';
const PERIOD: Record<CompactFrequency, string> = { daily: 'day', weekly: 'week', monthly: 'month' };

const ModeNotice: React.FC<{ readonly state: DataCleanupState }> = ({ state }) =>
    state.mode === 'delete-old' ? (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Warning:</strong> This will permanently delete all test runs older than the specified date.
            </p>
        </div>
    ) : (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Compact Mode:</strong> This will keep only {state.compactFrequency} samples before the cutoff date, removing hourly
                tests while preserving representative data.
            </p>
        </div>
    );

const HostFilterNotice: React.FC<{ readonly hostname: string }> = ({ hostname }) => (
    <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4">
        <p className="text-sm text-indigo-800 dark:text-indigo-200">
            <strong>Host Filter:</strong> Only data from host <span className="font-mono font-semibold">&quot;{hostname}&quot;</span> will
            be affected.
        </p>
    </div>
);

const CleanupFields: React.FC<{ readonly cleanup: Cleanup }> = ({ cleanup }) => {
    const { state, update } = cleanup;
    return (
        <>
            <div>
                <label htmlFor="cleanup-cutoff" className={LABEL_CLASS}>
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Cutoff Date (keep data after this date)
                </label>
                <input
                    id="cleanup-cutoff"
                    type="date"
                    value={state.cutoffDate}
                    onChange={(e) => update({ cutoffDate: e.target.value, previewCount: null })}
                    className={FIELD_CLASS}
                />
                <p className="text-xs theme-text-secondary mt-1">
                    Data before {new Date(state.cutoffDate).toLocaleDateString()} will be{' '}
                    {state.mode === 'delete-old' ? 'deleted' : 'compacted'}
                </p>
            </div>
            {state.mode === 'compact' && (
                <div>
                    <label htmlFor="cleanup-frequency" className={LABEL_CLASS}>
                        Keep Frequency (for data before cutoff date)
                    </label>
                    <select
                        id="cleanup-frequency"
                        value={state.compactFrequency}
                        onChange={(e) => update({ compactFrequency: e.target.value as CompactFrequency, previewCount: null })}
                        className={FIELD_CLASS}
                    >
                        <option value="daily">Daily (one test per day)</option>
                        <option value="weekly">Weekly (one test per week)</option>
                        <option value="monthly">Monthly (one test per month)</option>
                    </select>
                    <p className="text-xs theme-text-secondary mt-1">
                        Only the most recent test per {PERIOD[state.compactFrequency]} will be kept
                    </p>
                </div>
            )}
        </>
    );
};

export const DataCleanupModal: React.FC<{ readonly cleanup: Cleanup }> = ({ cleanup }) => {
    const { state, close, preview, execute } = cleanup;
    const title = state.mode === 'delete-old' ? 'Delete Old Historical Data' : 'Compact Historical Data';

    return (
        <Modal isOpen={state.isOpen} onClose={close} title={title}>
            <div className="space-y-4">
                <ModeNotice state={state} />
                {state.hostname && <HostFilterNotice hostname={state.hostname} />}
                <CleanupFields cleanup={cleanup} />
                <div className="flex gap-2 pt-2">
                    <Button variant="outline" onClick={preview} disabled={state.isLoading} className="flex-1">
                        {state.isLoading ? 'Calculating...' : 'Preview Changes'}
                    </Button>
                </div>
                {state.previewCount !== null && (
                    <div className="theme-bg-secondary border theme-border-primary rounded-lg p-4">
                        <p className="text-sm theme-text-primary">
                            <strong>Preview:</strong> This operation will affect <strong>{state.previewCount}</strong> test run
                            {plural(state.previewCount)}.
                        </p>
                    </div>
                )}
                <div className="flex gap-2 pt-4 border-t theme-border-primary">
                    <Button
                        variant="danger"
                        onClick={execute}
                        disabled={state.isLoading || state.previewCount === null}
                        className="flex-1"
                    >
                        {state.isLoading ? 'Processing...' : `Execute ${state.mode === 'delete-old' ? 'Deletion' : 'Compaction'}`}
                    </Button>
                    <Button variant="outline" onClick={close} disabled={state.isLoading}>
                        Cancel
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
