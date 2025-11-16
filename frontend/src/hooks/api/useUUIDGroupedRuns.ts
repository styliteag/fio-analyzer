import { useState, useEffect, useCallback, useRef } from 'react';
import type { UUIDGroup } from '../../types';
import { fetchTestRunsGroupedByUUID } from '../../services/api/testRuns';

export interface UseUUIDGroupedRunsOptions {
	groupBy: 'config_uuid' | 'run_uuid';
	enabled?: boolean;
}

export interface UseUUIDGroupedRunsReturn {
	data: UUIDGroup[];
	loading: boolean;
	error: Error | null;
	refresh: () => void;
}

/**
 * Hook to fetch and manage UUID-grouped test runs
 *
 * @param options - Configuration for UUID grouping
 * @returns UUID groups with statistics and refresh function
 */
export const useUUIDGroupedRuns = ({
	groupBy,
	enabled = true,
}: UseUUIDGroupedRunsOptions): UseUUIDGroupedRunsReturn => {
	const [data, setData] = useState<UUIDGroup[]>([]);
	const [loading, setLoading] = useState<boolean>(true);
	const [error, setError] = useState<Error | null>(null);

	// AbortController for canceling requests
	const abortControllerRef = useRef<AbortController | null>(null);

	const fetchData = useCallback(async () => {
		if (!enabled) {
			setLoading(false);
			return;
		}

		// Cancel previous request if it exists
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
		}

		// Create new AbortController for this request
		abortControllerRef.current = new AbortController();

		setLoading(true);
		setError(null);

		try {
			const result = await fetchTestRunsGroupedByUUID(
				groupBy,
				abortControllerRef.current.signal
			);

			// Extract data from ApiResponse wrapper
			if (result.error) {
				setError(new Error(result.error));
				setData([]);
			} else {
				setData(result.data || []);
				setError(null);
			}
		} catch (err) {
			// Don't set error state if request was aborted
			if (err instanceof Error && err.name !== 'AbortError') {
				setError(err);
				console.error('Error fetching UUID-grouped test runs:', err);
			}
		} finally {
			setLoading(false);
		}
	}, [groupBy, enabled]);

	// Initial fetch
	useEffect(() => {
		fetchData();

		// Cleanup: abort request when component unmounts or dependencies change
		return () => {
			if (abortControllerRef.current) {
				abortControllerRef.current.abort();
			}
		};
	}, [fetchData]);

	// Refresh function for manual refresh
	const refresh = useCallback(() => {
		fetchData();
	}, [fetchData]);

	return {
		data,
		loading,
		error,
		refresh,
	};
};
