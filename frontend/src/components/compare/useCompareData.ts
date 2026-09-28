// Data hooks for the Compare page; each result remembers the request key it belongs to, so "loading" is derived
import { useEffect, useState } from 'react';
import type { ApiResponse } from '../../services/api/base';
import {
    fetchComparison,
    fetchCompareTargets,
    fetchSaturationSummaryFor,
    type CompareResponse,
    type CompareSource,
    type CompareTarget,
} from '../../services/api/compare';
import type { SaturationSummary } from '../../services/api/testRuns';

interface Keyed<T> {
    readonly key: string;
    readonly data: T | null;
    readonly error: string | null;
}

export interface AsyncResult<T> {
    readonly data: T | null;
    readonly error: string | null;
    readonly loading: boolean;
}

const EMPTY: Keyed<never> = { key: '', data: null, error: null };

/** Fetch whenever key changes (null = nothing to fetch); stale responses are dropped via AbortController */
const useKeyedFetch = <T>(key: string | null, load: (key: string, signal: AbortSignal) => Promise<ApiResponse<T>>): AsyncResult<T> => {
    const [result, setResult] = useState<Keyed<T>>(EMPTY);

    useEffect(() => {
        if (key === null) return undefined;
        const controller = new AbortController();
        load(key, controller.signal).then((response) => {
            if (controller.signal.aborted) return;
            setResult({ key, data: response.data ?? null, error: response.error ?? null });
        });
        return () => controller.abort();
    }, [key, load]); // load is a module-level function, so only key changes trigger a request

    if (key === null) return { data: null, error: null, loading: false };
    const current = result.key === key;
    return { data: current ? result.data : null, error: current ? result.error : null, loading: !current };
};

const loadTargets = (source: string, signal: AbortSignal) => fetchCompareTargets(source as CompareSource, signal);

export const useCompareTargets = (source: CompareSource): AsyncResult<{ targets: CompareTarget[] }> => useKeyedFetch(source, loadTargets);

/** queryString: null while fewer than two targets are selected */
export const useComparison = (queryString: string | null): AsyncResult<CompareResponse> => useKeyedFetch(queryString, fetchComparison);

export interface RunSummary {
    readonly data: SaturationSummary | null;
    readonly error: string | null;
    /** true when the run has no stored threshold and the Saturation page default was used */
    readonly defaulted: boolean;
}

/** Same fallback as /api/test-runs/saturation-data for older runs without a stored threshold */
const DEFAULT_THRESHOLD_MS = 100;

const loadSummary = async (run: string, threshold: number | undefined, signal: AbortSignal): Promise<RunSummary> => {
    const first = await fetchSaturationSummaryFor(run, threshold, signal);
    if (first.status !== 400 || threshold !== undefined) return { data: first.data ?? null, error: first.error ?? null, defaulted: false };
    const retry = await fetchSaturationSummaryFor(run, DEFAULT_THRESHOLD_MS, signal);
    return { data: retry.data ?? null, error: retry.error ?? null, defaulted: true };
};

const loadSummaries = async (key: string, signal: AbortSignal): Promise<ApiResponse<Record<string, RunSummary>>> => {
    const [thresholdRaw, ...runs] = key.split(',');
    const threshold = thresholdRaw ? Number(thresholdRaw) : undefined;
    const summaries = await Promise.all(runs.map((run) => loadSummary(run, threshold, signal)));
    return { status: 200, data: Object.fromEntries(runs.map((run, index) => [run, summaries[index]])) };
};

/** Summaries of several saturation runs, one request each; errors are kept per run */
export const useSaturationSummaries = (runs: readonly string[], thresholdMs: number | undefined): AsyncResult<Record<string, RunSummary>> =>
    useKeyedFetch(runs.length > 0 ? [thresholdMs ?? '', ...runs].join(',') : null, loadSummaries);
