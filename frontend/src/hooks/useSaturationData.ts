import { useState, useEffect, useCallback } from 'react';
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

    // Get unique hostnames from selected drives
    const hostnames = Array.from(new Set(drives.map(d => d.hostname).filter(Boolean)));

    // Load saturation runs when hostnames change
    const loadRuns = useCallback(async () => {
        if (hostnames.length === 0) {
            setSaturationRuns([]);
            return;
        }

        setLoadingRuns(true);
        setRunsError(null);

        try {
            // Fetch runs for each hostname and merge
            const allRuns: SaturationRun[] = [];
            for (const hostname of hostnames) {
                const response = await fetchSaturationRuns(hostname);
                if (response.data) {
                    allRuns.push(...response.data);
                } else if (response.error) {
                    console.warn(`Failed to load saturation runs for ${hostname}: ${response.error}`);
                }
            }

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
            setRunsError('Failed to load saturation test runs');
        } finally {
            setLoadingRuns(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hostnames.join(',')]);

    useEffect(() => {
        loadRuns();
    }, [loadRuns]);

    // Load saturation data when selectedRunUuid changes
    const loadData = useCallback(async () => {
        if (!selectedRunUuid) {
            setSaturationData(null);
            return;
        }

        setLoadingData(true);
        setDataError(null);

        try {
            const response = await fetchSaturationData(selectedRunUuid);
            if (response.data) {
                setSaturationData(response.data);
            } else if (response.error) {
                setDataError(response.error);
            }
        } catch {
            setDataError('Failed to load saturation data');
        } finally {
            setLoadingData(false);
        }
    }, [selectedRunUuid]);

    useEffect(() => {
        loadData();
    }, [loadData]);

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
