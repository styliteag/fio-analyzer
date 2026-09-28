// "Saturation" tab: pick 2+ saturation runs (URL: repeated r, threshold) and compare their saturation points
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import Select from 'react-select';
import { Gauge } from 'lucide-react';
import { Card, EmptyState, ErrorDisplay, Loading } from '../ui';
import { getSelectStyles } from '../../hooks/useThemeColors';
import { useSaturationRuns } from '../../hooks/useSaturationData';
import { useUpdateUrlParams, writeList, writeValue } from '../../hooks/useUrlState';
import type { SaturationRun } from '../../services/api/testRuns';
import SaturationCompareTable from './SaturationCompareTable';
import { applySelectAction } from './selectAction';
import { useSaturationSummaries } from './useCompareData';

interface RunOption {
    readonly value: string;
    readonly label: string;
}

/** Same wording as the run picker on the Saturation page */
const formatRunLabel = (run: SaturationRun): string => {
    const date = new Date(run.started).toLocaleDateString();
    const bs = run.block_size ? ` [${run.block_size}]` : '';
    return `${run.drive_model} (${run.protocol}/${run.drive_type})${bs} - ${date} (${run.step_count} steps)`;
};

const groupByHost = (runs: readonly SaturationRun[]) => {
    const hosts = [...new Set(runs.map((run) => run.hostname))].sort();
    return hosts.map((host) => ({
        label: host,
        options: runs.filter((run) => run.hostname === host).map((run) => ({ value: run.run_uuid, label: formatRunLabel(run) })),
    }));
};

const SaturationCompare: React.FC = () => {
    const { saturationRuns, loadingRuns, runsError } = useSaturationRuns();
    const [searchParams] = useSearchParams();
    const selected = searchParams.getAll('r');
    const updateParams = useUpdateUrlParams();
    const thresholdRaw = searchParams.get('threshold') ?? '';
    const thresholdMs = Number(thresholdRaw) > 0 ? Number(thresholdRaw) : undefined;

    const groups = useMemo(() => groupByHost(saturationRuns), [saturationRuns]);
    const byId = useMemo(() => new Map(saturationRuns.map((run) => [run.run_uuid, run])), [saturationRuns]);
    const selectedRuns = selected.map((id) => byId.get(id)).filter((run): run is SaturationRun => run !== undefined);
    const selectedIds = selectedRuns.map((run) => run.run_uuid);
    const summaries = useSaturationSummaries(selectedIds.length >= 2 ? selectedIds : [], thresholdMs);

    const value: RunOption[] = selectedRuns.map((run) => ({ value: run.run_uuid, label: `${run.hostname} · ${formatRunLabel(run)}` }));

    const renderResult = () => {
        if (selectedRuns.length < 2) {
            return (
                <EmptyState
                    icon={<Gauge className="h-12 w-12" />}
                    title="Pick at least two saturation runs"
                    description="Each run's best queue depth within the P95 threshold and the depth where latency crossed it are shown side by side."
                />
            );
        }
        if (summaries.loading) return <Loading />;
        if (summaries.error) return <ErrorDisplay error={summaries.error} />;
        return <SaturationCompareTable runs={selectedRuns} summaries={summaries.data ?? {}} />;
    };

    if (loadingRuns) return <Loading />;
    if (runsError) return <ErrorDisplay error={runsError} />;
    if (saturationRuns.length === 0) {
        return (
            <Card className="p-6">
                <EmptyState icon={<Gauge className="h-12 w-12" />} title="No saturation runs yet" description="Run fio-test.sh --saturation on the hosts you want to compare." />
            </Card>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <Card className="p-5 flex flex-col gap-4 md:flex-row md:items-end">
                <div className="flex-1 min-w-0">
                    <label htmlFor="compare-runs" className="block text-sm font-medium theme-text-primary mb-1">Saturation runs</label>
                    <Select<RunOption, true>
                        inputId="compare-runs"
                        isMulti
                        closeMenuOnSelect={false}
                        options={groups}
                        value={value}
                        onChange={(_, meta) => updateParams((params) => writeList(params, 'r', applySelectAction(params.getAll('r'), meta)))}
                        placeholder="Pick two or more runs…"
                        noOptionsMessage={() => 'No matching run'}
                        className="text-sm"
                        styles={getSelectStyles()}
                    />
                </div>
                <label className="inline-flex items-center gap-2 text-sm theme-text-secondary" title="Empty = the threshold stored with each run">
                    P95 threshold
                    <input
                        key={thresholdRaw}
                        type="number"
                        min="0.01"
                        step="any"
                        defaultValue={thresholdRaw}
                        placeholder="stored"
                        onBlur={(e) => e.target.value !== thresholdRaw && updateParams((params) => writeValue(params, 'threshold', e.target.value))}
                        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                        className="w-24 px-2 py-1.5 border rounded-lg theme-bg-primary theme-text-primary theme-border-primary"
                    />
                    ms
                </label>
            </Card>
            <Card className="p-5">{renderResult()}</Card>
        </div>
    );
};

export default SaturationCompare;
