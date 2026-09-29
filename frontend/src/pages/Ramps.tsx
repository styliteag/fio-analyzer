import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, Users } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { PageHeader, PAGE_CONTAINER } from '../components/layout';
import { Card, EmptyState, ErrorDisplay, Loading } from '../components/ui';
import { useUpdateUrlParams, useUrlValue, writeValue } from '../hooks/useUrlState';
import { useRampDetail, useRampSummary, useRamps } from '../hooks/useRampData';
import { downloadRampZip } from '../services/api/rawData';
import { DEFAULT_RAMP_THRESHOLD_MS, rampConfigLabel, rampHierarchy, type RampListItem } from '../services/api/ramp';
import { TESTING_SCRIPT_URL } from '../utils/apiDocs';
import { formatSyncMode } from '../utils/syncMode';
import {
    RAMP_SORT_KEYS,
    RampHierarchy,
    RampList,
    formatRampDate,
    sortRamps,
    type RampSortKey,
    type SortDirection,
} from '../components/ramp/RampList';
import { RampClientSpreadChart, RampLatencyChart, RampThroughputChart } from '../components/ramp/RampCharts';
import RampSummaryCards from '../components/ramp/RampSummaryCards';
import RampStepTable from '../components/ramp/RampStepTable';

const DIRECTIONS: readonly SortDirection[] = ['asc', 'desc'];
const SELECT = 'px-3 py-2 border rounded-lg theme-bg-primary theme-text-primary theme-border-primary';

interface RunGroup {
    readonly run_uuid: string;
    readonly hostname: string;
    readonly last_timestamp: string | null;
    readonly ramps: RampListItem[];
}

/** Ramps of one script run (run_uuid), newest run first; one ramp per test configuration */
const groupByRun = (ramps: readonly RampListItem[]): RunGroup[] => {
    const groups = new Map<string, RunGroup>();
    for (const ramp of ramps) {
        const key = ramp.run_uuid ?? ramp.ramp_uuid;
        const group = groups.get(key) ?? { run_uuid: key, hostname: ramp.hostname, last_timestamp: ramp.last_timestamp, ramps: [] };
        group.ramps.push(ramp);
        const newer = (ramp.last_timestamp ?? '') > (group.last_timestamp ?? '');
        groups.set(key, newer ? { ...group, last_timestamp: ramp.last_timestamp } : group);
    }
    return [...groups.values()].sort((a, b) => (b.last_timestamp ?? '').localeCompare(a.last_timestamp ?? ''));
};

const runLabel = (group: RunGroup): string =>
    `${formatRampDate(group.last_timestamp)} · ${group.hostname} · ${group.ramps.length} configuration${group.ramps.length === 1 ? '' : 's'} · ${group.run_uuid.slice(0, 8)}`;

