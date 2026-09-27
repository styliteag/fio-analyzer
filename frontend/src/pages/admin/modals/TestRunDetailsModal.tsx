import { formatSyncMode } from '../../../utils/syncMode';
import type { ReactNode } from 'react';
import Button from '../../../components/ui/Button';
import Loading from '../../../components/ui/Loading';
import Modal from '../../../components/ui/Modal';
import type { TestRun } from '../../../types';
import type { TestRunDetailsState } from '../types';

interface TestRunDetailsModalProps {
    readonly state: TestRunDetailsState;
    readonly onClose: () => void;
}

const isSet = <T,>(value: T | null | undefined): value is T => value !== undefined && value !== null;
const ms = (value?: number | null): string => (value ? `${value.toFixed(3)} ms` : 'N/A');

const Section: React.FC<{ readonly title: string; readonly children: ReactNode }> = ({ title, children }) => (
    <div>
        <h3 className="text-lg font-semibold theme-text-primary mb-3 border-b theme-border-primary pb-2">{title}</h3>
        {children}
    </div>
);

const Row: React.FC<{ readonly label: string; readonly children: ReactNode }> = ({ label, children }) => (
    <div className="flex justify-between gap-4">
        <span className="theme-text-secondary">{label}:</span>
        <span className="font-semibold theme-text-primary text-right">{children}</span>
    </div>
);

const Panel: React.FC<{ readonly title: string; readonly children: ReactNode }> = ({ title, children }) => (
    <div className="theme-bg-secondary p-3 rounded-lg space-y-2 text-sm">
        <div className="font-semibold theme-text-primary mb-2">{title}</div>
        {children}
    </div>
);

const Mono: React.FC<{ readonly children: ReactNode }> = ({ children }) => (
    <div className="font-mono text-xs text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-700 p-2 rounded">{children}</div>
);

const InfoSections: React.FC<{ readonly run: TestRun }> = ({ run }) => (
    <>
        <Section title="Test Information">
            <div className="space-y-2 text-sm">
                <Row label="Test Run ID">#{run.id}</Row>
                <Row label="Test Name">{run.test_name || 'N/A'}</Row>
                <Row label="Timestamp">{new Date(run.timestamp).toLocaleString()}</Row>
                <Row label="Hostname">{run.hostname}</Row>
            </div>
        </Section>
        <Section title="Storage Configuration">
            <div className="space-y-2 text-sm">
                <Row label="Protocol">{run.protocol}</Row>
                <Row label="Drive Type">{run.drive_type}</Row>
                <Row label="Drive Model">{run.drive_model}</Row>
            </div>
        </Section>
    </>
);

const ParameterSection: React.FC<{ readonly run: TestRun }> = ({ run }) => (
    <Section title="Test Parameters">
        <div className="space-y-2 text-sm">
            <Row label="I/O Pattern">{run.read_write_pattern}</Row>
            <Row label="Block Size">{run.block_size}</Row>
            <Row label="Queue Depth (iodepth)">{run.queue_depth}</Row>
            <Row label="Number of Jobs">{run.num_jobs || 1}</Row>
            <Row label="Test Size">{run.test_size || 'N/A'}</Row>
            <Row label="Duration">{run.duration ? `${run.duration}s` : 'N/A'}</Row>
            <Row label="Direct I/O">{run.direct ? 'Yes' : 'No'}</Row>
            <Row label="Sync">{formatSyncMode(run.sync)}</Row>
            {isSet(run.rwmixread) && <Row label="Read/Write Mix (Read %)">{run.rwmixread}%</Row>}
            {run.fio_version && <Row label="FIO Version">{run.fio_version}</Row>}
            {isSet(run.job_runtime) && <Row label="Job Runtime">{run.job_runtime}s</Row>}
        </div>
    </Section>
);

