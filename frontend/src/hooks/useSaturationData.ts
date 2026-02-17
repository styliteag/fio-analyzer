import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { SaturationRun, SaturationData } from '../services/api/testRuns';
import { fetchSaturationRuns, fetchSaturationData } from '../services/api/testRuns';
import type { DriveAnalysis } from '../services/api/hostAnalysis';

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

export const useSaturationData = (drives: DriveAnalysis[]): UseSaturationDataReturn => {
    const [saturationRuns, setSaturationRuns] = useState<SaturationRun[]>([]);
    const [loadingRuns, setLoadingRuns] = useState(false);
    const [runsError, setRunsError] = useState<string | null>(null);

    const [selectedRunUuid, setSelectedRunUuid] = useState<string | null>(null);
    const [saturationData, setSaturationData] = useState<SaturationData | null>(null);
    const [loadingData, setLoadingData] = useState(false);
    const [dataError, setDataError] = useState<string | null>(null);

    const runsAbortRef = useRef<AbortController | null>(null);
    const dataAbortRef = useRef<AbortController | null>(null);

    // Stable hostname key to avoid re-renders
    const hostnameKey = useMemo(
        () => Array.from(new Set(drives.map(d => d.hostname).filter(Boolean))).sort().join(','),
        [drives]
    );

    // Load saturation runs when hostnames change
    const loadRuns = useCallback(async () => {
        if (!hostnameKey) {
            setSaturationRuns([]);
            return;
        }

        // Cancel previous request
        runsAbortRef.current?.abort();
        const controller = new AbortController();
        runsAbortRef.current = controller;

        setLoadingRuns(true);
        setRunsError(null);

        try {
            const hostnames = hostnameKey.split(',');
            const allRuns: SaturationRun[] = [];
            for (const hostname of hostnames) {
                const response = await fetchSaturationRuns(hostname, controller.signal);
                if (controller.signal.aborted) return;
                if (response.data) {
                    allRuns.push(...response.data);
                } else if (response.error) {
                    console.warn(`Failed to load saturation runs for ${hostname}: ${response.error}`);
                }
            }

            if (controller.signal.aborted) return;

            // Deduplicate by run_uuid
            const uniqueRuns = Array.from(
                new Map(allRuns.map(r => [r.run_uuid, r])).values()
            );

            // Sort by started date descending
            uniqueRuns.sort((a, b) => new Date(b.started).getTime() - new Date(a.started).getTime());

            setSaturationRuns(uniqueRuns);

            // Auto-select first run if none selected
            if (!selectedRunUuid && uniqueRuns.length > 0) {
                setSelectedRunUuid(uniqueRuns[0].run_uuid);
            }
        } catch {
            if (controller.signal.aborted) return;
            setRunsError('Failed to load saturation test runs');
        } finally {
            if (!controller.signal.aborted) {
                setLoadingRuns(false);
            }
        }
    }, [hostnameKey, selectedRunUuid]);

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
