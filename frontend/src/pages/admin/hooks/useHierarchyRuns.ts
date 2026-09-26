// Fetch ALL test runs (paginated) while the hierarchy tab is active
import { useCallback, useEffect, useState } from 'react';
import type { TestRun } from '../../../types';
import { errorMessage, fetchAllTestRunsPaginated } from '../utils';

export interface HierarchyRunsResult {
    runs: TestRun[];
    loading: boolean;
    error: string | null;
    totalFetched: number;
    hasMore: boolean;
    reload: () => void;
}

export const useHierarchyRuns = (enabled: boolean): HierarchyRunsResult => {
    const [runs, setRuns] = useState<TestRun[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [totalFetched, setTotalFetched] = useState(0);
    const [hasMore, setHasMore] = useState(false);

    const reset = useCallback(() => {
        setRuns([]);
        setTotalFetched(0);
        setHasMore(false);
    }, []);

    const reload = useCallback(async () => {
        setLoading(true);
        setError(null);
        reset();
        try {
            const allRuns = await fetchAllTestRunsPaginated((fetched, more) => {
                setTotalFetched(fetched);
                setHasMore(more);
            });
            setRuns(allRuns);
        } catch (err: unknown) {
            setError(errorMessage(err, 'Failed to fetch all test runs'));
        } finally {
            setLoading(false);
        }
    }, [reset]);

    useEffect(() => {
        if (enabled) {
            reload();
        } else {
            // Clear hierarchical data when switching away from hierarchy tab
            reset();
        }
    }, [enabled, reload, reset]);

    return { runs, loading, error, totalFetched, hasMore, reload };
};