const MetricTile: React.FC<{ readonly label: string; readonly value: string; readonly tone: 'indigo' | 'green' }> = ({ label, value, tone }) => {
    const colors =
        tone === 'indigo'
            ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
            : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400';
    return (
        <div className={`${colors} p-3 rounded-lg`}>
            <div className="text-xs theme-text-secondary mb-1">{label}</div>
            <div className="text-2xl font-bold">{value}</div>
        </div>
    );
};

const PerformanceSection: React.FC<{ readonly run: TestRun }> = ({ run }) => (
    <Section title="Performance Metrics">
        <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
                <MetricTile label="IOPS" tone="indigo" value={run.iops ? Math.round(run.iops).toLocaleString() : 'N/A'} />
                <MetricTile label="Bandwidth" tone="green" value={run.bandwidth ? `${run.bandwidth.toFixed(2)} MB/s` : 'N/A'} />
            </div>
            <Panel title="Latency Metrics">
                <Row label="Average Latency">{ms(run.avg_latency)}</Row>
                {isSet(run.p70_latency) && <Row label="P70 Latency">{run.p70_latency.toFixed(3)} ms</Row>}
                {isSet(run.p90_latency) && <Row label="P90 Latency">{run.p90_latency.toFixed(3)} ms</Row>}
                <Row label="P95 Latency">{ms(run.p95_latency)}</Row>
                <Row label="P99 Latency">{ms(run.p99_latency)}</Row>
            </Panel>
            {Boolean(run.total_ios_read || run.total_ios_write) && (
                <Panel title="I/O Statistics">
                    {isSet(run.total_ios_read) && <Row label="Total Read I/Os">{run.total_ios_read.toLocaleString()}</Row>}
                    {isSet(run.total_ios_write) && <Row label="Total Write I/Os">{run.total_ios_write.toLocaleString()}</Row>}
                </Panel>
            )}
            {Boolean(run.usr_cpu || run.sys_cpu) && (
                <Panel title="CPU Usage">
                    {isSet(run.usr_cpu) && <Row label="User CPU">{run.usr_cpu.toFixed(2)}%</Row>}
                    {isSet(run.sys_cpu) && <Row label="System CPU">{run.sys_cpu.toFixed(2)}%</Row>}
                </Panel>
            )}
        </div>
    </Section>
);

const UUIDSection: React.FC<{ readonly run: TestRun }> = ({ run }) => (
    <Section title="UUIDs">
        <div className="space-y-2 text-sm">
            <div>
                <div className="theme-text-secondary mb-1">Config UUID:</div>
                <Mono>{run.config_uuid || 'N/A'}</Mono>
            </div>
            <div>
                <div className="theme-text-secondary mb-1">Run UUID:</div>
                <Mono>{run.run_uuid || 'N/A'}</Mono>
            </div>
        </div>
    </Section>
);

const Details: React.FC<{ readonly run: TestRun; readonly onClose: () => void }> = ({ run, onClose }) => (
    <div className="space-y-4">
        <InfoSections run={run} />
        <ParameterSection run={run} />
        <PerformanceSection run={run} />
        <UUIDSection run={run} />
        {run.description && (
            <Section title="Description">
                <div className="text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 p-3 rounded-lg whitespace-pre-wrap">
                    {run.description}
                </div>
            </Section>
        )}
        <div className="flex gap-2 pt-4 border-t theme-border-primary">
            <Button variant="outline" onClick={onClose} className="flex-1">
                Close
            </Button>
        </div>
    </div>
);

export const TestRunDetailsModal: React.FC<TestRunDetailsModalProps> = ({ state, onClose }) => (
    <Modal isOpen={state.isOpen} onClose={onClose} title="Test Run Details">
        {state.isLoading ? (
            <Loading message="Loading test details..." />
        ) : state.testRun ? (
            <Details run={state.testRun} onClose={onClose} />
        ) : (
            <div className="text-center py-12 theme-text-secondary">No test run data available</div>
        )}
    </Modal>
);
