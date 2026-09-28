import { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, Gauge } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { downloadRunZip } from '../services/api/rawData';
import { PageHeader } from '../components/layout';
import Card from '../components/ui/Card';
import { Loading, ErrorDisplay, EmptyState } from '../components/ui';
import { useUpdateUrlParams, writeValue } from '../hooks/useUrlState';
import { TESTING_SCRIPT_URL } from '../utils/apiDocs';
import SaturationChart from '../components/saturation/SaturationChart';
import { useSaturationRuns, useSaturationRunData } from '../hooks/useSaturationData';
import type { SaturationRun, SaturationData } from '../services/api/testRuns';

/** Format a run for display in the dropdown */
function formatRunLabel(run: SaturationRun): string {
    const date = new Date(run.started).toLocaleDateString();
    const bs = run.block_size ? ` [${run.block_size}]` : '';
    return `${run.drive_model} (${run.protocol}/${run.drive_type})${bs} - ${date} (${run.step_count} steps)`;
}

/** Compute the max IOPS across visible patterns in a SaturationData */
function getMaxIOPS(data: SaturationData | null, hidden?: Set<string>): number {
    if (!data) return 0;
    let max = 0;
    for (const [name, pattern] of Object.entries(data.patterns)) {
        if (hidden?.has(name)) continue;
        for (const step of pattern.steps) {
            if (step.iops != null && step.iops > max) max = step.iops;
        }
    }
    return max;
}

/** Compute the max P95 latency across visible patterns in a SaturationData */
function getMaxLatency(data: SaturationData | null, hidden?: Set<string>): number {
    if (!data) return 0;
    let max = 0;
    for (const [name, pattern] of Object.entries(data.patterns)) {
        if (hidden?.has(name)) continue;
        for (const step of pattern.steps) {
            if (step.p95_latency_ms != null && step.p95_latency_ms > max) max = step.p95_latency_ms;
        }
    }
    return max;
}

/** Use the run from the URL if it belongs to the list, else the first (newest) run */
function pickRun(runs: SaturationRun[], requested: string | null): string | null {
    if (requested && runs.some(r => r.run_uuid === requested)) return requested;
    return runs[0]?.run_uuid ?? null;
}

/** Build a subtitle string for a run's card header */
function buildSubtitle(run: SaturationRun): string {
    const bs = run.block_size ? ` | Block Size: ${run.block_size}` : '';
    return `${run.hostname} - ${run.drive_model} (${run.protocol}/${run.drive_type})${bs}`;
}

