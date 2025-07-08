// Custom hook for test run operations
import { useState, useEffect, useCallback } from 'react';
import { fetchTestRuns, fetchTestRun, updateTestRun, deleteTestRun, deleteTestRuns, bulkUpdateTestRuns, fetchFilters } from '../../services/api';
import type { TestRun, FilterOptions } from '../../types';
import type { TestRunUpdateData } from '../../services/api/testRuns';

export interface UseTestRunsResult {
    testRuns: TestRun[];
    filters: FilterOptions | null;
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
    refreshTestRuns: () => Promise<void>;
    updateTestRun: (id: number, updates: TestRunUpdateData) => Promise<boolean>;
    bulkUpdateTestRuns: (ids: number[], updates: TestRunUpdateData) => Promise<boolean>;
    deleteTestRunData: (id: number) => Promise<boolean>;
    bulkDeleteTestRuns: (ids: number[]) => Promise<{successful: number, failed: number, total: number}>;
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
            
            const response = await fetchTestRuns();
            if (response.data) {
                setTestRuns(response.data);
            } else {
                throw new Error(response.error || 'Failed to fetch test runs');
            }
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
    }, [includeFilters]);

    const refetch = useCallback(async () => {
        await Promise.all([
            fetchTestRunsData(),
            fetchFiltersData(),
        ]);
    }, [fetchTestRunsData, fetchFiltersData]);

    const updateTestRunData = useCallback(async (id: number, updates: TestRunUpdateData): Promise<boolean> => {
        try {
            setError(null);
            const response = await updateTestRun(id, updates);

            // Throw if backend returned an error so calling components can handle it
            if (response.error) {
                throw new Error(response.error);
            }

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
            throw err;
        }
    }, []);

    const bulkUpdateTestRunData = useCallback(async (ids: number[], updates: TestRunUpdateData): Promise<boolean> => {
        try {
            setError(null);
            const response = await bulkUpdateTestRuns(ids, updates);

            // Throw if backend returned an error so calling components can handle it
            if (response.error) {
                throw new Error(response.error);
            }
            
            // Update local state optimistically
            setTestRuns(prevRuns => 
                prevRuns.map(run => 
                    ids.includes(run.id) ? { ...run, ...updates } : run
                )
            );
            
            return true;
        } catch (err: any) {
            setError(err.message || 'Failed to bulk update test runs');
            console.error('Error bulk updating test runs:', err);
            throw err;
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

    const bulkDeleteTestRunData = useCallback(async (ids: number[]) => {
        try {
            setError(null);
            const result = await deleteTestRuns(ids);
            
            // Update local state - remove successfully deleted test runs
            if (result.successful > 0) {
                setTestRuns(prevRuns => prevRuns.filter(run => !ids.includes(run.id)));
            }
            
            return result;
        } catch (err: any) {
            setError(err.message || 'Failed to delete test runs');
            console.error('Error bulk deleting test runs:', err);
            return { successful: 0, failed: ids.length, total: ids.length };
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
        refreshTestRuns: fetchTestRunsData,
        updateTestRun: updateTestRunData,
        bulkUpdateTestRuns: bulkUpdateTestRunData,
        deleteTestRunData,
        bulkDeleteTestRuns: bulkDeleteTestRunData,
        refreshFilters,
    };
};

// Hook for individual test run operations
export const useTestRun = (id: number) => {
    const [testRun, setTestRun] = useState<TestRun | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchTestRunData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            
            const response = await fetchTestRun(id);
            if (response.data) {
                setTestRun(response.data);
            } else {
                throw new Error(response.error || 'Failed to fetch test run');
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
        fetchTestRunData();
    }, [fetchTestRunData]);

    return {
        testRun,
        loading,
        error,
        refetch: fetchTestRunData,
        update: updateTestRunData,
        delete: deleteTestRunData,
    };
};