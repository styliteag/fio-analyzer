// Expanded table of test runs (used by UUID groups, latest runs and the hierarchy)
import type { TestRun } from '../../../types';

interface TestRunsTableProps {
    readonly runs: readonly TestRun[];
    readonly onSelect: (id: number) => void;
}

const HEADERS = ['Test Run', 'Configuration', 'Performance', 'UUIDs'] as const;
const TH = 'px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase';
const MAX_NAME = 40;

const truncateName = (name?: string): string =>
    name && name.length > MAX_NAME ? `${name.substring(0, MAX_NAME)}...` : name || 'Unnamed Test';

export const UUIDCell: React.FC<{ readonly configUuid?: string; readonly runUuid?: string }> = ({ configUuid, runUuid }) => (
    <>
        {configUuid && (
            <div title={configUuid} className="mb-1">
                C: {configUuid.slice(0, 8)}...
            </div>
        )}
        {runUuid && <div title={runUuid}>R: {runUuid.slice(0, 8)}...</div>}
    </>
);

const TestRunRow: React.FC<{ readonly run: TestRun; readonly onSelect: (id: number) => void }> = ({ run, onSelect }) => (
    <tr onClick={() => onSelect(run.id)} className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors">
        <td className="px-4 py-3">
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Test Run #{run.id}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{new Date(run.timestamp).toLocaleString()}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1" title={run.test_name || 'Unnamed Test'}>
                {truncateName(run.test_name)}
            </div>
        </td>
        <td className="px-4 py-3">
            <div className="text-sm text-gray-900 dark:text-gray-100">
                <span className="font-medium">{run.protocol}</span> • {run.read_write_pattern}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {run.drive_type} - {run.drive_model}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Block: {run.block_size} • QD: {run.queue_depth} • Jobs: {run.num_jobs || 1}
            </div>
        </td>
        <td className="px-4 py-3">
            <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                {run.iops ? Math.round(run.iops).toLocaleString() : 'N/A'} IOPS
            </div>
            {run.bandwidth && (
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">BW: {run.bandwidth.toFixed(2)} MB/s</div>
            )}
            {run.avg_latency && (
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Latency: {run.avg_latency.toFixed(3)} ms</div>
            )}
        </td>
        <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
            <UUIDCell configUuid={run.config_uuid} runUuid={run.run_uuid} />
        </td>
    </tr>
);

export const TestRunsTable: React.FC<TestRunsTableProps> = ({ runs, onSelect }) => (
    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-100 dark:bg-gray-700">
            <tr>
                {HEADERS.map((header) => (
                    <th key={header} className={TH}>
                        {header}
                    </th>
                ))}
            </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {runs.map((run) => (
                <TestRunRow key={run.id} run={run} onSelect={onSelect} />
            ))}
        </tbody>
    </table>
);