export default function Saturation() {
    const { saturationRuns, hostnames, loadingRuns, runsError } = useSaturationRuns();

    // Selection lives in the URL (?host=&run=&chost=&crun=&compare=1) so it survives reloads
    const [searchParams] = useSearchParams();
    const updateParams = useUpdateUrlParams();
    const urlHost = searchParams.get('host');
    const urlRun = searchParams.get('run');
    const compareHost = searchParams.get('chost');
    const urlCompareRun = searchParams.get('crun');
    const showCompare = searchParams.get('compare') === '1';

    // Default to the first host and its newest run until the user picks something
    const selectedHost = urlHost ?? hostnames[0] ?? null;

    // Filter runs by host
    const primaryRuns = useMemo(
        () => (selectedHost ? saturationRuns.filter(r => r.hostname === selectedHost) : []),
        [saturationRuns, selectedHost]
    );
    const compareRuns = useMemo(
        () => (compareHost ? saturationRuns.filter(r => r.hostname === compareHost) : []),
        [saturationRuns, compareHost]
    );

    const selectedRunUuid = pickRun(primaryRuns, urlRun);
    const compareRunUuid = pickRun(compareRuns, urlCompareRun);

    // Hidden patterns per chart (for y-axis rescaling)
    const [primaryHidden, setPrimaryHidden] = useState<Set<string>>(new Set());
    const [compareHidden, setCompareHidden] = useState<Set<string>>(new Set());

    // Fetch data for selected runs
    const { saturationData: primaryData, loading: primaryLoading, error: primaryError } = useSaturationRunData(selectedRunUuid);
    const { saturationData: compareData, loading: compareLoading, error: compareError } = useSaturationRunData(compareRunUuid);

    // Handlers
    const handleHostChange = useCallback((host: string | null) => {
        updateParams((params) => {
            writeValue(params, 'host', host);
            params.delete('run');
        });
        setPrimaryHidden(new Set());
    }, [updateParams]);

    const setSelectedRunUuid = useCallback((run: string | null) => {
        updateParams((params) => writeValue(params, 'run', run));
    }, [updateParams]);

    const handleCompareHostChange = useCallback((host: string | null) => {
        updateParams((params) => {
            writeValue(params, 'chost', host);
            params.delete('crun');
        });
        setCompareHidden(new Set());
    }, [updateParams]);

    const setCompareRunUuid = useCallback((run: string | null) => {
        updateParams((params) => writeValue(params, 'crun', run));
    }, [updateParams]);

    const handleRemoveCompare = useCallback(() => {
        updateParams((params) => ['compare', 'chost', 'crun'].forEach((key) => params.delete(key)));
        setCompareHidden(new Set());
    }, [updateParams]);

    const toast = useToast();
    const handleDownloadRun = useCallback((runUuid: string) => {
        downloadRunZip(runUuid).catch((error: Error) => toast.error(error.message));
    }, [toast]);

    const handleAddCompare = useCallback(() => {
        updateParams((params) => params.set('compare', '1'));
    }, [updateParams]);

    // Synchronized Y-axis scaling (respects hidden patterns)
    const sharedMaxIOPS = useMemo(() => {
        if (!showCompare || !compareRunUuid) return undefined;
        const max = Math.max(getMaxIOPS(primaryData, primaryHidden), getMaxIOPS(compareData, compareHidden));
        return max > 0 ? max : undefined;
    }, [showCompare, compareRunUuid, primaryData, compareData, primaryHidden, compareHidden]);

    const sharedMaxLatency = useMemo(() => {
        if (!showCompare || !compareRunUuid) return undefined;
        const max = Math.max(getMaxLatency(primaryData, primaryHidden), getMaxLatency(compareData, compareHidden));
        return max > 0 ? max : undefined;
    }, [showCompare, compareRunUuid, primaryData, compareData, primaryHidden, compareHidden]);

    // Look up run objects for subtitles
    const primaryRun = useMemo(
        () => saturationRuns.find(r => r.run_uuid === selectedRunUuid) ?? null,
        [saturationRuns, selectedRunUuid]
    );
    const compareRunObj = useMemo(
        () => saturationRuns.find(r => r.run_uuid === compareRunUuid) ?? null,
        [saturationRuns, compareRunUuid]
    );

    // No saturation data at all
    const noData = !loadingRuns && saturationRuns.length === 0;

    return (
        <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
                <PageHeader
                    title="Saturation Analysis"
                    description="Find the queue depth where IOPS stop scaling and P95 latency crosses its threshold."
                />

                {loadingRuns && <Loading />}
                {runsError && (
                    <div className="mb-4">
                        <ErrorDisplay error={runsError} />
                    </div>
                )}

                {noData && !runsError && (
                    <Card className="p-6">
                        <EmptyState
                            icon={<Gauge className="h-12 w-12" />}
                            title="No saturation test data yet"
                            description="A saturation run raises the queue depth step by step until P95 latency exceeds a threshold. Run it on a host with fio-test.sh --saturation; results upload automatically."
                            action={
                                <a href={TESTING_SCRIPT_URL} className="px-4 py-2 rounded-lg text-sm font-medium theme-btn-primary">
                                    Download fio-test.sh
                                </a>
                            }
                        />
                    </Card>
                )}

                {!noData && !loadingRuns && (
                    <>
                        {/* Selection UI */}
                        <div className="mb-6 flex flex-col gap-4">
                            {/* Primary selector */}
                            <div className="flex flex-wrap items-end gap-4">
                                <div>
                                    <label htmlFor="sat-host" className="block text-sm font-medium theme-text-secondary mb-1">Host</label>
                                    <select
                                        id="sat-host"
                                        className="px-3 py-2 border rounded-lg theme-bg-primary theme-text-primary theme-border-primary"
                                        value={selectedHost || ''}
                                        onChange={(e) => handleHostChange(e.target.value || null)}
                                    >
                                        <option value="">-- Select host --</option>
                                        {hostnames.map(h => (
                                            <option key={h} value={h}>{h}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex-1 min-w-[250px]">
                                    <label htmlFor="sat-run" className="block text-sm font-medium theme-text-secondary mb-1">Run</label>
                                    <select
                                        id="sat-run"
                                        className="w-full max-w-xl px-3 py-2 border rounded-lg theme-bg-primary theme-text-primary theme-border-primary"
                                        value={selectedRunUuid || ''}
                                        onChange={(e) => setSelectedRunUuid(e.target.value || null)}
                                        disabled={!selectedHost}
                                    >
                                        <option value="">-- Select a run --</option>
                                        {primaryRuns.map(run => (
                                            <option key={run.run_uuid} value={run.run_uuid}>
                                                {formatRunLabel(run)}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Compare selector */}
                            {showCompare && (
                                <div className="flex flex-wrap items-end gap-4">
                                    <div>
                                        <label htmlFor="sat-compare-host" className="block text-sm font-medium theme-text-secondary mb-1">Compare Host</label>
                                        <select
                                            id="sat-compare-host"
                                            className="px-3 py-2 border rounded-lg theme-bg-primary theme-text-primary theme-border-primary"
                                            value={compareHost || ''}
                                            onChange={(e) => handleCompareHostChange(e.target.value || null)}
                                        >
                                            <option value="">-- Select host --</option>
                                            {hostnames.map(h => (
                                                <option key={h} value={h}>{h}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex-1 min-w-[250px]">
                                        <label htmlFor="sat-compare-run" className="block text-sm font-medium theme-text-secondary mb-1">Compare Run</label>
                                        <select
                                            id="sat-compare-run"
                                            className="w-full max-w-xl px-3 py-2 border rounded-lg theme-bg-primary theme-text-primary theme-border-primary"
                                            value={compareRunUuid || ''}
                                            onChange={(e) => setCompareRunUuid(e.target.value || null)}
                                            disabled={!compareHost}
                                        >
                                            <option value="">-- Select a run --</option>
                                            {compareRuns.map(run => (
                                                <option key={run.run_uuid} value={run.run_uuid}>
                                                    {formatRunLabel(run)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <button
                                        onClick={handleRemoveCompare}
                                        className="px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg border theme-border-primary"
                                        title="Remove comparison"
                                    >
                                        Remove
                                    </button>
                                </div>
                            )}

                            {selectedRunUuid && (
                                <div className="flex flex-wrap gap-2">
                                    {/* Add compare button */}
                                    {!showCompare && (
                                        <button
                                            onClick={handleAddCompare}
                                            className="px-4 py-2 text-sm font-medium theme-text-secondary hover:theme-text-primary hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg border theme-border-primary transition-colors"
                                        >
                                            + Compare with another run
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleDownloadRun(selectedRunUuid)}
                                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium theme-text-secondary hover:theme-text-primary hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg border theme-border-primary transition-colors"
                                        title="All raw fio JSON files of this run as a ZIP"
                                    >
                                        <Download className="h-4 w-4" aria-hidden="true" />
                                        Raw JSON (ZIP)
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Charts */}
                        {showCompare && compareRunUuid ? (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                <Card className="p-6">
                                    {primaryRun && (
                                        <h3 className="text-sm font-semibold theme-text-secondary mb-4">
                                            {buildSubtitle(primaryRun)}
                                        </h3>
                                    )}
                                    <SaturationChart
                                        saturationData={primaryData}
                                        loading={primaryLoading}
                                        error={primaryError}
                                        maxIOPS={sharedMaxIOPS}
                                        maxLatency={sharedMaxLatency}
                                        onHiddenPatternsChange={setPrimaryHidden}
                                    />
                                </Card>
                                <Card className="p-6">
                                    {compareRunObj && (
                                        <h3 className="text-sm font-semibold theme-text-secondary mb-4">
                                            {buildSubtitle(compareRunObj)}
                                        </h3>
                                    )}
                                    <SaturationChart
                                        saturationData={compareData}
                                        loading={compareLoading}
                                        error={compareError}
                                        maxIOPS={sharedMaxIOPS}
                                        maxLatency={sharedMaxLatency}
                                        onHiddenPatternsChange={setCompareHidden}
                                    />
                                </Card>
                            </div>
                        ) : (
                            <Card className="p-6">
                                <SaturationChart
                                    saturationData={primaryData}
                                    loading={primaryLoading}
                                    error={primaryError}
                                />
                            </Card>
                        )}
                    </>
                )}
        </div>
    );
}
