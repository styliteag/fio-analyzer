import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { SaturationRun, SaturationData } from '../services/api/testRuns';
import { fetchSaturationRuns, fetchSaturationData } from '../services/api/testRuns';

export interface UseSaturationDataReturn {
    // Run list
    saturationRuns: SaturationRun[];
    loadingRuns: boolean;
    runsError: string | null;
    // Selected run
    selectedRunUuid: string | null;
    setSelectedRunUuid: (uuid: string | null) => void;
    // Run data
    saturationData: SaturationData | null;
    loadingData: boolean;
    dataError: string | null;
}

export const useSaturationData = (hostname?: string | null): UseSaturationDataReturn => {
    const [saturationRuns, setSaturationRuns] = useState<SaturationRun[]>([]);
    const [loadingRuns, setLoadingRuns] = useState(false);
    const [runsError, setRunsError] = useState<string | null>(null);

    const [selectedRunUuid, setSelectedRunUuid] = useState<string | null>(null);
    const [saturationData, setSaturationData] = useState<SaturationData | null>(null);
    const [loadingData, setLoadingData] = useState(false);
    const [dataError, setDataError] = useState<string | null>(null);

    const runsAbortRef = useRef<AbortController | null>(null);
    const dataAbortRef = useRef<AbortController | null>(null);

    // Load saturation runs
    const loadRuns = useCallback(async () => {
        // Cancel previous request
        runsAbortRef.current?.abort();
        const controller = new AbortController();
        runsAbortRef.current = controller;

        setLoadingRuns(true);
        setRunsError(null);

        try {
            const response = await fetchSaturationRuns(hostname || undefined, controller.signal);
            if (controller.signal.aborted) return;

            if (response.data) {
                const runs = response.data;
                // Sort by started date descending
                runs.sort((a, b) => new Date(b.started).getTime() - new Date(a.started).getTime());

                setSaturationRuns(runs);

                // Auto-select first run if none selected
                if (!selectedRunUuid && runs.length > 0) {
                    setSelectedRunUuid(runs[0].run_uuid);
                }
            } else if (response.error) {
                setRunsError(response.error);
            }
        } catch {
            if (controller.signal.aborted) return;
            setRunsError('Failed to load saturation test runs');
        } finally {
            if (!controller.signal.aborted) {
                setLoadingRuns(false);
            }
        }
    }, [hostname, selectedRunUuid]);

    useEffect(() => {
        loadRuns();
        return () => {
            runsAbortRef.current?.abort();
        };
    }, [loadRuns]);

    // Load saturation data when selectedRunUuid changes
    const loadData = useCallback(async () => {
        if (!selectedRunUuid) {
            setSaturationData(null);
            return;
        }

        // Cancel previous request
        dataAbortRef.current?.abort();
        const controller = new AbortController();
        dataAbortRef.current = controller;

        setLoadingData(true);
        setDataError(null);

        try {
            const response = await fetchSaturationData(selectedRunUuid, undefined, controller.signal);
            if (controller.signal.aborted) return;
            if (response.data) {
                setSaturationData(response.data);
            } else if (response.error) {
                setDataError(response.error);
            }
        } catch {
            if (controller.signal.aborted) return;
            setDataError('Failed to load saturation data');
        } finally {
            if (!controller.signal.aborted) {
                setLoadingData(false);
            }
        }
    }, [selectedRunUuid]);

    useEffect(() => {
        loadData();
        return () => {
            dataAbortRef.current?.abort();
        };
    }, [loadData]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            runsAbortRef.current?.abort();
            dataAbortRef.current?.abort();
        };
    }, []);

    return {
        saturationRuns,
        loadingRuns,
        runsError,
        selectedRunUuid,
        setSelectedRunUuid,
        saturationData,
        loadingData,
        dataError,
    };
};

/**
 * Hook that fetches saturation data for a single run_uuid.
 * Used by the Saturation page to load data for primary and comparison runs independently.
 */
export interface UseSaturationRunDataReturn {
    saturationData: SaturationData | null;
    loading: boolean;
    error: string | null;
}

export const useSaturationRunData = (runUuid: string | null): UseSaturationRunDataReturn => {
    const [saturationData, setSaturationData] = useState<SaturationData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    const loadData = useCallback(async () => {
        if (!runUuid) {
            setSaturationData(null);
            return;
        }

        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setLoading(true);
        setError(null);

        try {
            const response = await fetchSaturationData(runUuid, undefined, controller.signal);
            if (controller.signal.aborted) return;
            if (response.data) {
                setSaturationData(response.data);
            } else if (response.error) {
                setError(response.error);
            }
        } catch {
            if (controller.signal.aborted) return;
            setError('Failed to load saturation data');
        } finally {
            if (!controller.signal.aborted) {
                setLoading(false);
            }
        }
    }, [runUuid]);

    useEffect(() => {
        loadData();
        return () => {
            abortRef.current?.abort();
        };
    }, [loadData]);

    return { saturationData, loading, error };
};

/**
 * Hook that fetches the list of all saturation runs (no hostname filter).
 * Derives unique hostnames from the runs list.
 */
export interface UseSaturationRunsReturn {
    saturationRuns: SaturationRun[];
    hostnames: string[];
    loadingRuns: boolean;
    runsError: string | null;
}

export const useSaturationRuns = (): UseSaturationRunsReturn => {
    const [saturationRuns, setSaturationRuns] = useState<SaturationRun[]>([]);
    const [loadingRuns, setLoadingRuns] = useState(false);
    const [runsError, setRunsError] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setLoadingRuns(true);
        setRunsError(null);

        (async () => {
            try {
                const response = await fetchSaturationRuns(undefined, controller.signal);
                if (controller.signal.aborted) return;
                if (response.data) {
                    const runs = response.data;
                    runs.sort((a, b) => new Date(b.started).getTime() - new Date(a.started).getTime());
                    setSaturationRuns(runs);
                } else if (response.error) {
                    setRunsError(response.error);
                }
            } catch {
                if (controller.signal.aborted) return;
                setRunsError('Failed to load saturation test runs');
            } finally {
                if (!controller.signal.aborted) {
                    setLoadingRuns(false);
                }
            }
        })();

        return () => {
            controller.abort();
        };
    }, []);

    const hostnames = useMemo(() => {
        const unique = new Set(saturationRuns.map(r => r.hostname));
        return Array.from(unique).sort();
    }, [saturationRuns]);

    return { saturationRuns, hostnames, loadingRuns, runsError };
};
