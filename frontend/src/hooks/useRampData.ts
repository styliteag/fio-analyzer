// Data hooks for the Client Ramps page: ramp list, one ramp's steps and its summary
import { useEffect, useState } from 'react';
import type { ApiResponse } from '../services/api/base';
import {
    fetchRamp,
    fetchRampSummary,
    fetchRamps,
    type RampDetail,
    type RampListItem,
    type RampSummary,
} from '../services/api/ramp';

interface FetchState<T> {
    readonly data: T | null;
    readonly loading: boolean;
    readonly error: string | null;
}

/** Fetch whenever `key` changes (null = nothing to load); aborts the previous request */
const useFetch = <T>(key: string | null, load: (signal: AbortSignal) => Promise<ApiResponse<T>>): FetchState<T> => {
    const [state, setState] = useState<FetchState<T>>({ data: null, loading: key !== null, error: null });

    useEffect(() => {
        if (key === null) {
            setState({ data: null, loading: false, error: null });
            return;
        }
        const controller = new AbortController();
        setState((previous) => ({ ...previous, loading: true, error: null }));
        load(controller.signal).then((response) => {
            if (controller.signal.aborted) return;
            setState({ data: response.data ?? null, loading: false, error: response.error ?? null });
        });
        return () => controller.abort();
        // `load` is derived from `key`; re-fetching on each render would loop
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    return state;
};

export const useRamps = (): FetchState<RampListItem[]> => useFetch('ramps', fetchRamps);

export const useRampDetail = (rampUuid: string | null): FetchState<RampDetail> =>
    useFetch(rampUuid, (signal) => fetchRamp(rampUuid as string, signal));

export const useRampSummary = (rampUuid: string | null, thresholdMs: number): FetchState<RampSummary> =>
    useFetch(rampUuid ? `${rampUuid}|${thresholdMs}` : null, (signal) => fetchRampSummary(rampUuid as string, thresholdMs, signal));
