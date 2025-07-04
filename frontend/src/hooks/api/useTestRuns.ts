// Custom hook for test run operations
import { useState, useEffect, useCallback } from 'react';
import { fetchTestRuns, updateTestRun, deleteTestRun, fetchFilters } from '../../services/api';
import type { TestRun, FilterOptions } from '../../types';

export interface UseTestRunsResult {
    testRuns: TestRun[];
    filters: FilterOptions | null;
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
    updateTestRunData: (id: number, updates: Partial<TestRun>) => Promise<boolean>;
    deleteTestRunData: (id: number) => Promise<boolean>;
    refreshFilters: () => Promise<void>;
}

export interface UseTestRunsOptions {
    autoFetch?: boolean;
    includeFilters?: boolean;
}

export const useTestRuns = (options: UseTestRunsOptions = {}): UseTestRunsResult => {
    const { autoFetch = true, includeFilters = true } = options;
    
    const [testRuns, setTestRuns] = useState<TestRun[]>([]);
    const [filters, setFilters] = useState<FilterOptions | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchTestRunsData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            
            const data = await fetchTestRuns();
            setTestRuns(data);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch test runs');
            console.error('Error fetching test runs:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchFiltersData = useCallback(async () => {
        if (!includeFilters) return;
        
        try {
            const filtersData = await fetchFilters();
            setFilters(filtersData);
        } catch (err: any) {
            console.error('Error fetching filters:', err);
            // Don't set error for filters since it's not critical
        }
    }, [includeFilters]);

    const refetch = useCallback(async () => {
        await Promise.all([
            fetchTestRunsData(),
            fetchFiltersData(),
        ]);
    }, [fetchTestRunsData, fetchFiltersData]);

    const updateTestRunData = useCallback(async (id: number, updates: Partial<TestRun>): Promise<boolean> => {
        try {
            setError(null);
            await updateTestRun(id, updates);
            
            // Update local state optimistically
            setTestRuns(prevRuns => 
                prevRuns.map(run => 
                    run.id === id ? { ...run, ...updates } : run
                )
            );
            
            return true;
        } catch (err: any) {
            setError(err.message || 'Failed to update test run');
            console.error('Error updating test run:', err);
            return false;
        }
    }, []);

    const deleteTestRunData = useCallback(async (id: number): Promise<boolean> => {
        try {
            setError(null);
            await deleteTestRun(id);
            
            // Update local state
            setTestRuns(prevRuns => prevRuns.filter(run => run.id !== id));
            
            return true;
        } catch (err: any) {
            setError(err.message || 'Failed to delete test run');
            console.error('Error deleting test run:', err);
            return false;
        }
    }, []);

    const refreshFilters = useCallback(async () => {
        await fetchFiltersData();
    }, [fetchFiltersData]);

    // Auto-fetch on mount if enabled
    useEffect(() => {
        if (autoFetch) {
            refetch();
        }
    }, [autoFetch, refetch]);

    return {
        testRuns,
        filters,
        loading,
        error,
        refetch,
        updateTestRunData,
        deleteTestRunData,
        refreshFilters,
    };
};

// Hook for individual test run operations
export const useTestRun = (id: number) => {
    const [testRun, setTestRun] = useState<TestRun | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchTestRun = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            
            const testRuns = await fetchTestRuns();
            const foundRun = testRuns.find(run => run.id === id);
            
            if (foundRun) {
                setTestRun(foundRun);
            } else {
                setError('Test run not found');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to fetch test run');
            console.error('Error fetching test run:', err);
        } finally {
            setLoading(false);
        }
    }, [id]);

    const updateTestRunData = useCallback(async (updates: Partial<TestRun>): Promise<boolean> => {
        try {
            setError(null);
            await updateTestRun(id, updates);
            
            // Update local state
            setTestRun(prev => prev ? { ...prev, ...updates } : null);
            
            return true;
        } catch (err: any) {
            setError(err.message || 'Failed to update test run');
            console.error('Error updating test run:', err);
            return false;
        }
    }, [id]);

    const deleteTestRunData = useCallback(async (): Promise<boolean> => {
        try {
            setError(null);
            await deleteTestRun(id);
            setTestRun(null);
            return true;
        } catch (err: any) {
            setError(err.message || 'Failed to delete test run');
            console.error('Error deleting test run:', err);
            return false;
        }
    }, [id]);

    useEffect(() => {
        fetchTestRun();
    }, [fetchTestRun]);

    return {
        testRun,
        loading,
        error,
        refetch: fetchTestRun,
        update: updateTestRunData,
        delete: deleteTestRunData,
    };
};