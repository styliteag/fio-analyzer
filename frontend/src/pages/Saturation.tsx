import { useState, useMemo, useCallback } from 'react';
import { DashboardHeader, DashboardFooter } from '../components/layout';
import Card from '../components/ui/Card';
import { Loading } from '../components/ui';
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

/** Build a subtitle string for a run's card header */
function buildSubtitle(run: SaturationRun): string {
    const bs = run.block_size ? ` | Block Size: ${run.block_size}` : '';
    return `${run.hostname} - ${run.drive_model} (${run.protocol}/${run.drive_type})${bs}`;
}

export default function Saturation() {
    const { saturationRuns, hostnames, loadingRuns, runsError } = useSaturationRuns();

    // Primary selection
    const [selectedHost, setSelectedHost] = useState<string | null>(null);
    const [selectedRunUuid, setSelectedRunUuid] = useState<string | null>(null);

    // Comparison selection
    const [showCompare, setShowCompare] = useState(false);
    const [compareHost, setCompareHost] = useState<string | null>(null);
    const [compareRunUuid, setCompareRunUuid] = useState<string | null>(null);

    // Filter runs by host
    const primaryRuns = useMemo(
        () => (selectedHost ? saturationRuns.filter(r => r.hostname === selectedHost) : []),
        [saturationRuns, selectedHost]
    );
    const compareRuns = useMemo(
        () => (compareHost ? saturationRuns.filter(r => r.hostname === compareHost) : []),
        [saturationRuns, compareHost]
    );

    // Hidden patterns per chart (for y-axis rescaling)
    const [primaryHidden, setPrimaryHidden] = useState<Set<string>>(new Set());
    const [compareHidden, setCompareHidden] = useState<Set<string>>(new Set());

    // Fetch data for selected runs
    const { saturationData: primaryData, loading: primaryLoading, error: primaryError } = useSaturationRunData(selectedRunUuid);
    const { saturationData: compareData, loading: compareLoading, error: compareError } = useSaturationRunData(compareRunUuid);

    // Auto-select first host and run when runs load
    useMemo(() => {
        if (!selectedHost && hostnames.length > 0) {
            setSelectedHost(hostnames[0]);
        }
    }, [hostnames, selectedHost]);

    useMemo(() => {
        if (selectedHost && !selectedRunUuid && primaryRuns.length > 0) {
            setSelectedRunUuid(primaryRuns[0].run_uuid);
        }
    }, [selectedHost, selectedRunUuid, primaryRuns]);

    // Handlers
    const handleHostChange = useCallback((host: string | null) => {
        setSelectedHost(host);
        setSelectedRunUuid(null);
        setPrimaryHidden(new Set());
    }, []);

    const handleCompareHostChange = useCallback((host: string | null) => {
        setCompareHost(host);
        setCompareRunUuid(null);
        setCompareHidden(new Set());
    }, []);

    const handleRemoveCompare = useCallback(() => {
        setShowCompare(false);
        setCompareHost(null);
        setCompareRunUuid(null);
        setCompareHidden(new Set());
    }, []);

    const handleAddCompare = useCallback(() => {
        setShowCompare(true);
    }, []);

    // Auto-select first compare run when compare host changes
    useMemo(() => {
        if (compareHost && !compareRunUuid && compareRuns.length > 0) {
            setCompareRunUuid(compareRuns[0].run_uuid);
        }
    }, [compareHost, compareRunUuid, compareRuns]);

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
        <div className="min-h-screen theme-bg-secondary transition-colors">
            <DashboardHeader />

            <main className="w-full px-4 sm:px-6 lg:px-8 py-6">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold theme-text-primary mb-2">
                        Saturation Test Analysis
                    </h1>
                    <p className="theme-text-secondary text-lg">
                        Analyze IOPS saturation and P95 latency thresholds across queue depths
                    </p>
                </div>

                {loadingRuns && <Loading />}
                {runsError && <p className="text-red-500 mb-4">{runsError}</p>}

                {noData && (
                    <div className="text-center py-12">
                        <p className="theme-text-secondary text-lg mb-2">No Saturation Test Data</p>
                        <p className="theme-text-secondary text-sm">
                            Run <code>fio-test.sh --saturation</code> to generate data.
                        </p>
                    </div>
                )}

                {!noData && !loadingRuns && (
                    <>
                        {/* Selection UI */}
                        <div className="mb-6 flex flex-col gap-4">
                            {/* Primary selector */}
                            <div className="flex flex-wrap items-end gap-4">
                                <div>
                                    <label className="block text-sm font-medium theme-text-secondary mb-1">Host</label>
                                    <select
                                        aria-label="Select host"
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
                                    <label className="block text-sm font-medium theme-text-secondary mb-1">Run</label>
                                    <select
                                        aria-label="Select saturation run"
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
                                        <label className="block text-sm font-medium theme-text-secondary mb-1">Compare Host</label>
                                        <select
                                            aria-label="Select compare host"
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
                                        <label className="block text-sm font-medium theme-text-secondary mb-1">Compare Run</label>
                                        <select
                                            aria-label="Select compare run"
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

                            {/* Add compare button */}
                            {!showCompare && selectedRunUuid && (
                                <div>
                                    <button
                                        onClick={handleAddCompare}
                                        className="px-4 py-2 text-sm font-medium theme-text-secondary hover:theme-text-primary hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg border theme-border-primary transition-colors"
                                    >
                                        + Compare with another run
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
            </main>

            <DashboardFooter getApiDocsUrl={() => {
                const apiBaseUrl = import.meta.env.VITE_API_URL || '';
                return apiBaseUrl ? `${apiBaseUrl}/api-docs` : '/api-docs';
            }} />
        </div>
    );
}