export default function Ramps() {
    const toast = useToast();
    const { data: rampData, loading: loadingRamps, error: rampsError } = useRamps();
    const ramps = useMemo(() => rampData ?? [], [rampData]);

    // Selection and filters live in the URL (?host=&run=&ramp=&threshold=&sort=&dir=)
    const [searchParams] = useSearchParams();
    const updateParams = useUpdateUrlParams();
    const host = searchParams.get('host');
    const run = searchParams.get('run');
    const requestedRamp = searchParams.get('ramp');
    const thresholdRaw = searchParams.get('threshold');
    const thresholdParsed = Number(thresholdRaw);
    const thresholdMs = thresholdRaw && thresholdParsed > 0 ? thresholdParsed : DEFAULT_RAMP_THRESHOLD_MS;
    const [sortKey] = useUrlValue<RampSortKey>('sort', 'date', RAMP_SORT_KEYS);
    const [sortDirection] = useUrlValue<SortDirection>('dir', 'desc', DIRECTIONS);

    const hostnames = useMemo(() => [...new Set(ramps.map((ramp) => ramp.hostname))].sort(), [ramps]);
    const hostRamps = useMemo(() => (host ? ramps.filter((ramp) => ramp.hostname === host) : ramps), [ramps, host]);
    const runs = useMemo(() => groupByRun(hostRamps), [hostRamps]);
    const visibleRamps = useMemo(
        () => sortRamps(run ? hostRamps.filter((ramp) => (ramp.run_uuid ?? ramp.ramp_uuid) === run) : hostRamps, sortKey, sortDirection),
        [hostRamps, run, sortKey, sortDirection],
    );

    // The ramp from the URL if it exists, else the first one in the list
    const selected = useMemo(
        () => ramps.find((ramp) => ramp.ramp_uuid === requestedRamp) ?? visibleRamps[0] ?? null,
        [ramps, requestedRamp, visibleRamps],
    );
    const siblings = useMemo(
        () => (selected ? sortRamps(ramps.filter((ramp) => ramp.run_uuid === selected.run_uuid), 'config', 'asc') : []),
        [ramps, selected],
    );

    const selectedUuid = selected?.ramp_uuid ?? null;
    const detailState = useRampDetail(selectedUuid);
    const summaryState = useRampSummary(selectedUuid, thresholdMs);
    const detail = detailState.data?.ramp_uuid === selectedUuid ? detailState.data : null;
    const summary = summaryState.data?.ramp_uuid === selectedUuid ? summaryState.data : null;

    // Charts use the step the summary ranks per client count (newest upload); the table lists every upload
    const rankedIds = useMemo(() => new Set(summary?.steps.map((step) => step.id) ?? []), [summary]);
    const rankedDetailSteps = useMemo(() => detail?.steps.filter((step) => rankedIds.has(step.id)) ?? [], [detail, rankedIds]);

    const handleHost = useCallback(
        (value: string) =>
            updateParams((params) => {
                writeValue(params, 'host', value);
                params.delete('run');
                params.delete('ramp');
            }),
        [updateParams],
    );
    const handleRun = useCallback(
        (value: string) =>
            updateParams((params) => {
                writeValue(params, 'run', value);
                params.delete('ramp');
            }),
        [updateParams],
    );
    const handleSelect = useCallback((ramp: RampListItem) => updateParams((params) => params.set('ramp', ramp.ramp_uuid)), [updateParams]);
    const handleSort = useCallback(
        (key: RampSortKey) => {
            const direction: SortDirection = key === sortKey ? (sortDirection === 'asc' ? 'desc' : 'asc') : key === 'date' ? 'desc' : 'asc';
            updateParams((params) => {
                writeValue(params, 'sort', key, 'date');
                writeValue(params, 'dir', direction, 'desc');
            });
        },
        [sortKey, sortDirection, updateParams],
    );
    const handleDownload = useCallback(() => {
        if (selectedUuid) downloadRampZip(selectedUuid).catch((error: Error) => toast.error(error.message));
    }, [selectedUuid, toast]);

    const noData = !loadingRamps && !rampsError && ramps.length === 0;

    return (
        <div className={PAGE_CONTAINER}>
            <PageHeader
                title="Client Ramps"
                description="How storage scales with the number of clients: aggregate throughput, latency against a P95 threshold and fairness between clients per step."
            />

            {loadingRamps && <Loading />}
            {rampsError && (
                <div className="mb-4">
                    <ErrorDisplay error={rampsError} />
                </div>
            )}

            {noData && (
                <Card className="p-6">
                    <EmptyState
                        icon={<Users className="h-12 w-12" />}
                        title="No client ramps yet"
                        description="A client ramp runs one test configuration with a growing number of fio clients (RAMP_CLIENTS in fio-test.sh controller mode); every step uploads automatically."
                        action={
                            <a href={TESTING_SCRIPT_URL} className="px-4 py-2 rounded-lg text-sm font-medium theme-btn-primary">
                                Download fio-test.sh
                            </a>
                        }
                    />
                </Card>
            )}

            {!loadingRamps && ramps.length > 0 && (
                <div className="space-y-6">
                    <Card padding="none">
                        <div className="flex flex-wrap items-end gap-4 p-4">
                            <div>
                                <label htmlFor="ramp-host" className="block text-sm font-medium theme-text-secondary mb-1">Host</label>
                                <select id="ramp-host" className={SELECT} value={host ?? ''} onChange={(e) => handleHost(e.target.value)}>
                                    <option value="">All hosts</option>
                                    {hostnames.map((name) => (
                                        <option key={name} value={name}>{name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex-1 min-w-[16rem]">
                                <label htmlFor="ramp-run" className="block text-sm font-medium theme-text-secondary mb-1">Run</label>
                                <select id="ramp-run" className={`${SELECT} w-full max-w-xl`} value={run ?? ''} onChange={(e) => handleRun(e.target.value)}>
                                    <option value="">All runs ({runs.length})</option>
                                    {runs.map((group) => (
                                        <option key={group.run_uuid} value={group.run_uuid}>{runLabel(group)}</option>
                                    ))}
                                </select>
                            </div>
                            <p className="text-sm theme-text-secondary">
                                {visibleRamps.length} ramp{visibleRamps.length === 1 ? '' : 's'}
                            </p>
                        </div>
                        {visibleRamps.length > 0 ? (
                            <RampList
                                ramps={visibleRamps}
                                selected={selectedUuid}
                                sortKey={sortKey}
                                sortDirection={sortDirection}
                                onSort={handleSort}
                                onSelect={handleSelect}
                            />
                        ) : (
                            <p className="px-4 pb-4 text-sm theme-text-secondary">No ramps match this filter.</p>
                        )}
                    </Card>

                    {selected && (
                        <>
                            <Card>
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                                    <div className="min-w-0">
                                        <h2 className="text-lg font-semibold theme-text-primary">
                                            <RampHierarchy ramp={selected} />
                                        </h2>
                                        <p className="mt-1 text-sm theme-text-secondary">
                                            {rampConfigLabel(selected)}
                                            {selected.sync ? ` · sync ${formatSyncMode(selected.sync)}` : ''}
                                            {selected.direct != null ? ` · direct=${selected.direct}` : ''}
                                            {selected.test_size ? ` · size ${selected.test_size}` : ''}
                                            {selected.duration ? ` · ${selected.duration}s per step` : ''}
                                            {` · ${formatRampDate(selected.first_timestamp)} – ${formatRampDate(selected.last_timestamp)}`}
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap items-end gap-3">
                                        {siblings.length > 1 && (
                                            <div>
                                                <label htmlFor="ramp-config" className="block text-sm font-medium theme-text-secondary mb-1">
                                                    Configuration in this run
                                                </label>
                                                <select
                                                    id="ramp-config"
                                                    className={SELECT}
                                                    value={selected.ramp_uuid}
                                                    onChange={(e) => updateParams((params) => params.set('ramp', e.target.value))}
                                                >
                                                    {siblings.map((ramp) => (
                                                        <option key={ramp.ramp_uuid} value={ramp.ramp_uuid}>
                                                            {rampConfigLabel(ramp) || rampHierarchy(ramp).join('-')}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                        <label className="text-sm font-medium theme-text-secondary">
                                            <span className="block mb-1">P95 threshold (ms)</span>
                                            <input
                                                type="number"
                                                min="0.01"
                                                step="any"
                                                value={thresholdRaw ?? ''}
                                                placeholder={String(DEFAULT_RAMP_THRESHOLD_MS)}
                                                onChange={(e) => updateParams((params) => writeValue(params, 'threshold', e.target.value))}
                                                className={`${SELECT} w-28`}
                                            />
                                        </label>
                                        <button
                                            type="button"
                                            onClick={handleDownload}
                                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium theme-text-secondary hover:theme-text-primary hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg border theme-border-primary transition-colors"
                                            title="All raw fio JSON files of this ramp as a ZIP"
                                        >
                                            <Download className="h-4 w-4" aria-hidden="true" />
                                            Raw JSON (ZIP)
                                        </button>
                                    </div>
                                </div>
                            </Card>

                            {(detailState.error || summaryState.error) && <ErrorDisplay error={detailState.error ?? summaryState.error} />}
                            {(!detail || !summary) && !detailState.error && !summaryState.error && <Loading message="Loading ramp..." />}

                            {detail && summary && (
                                <>
                                    <RampSummaryCards summary={summary} />
                                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                        <Card title="Aggregate throughput" subtitle="IOPS and bandwidth over all clients per client count">
                                            <RampThroughputChart steps={summary.steps} />
                                        </Card>
                                        <Card title="Latency" subtitle="Aggregate latency per client count; the dashed red line is the P95 threshold">
                                            <RampLatencyChart steps={summary.steps} thresholdMs={summary.threshold_ms} />
                                        </Card>
                                    </div>
                                    <Card title="Per-client spread" subtitle="IOPS of every client per step with the slowest–fastest band; points far below the band mark an unfair client">
                                        <RampClientSpreadChart steps={rankedDetailSteps} />
                                    </Card>
                                    {summary.incomplete_steps > 0 && (
                                        <p className="text-sm text-red-700 dark:text-red-400">
                                            Crossed markers in the charts are incomplete steps (a client failed); they are not ranked.
                                        </p>
                                    )}
                                    <Card title="Steps and clients" subtitle="Every uploaded step with its aggregate result and one row per client">
                                        <RampStepTable steps={detail.steps} thresholdMs={summary.threshold_ms} rankedIds={rankedIds} />
                                    </Card>
                                </>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
