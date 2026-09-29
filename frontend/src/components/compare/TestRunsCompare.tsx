// "Test runs" tab: targets and settings live in the URL, the comparison is fetched from /api/compare
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GitCompare, Info } from 'lucide-react';
import { Button, Card, EmptyState, ErrorDisplay, Loading } from '../ui';
import { useUpdateUrlParams, writeList, writeValue } from '../../hooks/useUrlState';
import { buildCompareParams, type CompareMetric } from '../../services/api/compare';
import { SYNC_MODE_ORDER } from '../../utils/syncMode';
import CompareControls, { type CompareSettings } from './CompareControls';
import CompareResults from './CompareResults';
import { METRIC_VALUES, type ConfigFilters } from './compareUtils';
import TargetPicker from './TargetPicker';
import { useCompareTargets, useComparison } from './useCompareData';

const CONFIG_FILTER_KEYS = ['nj', 'qd', 'direct'] as const;

const readSettings = (params: URLSearchParams): CompareSettings => {
    const metric = params.get('metric') as CompareMetric | null;
    return {
        metric: metric && METRIC_VALUES.includes(metric) ? metric : 'iops',
        source: params.get('source') === 'latest' ? 'latest' : 'newest',
        strict: params.get('strict') !== '0',
        syncs: params.getAll('sync').filter((mode) => SYNC_MODE_ORDER.includes(mode)),
        tags: params.get('tags') ?? '',
        since: params.get('since') ?? '',
        until: params.get('until') ?? '',
        includeIncomplete: params.get('incomplete') === '1',
    };
};

const writeSettings = (params: URLSearchParams, changes: Partial<CompareSettings>): void => {
    if (changes.metric !== undefined) writeValue(params, 'metric', changes.metric, 'iops');
    if (changes.source !== undefined) writeValue(params, 'source', changes.source, 'newest');
    if (changes.strict !== undefined) writeValue(params, 'strict', changes.strict ? null : '0');
    if (changes.syncs !== undefined) writeList(params, 'sync', SYNC_MODE_ORDER.filter((mode) => changes.syncs?.includes(mode)));
    if (changes.tags !== undefined) writeValue(params, 'tags', changes.tags);
    if (changes.since !== undefined) writeValue(params, 'since', changes.since);
    if (changes.until !== undefined) writeValue(params, 'until', changes.until);
    if (changes.includeIncomplete !== undefined) writeValue(params, 'incomplete', changes.includeIncomplete ? '1' : null);
};

const TestRunsCompare: React.FC = () => {
    const [searchParams] = useSearchParams();
    const updateParams = useUpdateUrlParams();
    const settings = readSettings(searchParams);
    const selectedKey = searchParams.getAll('t').join('\u0000');
    const selected = useMemo(() => (selectedKey ? selectedKey.split('\u0000') : []), [selectedKey]);
    const filters: ConfigFilters = {
        numJobs: searchParams.get('nj') ?? '',
        iodepth: searchParams.get('qd') ?? '',
        direct: searchParams.get('direct') ?? '',
    };

    const targets = useCompareTargets(settings.source);
    const queryString =
        selected.length >= 2 ? buildCompareParams({ ...settings, targets: selected }).toString() : null;
    const comparison = useComparison(queryString);
    const hasResults = queryString !== null && !comparison.loading && !comparison.error && (comparison.data?.rows.length ?? 0) > 0;

    const changeTargets = (update: (current: readonly string[]) => readonly string[]) =>
        updateParams((params) => {
            writeList(params, 't', update(params.getAll('t')));
            CONFIG_FILTER_KEYS.forEach((key) => params.delete(key)); // values differ per target set
        });
    const changeSettings = (changes: Partial<CompareSettings>) => updateParams((params) => writeSettings(params, changes));
    const changeFilters = (changes: Partial<ConfigFilters>) =>
        updateParams((params) => {
            if (changes.numJobs !== undefined) writeValue(params, 'nj', changes.numJobs);
            if (changes.iodepth !== undefined) writeValue(params, 'qd', changes.iodepth);
            if (changes.direct !== undefined) writeValue(params, 'direct', changes.direct);
        });

    const renderResult = () => {
        if (selected.length < 2) {
            return (
                <EmptyState
                    icon={<GitCompare className="h-12 w-12" />}
                    title="Pick at least two targets"
                    description="The first target is the baseline; every other target is compared against it per test configuration. You can also type a pattern such as ceph-node1|*|*|rbd-pool."
                />
            );
        }
        if (comparison.loading) return <Loading />;
        if (comparison.error) return <ErrorDisplay error={comparison.error} title="Comparison failed" />;
        if (!comparison.data || comparison.data.rows.length === 0) {
            return (
                <EmptyState
                    icon={<GitCompare className="h-12 w-12" />}
                    title="No comparable configurations"
                    description={
                        comparison.data?.hint ??
                        'The targets share no identical test configuration. Turn off strict matching to ignore test size, duration, layout, client count and I/O engine, or include incomplete configurations.'
                    }
                    action={
                        <div className="flex flex-wrap justify-center gap-2">
                            {settings.source === 'latest' && (
                                <Button variant="outline" size="sm" onClick={() => changeSettings({ source: 'newest' })}>Use newest comparable runs</Button>
                            )}
                            {settings.strict && (
                                <Button variant="outline" size="sm" onClick={() => changeSettings({ strict: false })}>Turn strict matching off</Button>
                            )}
                            {!settings.includeIncomplete && (
                                <Button variant="outline" size="sm" onClick={() => changeSettings({ includeIncomplete: true })}>Include incomplete</Button>
                            )}
                        </div>
                    }
                />
            );
        }
        return (
            <>
                {comparison.data.hint && (
                    <p role="status" className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
                        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>
                            {comparison.data.hint}
                            {settings.strict && (
                                <button type="button" className="ml-2 underline" onClick={() => changeSettings({ strict: false })}>
                                    Turn strict matching off
                                </button>
                            )}
                        </span>
                    </p>
                )}
                <CompareResults data={comparison.data} metric={settings.metric} filters={filters} onFiltersChange={changeFilters} />
            </>
        );
    };

    return (
        <div className="flex flex-col gap-6">
            <Card className="p-5 flex flex-col gap-5">
                <TargetPicker targets={targets.data?.targets ?? []} selected={selected} loading={targets.loading} onChange={changeTargets} />
                {targets.error && <ErrorDisplay error={targets.error} title="Could not load targets" size="sm" />}
                <CompareControls settings={settings} onChange={changeSettings} />
            </Card>
            {hasResults ? renderResult() : <Card className="p-5">{renderResult()}</Card>}
        </div>
    );
};

export default TestRunsCompare;
