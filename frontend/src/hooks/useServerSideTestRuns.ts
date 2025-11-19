// Hook for server-side test run filtering with debouncing
import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchTestRuns, convertActiveFiltersToOptions, fetchFilters, extractTestRuns } from '../services/api';
import type { TestRun, FilterOptions } from '../types';
import type { ActiveFilters } from './useTestRunFilters';

export interface UseServerSideTestRunsOptions {
    debounceMs?: number;
    autoFetch?: boolean;
    limit?: number; // Maximum number of test runs to fetch
}

export interface UseServerSideTestRunsResult {
    testRuns: TestRun[];
    filters: FilterOptions | null;
    loading: boolean;
    error: string | null;
    activeFilters: ActiveFilters;
    setActiveFilters: (filters: ActiveFilters) => void;
    clearFilters: () => void;
    refetch: () => Promise<void>;
    hasActiveFilters: boolean;
}

const DEFAULT_FILTERS: ActiveFilters = {
    drive_types: [],
    drive_models: [],
    patterns: [],
    block_sizes: [],
    hostnames: [],
    protocols: [],
    host_disk_combinations: [],
    syncs: [],
    queue_depths: [],
    directs: [],
    num_jobs: [],
    test_sizes: [],
    durations: [],
};

export const useServerSideTestRuns = (
    options: UseServerSideTestRunsOptions = {}
): UseServerSideTestRunsResult => {
    const { 
        debounceMs = 300,
        autoFetch = true,
        limit
    } = options;

    const [testRuns, setTestRuns] = useState<TestRun[]>([]);
    const [filters, setFilters] = useState<FilterOptions | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeFilters, setActiveFilters] = useState<ActiveFilters>(DEFAULT_FILTERS);
    const [debouncedFilters, setDebouncedFilters] = useState<ActiveFilters>(DEFAULT_FILTERS);

    // Debounce filter changes to avoid excessive API calls
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedFilters(activeFilters);
        }, debounceMs);

        return () => clearTimeout(timer);
    }, [activeFilters, debounceMs]);

    // Check if any filters are active
    const hasActiveFilters = useMemo(() => {
        return Object.values(activeFilters).some(filterArray => filterArray.length > 0);
    }, [activeFilters]);

    // Fetch test runs with current filters
    const fetchTestRunsData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const fetchOptions = convertActiveFiltersToOptions(debouncedFilters);
            // Add limit if provided
            if (limit !== undefined) {
                fetchOptions.limit = limit;
            }
            const response = await fetchTestRuns(fetchOptions);
            
            if (response.data) {
                const runs = extractTestRuns(response.data);
                setTestRuns(runs);
            } else {
                throw new Error(response.error || 'Failed to fetch test runs');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to fetch test runs');
            console.error('Error fetching test runs:', err);
        } finally {
            setLoading(false);
        }
    }, [debouncedFilters, limit]);

    // Fetch filter options
    const fetchFiltersData = useCallback(async () => {
        try {
            const response = await fetchFilters();
            if (response.data) {
                setFilters(response.data);
            } else {
                throw new Error(response.error || 'Failed to fetch filters');
            }
        } catch (err: any) {
            console.error('Error fetching filters:', err);
            // Don't set error for filters since it's not critical
        }
    }, []);

    // Refetch both test runs and filters
    const refetch = useCallback(async () => {
        await Promise.all([
            fetchTestRunsData(),
            fetchFiltersData(),
        ]);
    }, [fetchTestRunsData, fetchFiltersData]);

    // Clear all filters
    const clearFilters = useCallback(() => {
        setActiveFilters(DEFAULT_FILTERS);
    }, []);

    // Auto-fetch on mount and when debounced filters change
    useEffect(() => {
        if (autoFetch) {
            fetchTestRunsData();
        }
    }, [autoFetch, fetchTestRunsData]);

    // Fetch filters on mount
    useEffect(() => {
        if (autoFetch) {
            fetchFiltersData();
        }
    }, [autoFetch, fetchFiltersData]);

    return {
        testRuns,
        filters,
        loading,
        error,
        activeFilters,
        setActiveFilters,
        clearFilters,
        refetch,
        hasActiveFilters,
    };
};