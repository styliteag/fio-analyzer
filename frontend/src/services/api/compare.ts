// Compare API: storage combinations side by side, plus the saturation summary without a forced threshold
import { getErrorMessage } from '../../types/api';
import { authenticatedFetch, type ApiResponse } from './base';
import type { SaturationSummary } from './testRuns';

export type CompareMetric = 'iops' | 'bandwidth' | 'avg_latency' | 'p95_latency' | 'p99_latency';
export type CompareSource = 'latest' | 'history';

export interface CompareTarget {
    readonly hostname: string;
    readonly protocol: string | null;
    readonly drive_type: string | null;
    readonly drive_model: string | null;
    readonly target: string;
    readonly test_runs: number;
    readonly last_run: string | null;
}

export interface CompareCell {
    readonly iops: number | null;
    readonly bandwidth: number | null;
    readonly avg_latency: number | null;
    readonly p95_latency: number | null;
    readonly p99_latency: number | null;
    readonly timestamp: string | null;
    readonly rows_merged: number;
    readonly test_size: string | null;
    readonly duration: number | null;
    readonly layout: string;
}

export type MetricValues<T> = Readonly<Record<CompareMetric, T>>;

export interface CompareRow {
    readonly read_write_pattern: string;
    readonly block_size: string;
    readonly sync: string | null;
    readonly direct: number | null;
    readonly num_jobs: number | null;
    readonly iodepth: number | null;
    readonly test_size?: string | null;
    readonly duration?: number | null;
    readonly layout?: string;
    readonly mismatch?: readonly string[];
    readonly results: Readonly<Record<string, CompareCell | null>>;
    readonly diff_pct: Readonly<Record<string, MetricValues<number | null>>>;
    readonly better: Readonly<Record<string, MetricValues<boolean | null>>>;
}

export interface CompareTargetSummary {
    readonly configs_compared: number;
    readonly configs_mismatched: number;
    readonly median_diff_pct: MetricValues<number | null>;
}

export interface CompareResponse {
    readonly baseline: string;
    readonly targets: readonly string[];
    readonly strict: boolean;
    readonly rows: readonly CompareRow[];
    readonly summary: Readonly<Record<string, CompareTargetSummary>>;
}

export interface CompareQuery {
    readonly targets: readonly string[];
    readonly source: CompareSource;
    readonly strict: boolean;
    readonly syncs: readonly string[];
    readonly tags: string;
    readonly since: string;
    readonly until: string;
    readonly includeIncomplete: boolean;
}

/** GET returning JSON; on failure the backend's {"detail"} / {"error"} message instead of the bare status text */
const getJson = async <T>(endpoint: string, signal?: AbortSignal): Promise<ApiResponse<T>> => {
    try {
        const response = await authenticatedFetch(endpoint, { signal });
        const body = await response.json().catch(() => null);
        if (!response.ok) {
            const message = body && (typeof body.detail === 'string' ? body.detail : typeof body.error === 'string' ? body.error : null);
            return { status: response.status, error: message ?? `API Error: ${response.status} ${response.statusText}` };
        }
        return { status: response.status, data: body as T };
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return { status: 0, error: 'Request cancelled' };
        return { status: 500, error: getErrorMessage(error) };
    }
};

export const fetchCompareTargets = (source: CompareSource, signal?: AbortSignal) =>
    getJson<{ targets: CompareTarget[] }>(`/api/compare/targets?source=${source}`, signal);

export const buildCompareParams = (query: CompareQuery): URLSearchParams => {
    const params = new URLSearchParams();
    query.targets.forEach((target) => params.append('target', target));
    params.set('source', query.source);
    params.set('strict', String(query.strict));
    if (query.syncs.length > 0) params.set('syncs', query.syncs.join(','));
    if (query.tags.trim()) params.set('tags', query.tags.trim());
    if (query.since) params.set('since', query.since);
    if (query.until) params.set('until', query.until);
    if (query.includeIncomplete) params.set('include_incomplete', 'true');
    return params;
};

/** queryString from buildCompareParams(...).toString() */
export const fetchComparison = (queryString: string, signal?: AbortSignal) =>
    getJson<CompareResponse>(`/api/compare?${queryString}`, signal);

/** Summary with the stored threshold unless thresholdMs is given (older runs without one answer 400) */
export const fetchSaturationSummaryFor = (runUuid: string, thresholdMs?: number, signal?: AbortSignal) => {
    const query = thresholdMs !== undefined ? `?threshold_ms=${thresholdMs}` : '';
    return getJson<SaturationSummary>(`/api/saturation/runs/${encodeURIComponent(runUuid)}/summary${query}`, signal);
};
