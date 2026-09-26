// Load saturation runs while the saturation tab is active
import { useCallback, useEffect, useState } from 'react';
import { fetchSaturationRuns } from '../../../services/api/testRuns';
import type { SaturationRun } from '../../../services/api/testRuns';
import { errorMessage } from '../utils';

export interface SaturationRunsResult {
    runs: SaturationRun[];
    loading: boolean;
    error: string | null;
    reload: () => void;
}

export const useSaturationRuns = (enabled: boolean): SaturationRunsResult => {
    const [runs, setRuns] = useState<SaturationRun[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const reload = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await fetchSaturationRuns();
            if (result.error) {
                throw new Error(result.error);
            }
            setRuns(result.data || []);
        } catch (err: unknown) {
            setError(errorMessage(err, 'Failed to fetch saturation runs'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (enabled) {
            reload();
        }
    }, [enabled, reload]);

    return { runs, loading, error, reload };
};
