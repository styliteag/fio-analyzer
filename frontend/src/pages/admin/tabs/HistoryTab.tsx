// "History" tab: every stored test run (test_runs_all) plus cleanup actions
import { useMemo } from 'react';
import { PackageMinus, Trash2, type LucideIcon } from 'lucide-react';
import Button from '../../../components/ui/Button';
import Loading from '../../../components/ui/Loading';
import { EmptyMessage, SectionHeader } from '../components/SectionHeader';
import { UUIDCell } from '../components/TestRunsTable';
import type { HistoryDataResult } from '../hooks/useHistoryData';
import type { CleanupMode, HistoryRow } from '../types';
import { filterBySearch, matchesRun, plural } from '../utils';

interface HistoryTabProps {
    readonly title: string;
    readonly description: string;
    readonly icon: LucideIcon;
    readonly history: HistoryDataResult;
    readonly searchTerm: string;
    readonly onCleanup: (mode: CleanupMode) => void;
}

const HEADERS = ['ID', 'Timestamp', 'Hostname', 'Protocol', 'Drive', 'Pattern', 'Block Size', 'IOPS', 'UUIDs'] as const;
const TH = 'px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase';
const TD = 'px-4 py-3 text-sm text-gray-600 dark:text-gray-400';

const HistoryTableRow: React.FC<{ readonly run: HistoryRow }> = ({ run }) => (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700">
        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{run.test_run_id || run.id}</td>
        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
            {new Date(run.timestamp || run.test_date || '').toLocaleDateString()}
        </td>
        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{run.hostname}</td>
        <td className={TD}>{run.protocol}</td>
        <td className={TD}>
            {run.drive_type && (
                <>
                    {run.drive_type}
                    <br />
                </>
            )}
            <span className="text-xs text-gray-500 dark:text-gray-400">{run.drive_model}</span>
        </td>
        <td className={TD}>{run.read_write_pattern}</td>
        <td className={TD}>{run.block_size}</td>
        <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
            {run.iops ? Math.round(run.iops).toLocaleString() : 'N/A'}
        </td>
        <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
            <UUIDCell configUuid={run.config_uuid} runUuid={run.run_uuid} />
        </td>
    </tr>
);

const HistoryTable: React.FC<{ readonly rows: readonly HistoryRow[] }> = ({ rows }) => (
    <div className="theme-card border rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="theme-bg-secondary">
                    <tr>
                        {HEADERS.map((header) => (
                            <th key={header} className={TH}>
                                {header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {rows.map((run, index) => (
                        <HistoryTableRow key={run.test_run_id || run.id || index} run={run} />
                    ))}
                </tbody>
            </table>
        </div>
    </div>
);

export const HistoryTab: React.FC<HistoryTabProps> = ({ title, description, icon, history, searchTerm, onCleanup }) => {
    const rows = useMemo(() => filterBySearch(history.rows, searchTerm, matchesRun), [history.rows, searchTerm]);
    const count = `Showing ${rows.length} ${searchTerm ? `/ ${history.rows.length} ` : ''}historical test run${plural(rows.length)}`;

    const actions = (
        <>
            <span className="mr-2">{count}</span>
            <Button variant="outline" size="sm" onClick={() => onCleanup('delete-old')}>
                <Trash2 className="w-4 h-4" />
                Delete Old Data
            </Button>
            <Button variant="outline" size="sm" onClick={() => onCleanup('compact')}>
                <PackageMinus className="w-4 h-4" />
                Compact History
            </Button>
        </>
    );

    return (
        <div>
            <SectionHeader icon={icon} title={title} description={description} aside={<div className="flex flex-wrap items-center gap-2">{actions}</div>} />
            {history.loading ? (
                <Loading message="Loading history..." />
            ) : rows.length === 0 ? (
                <EmptyMessage>
                    {searchTerm ? `No historical test runs found matching "${searchTerm}"` : 'No historical test runs found'}
                </EmptyMessage>
            ) : (
                <HistoryTable rows={rows} />
            )}
        </div>
    );
};
