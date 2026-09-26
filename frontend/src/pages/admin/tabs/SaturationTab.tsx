// "Saturation" tab: saturation test runs (one entry per run_uuid, many QD steps)
import { useMemo } from 'react';
import { Edit2, Trash2, type LucideIcon } from 'lucide-react';
import Loading from '../../../components/ui/Loading';
import ErrorDisplay from '../../../components/ui/ErrorDisplay';
import type { SaturationRun } from '../../../services/api/testRuns';
import { CopyUUIDButton } from '../components/CopyUUIDButton';
import { EmptyMessage, SectionHeader } from '../components/SectionHeader';
import type { SaturationRunsResult } from '../hooks/useSaturationRuns';
import type { SaturationEdits } from '../hooks/useSaturationEdits';
import { filterBySearch, matchesSaturationRun, plural } from '../utils';

interface SaturationTabProps {
    readonly title: string;
    readonly description: string;
    readonly icon: LucideIcon;
    readonly saturation: SaturationRunsResult;
    readonly searchTerm: string;
    readonly edits: SaturationEdits;
}

const Dot = () => <span className="text-gray-400 dark:text-gray-500">•</span>;

const SaturationRunCard: React.FC<{ readonly run: SaturationRun; readonly edits: SaturationEdits }> = ({ run, edits }) => (
    <div className="border theme-card rounded-lg p-4">
        <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="font-semibold theme-text-primary">{run.hostname}</span>
                    <Dot />
                    <span className="text-sm theme-text-secondary">{run.protocol}</span>
                    <Dot />
                    <span className="text-sm theme-text-secondary">{run.drive_type}</span>
                    <Dot />
                    <span className="text-sm theme-text-secondary">{run.drive_model}</span>
                </div>
                <div className="flex items-center gap-4 text-sm theme-text-secondary">
                    {run.block_size && <span>Block: {run.block_size}</span>}
                    <span>
                        {run.step_count} step{plural(run.step_count)}
                    </span>
                    <span>{new Date(run.started).toLocaleString()}</span>
                </div>
                {run.description && <div className="mt-2 text-sm theme-text-secondary truncate">{run.description}</div>}
                <div className="mt-1 font-mono text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                    <span className="truncate">{run.run_uuid}</span>
                    <CopyUUIDButton uuid={run.run_uuid} compact />
                </div>
            </div>
            <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                <button
                    type="button"
                    onClick={() => edits.openEdit(run)}
                    className="p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    title="Edit saturation run"
                    aria-label="Edit saturation run"
                >
                    <Edit2 className="w-4 h-4" />
                </button>
                <button
                    type="button"
                    onClick={() => edits.openDelete(run)}
                    className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    title="Delete saturation run"
                    aria-label="Delete saturation run"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        </div>
    </div>
);

export const SaturationTab: React.FC<SaturationTabProps> = ({ title, description, icon, saturation, searchTerm, edits }) => {
    const runs = useMemo(() => filterBySearch(saturation.runs, searchTerm, matchesSaturationRun), [saturation.runs, searchTerm]);
    const count = `${runs.length}${searchTerm ? ` / ${saturation.runs.length}` : ''} run${plural(runs.length)}`;

    const body = () => {
        if (saturation.loading) return <Loading message="Loading saturation runs..." />;
        if (saturation.error) return <ErrorDisplay error={saturation.error} />;
        if (runs.length === 0) {
            return <EmptyMessage>{searchTerm ? `No saturation runs found matching "${searchTerm}"` : 'No saturation runs found'}</EmptyMessage>;
        }
        return (
            <div className="space-y-3">
                {runs.map((run) => (
                    <SaturationRunCard key={run.run_uuid} run={run} edits={edits} />
                ))}
            </div>
        );
    };

    return (
        <div>
            <SectionHeader icon={icon} title={title} description={description} aside={count} />
            {body()}
        </div>
    );
};
