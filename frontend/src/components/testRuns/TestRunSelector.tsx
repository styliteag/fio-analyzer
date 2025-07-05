import React, { useCallback, useEffect, useState } from 'react';
import { fetchFilters } from '../../services/api/testRuns';
import type { FilterOptions, TestRun } from '../../types';
import type { ActiveFilters } from '../../hooks/useTestRunFilters';
import TestRunManager from './TestRunManager';

interface TestRunSelectorProps {
    selectedRuns: TestRun[];
    onSelectionChange: (runs: TestRun[]) => void;
    refreshTrigger?: number;
    // Shared filter state from Dashboard
    testRuns?: TestRun[];
    activeFilters?: ActiveFilters;
    filteredRuns?: TestRun[];
    hasActiveFilters?: boolean;
    onFilterChange?: (filterType: keyof ActiveFilters, values: (string | number)[]) => void;
    loading?: boolean;
}

const TestRunSelector: React.FC<TestRunSelectorProps> = ({
    selectedRuns,
    onSelectionChange,
    refreshTrigger = 0,
    // Shared filter state from Dashboard
    testRuns: propTestRuns = [],
    activeFilters: propActiveFilters,
    filteredRuns: propFilteredRuns = [],
    hasActiveFilters: propHasActiveFilters = false,
    onFilterChange,
    loading: propLoading = false,
}) => {
    const [filters, setFilters] = useState<FilterOptions>({
        drive_types: [],
        drive_models: [],
        patterns: [],
        block_sizes: [],
        hostnames: [],
        protocols: [],
    });
    const [error, setError] = useState<string | null>(null);

    // Use shared filter state if provided, otherwise fall back to local state
    const testRuns = propTestRuns;
    const activeFilters = propActiveFilters || {
        drive_types: [],
        drive_models: [],
        patterns: [],
        block_sizes: [],
        hostnames: [],
        protocols: [],
    };
    const filteredRuns = propFilteredRuns;
    const hasActiveFilters = propHasActiveFilters;
    const updateFilter = onFilterChange || (() => {});
    const loading = propLoading;

    const loadFilters = useCallback(async () => {
        try {
            const result = await fetchFilters();
            if (result.error) {
                setError(result.error);
            } else if (result.data) {
                setFilters(result.data);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load filters');
        }
    }, []);

    useEffect(() => {
        loadFilters();
    }, [loadFilters, refreshTrigger]);

    const handleRefresh = useCallback(() => {
        loadFilters();
    }, [loadFilters]);

    return (
        <TestRunManager
            selectedRuns={selectedRuns}
            onSelectionChange={onSelectionChange}
            testRuns={testRuns}
            activeFilters={activeFilters}
            filteredRuns={filteredRuns}
            hasActiveFilters={hasActiveFilters}
            onFilterChange={updateFilter}
            filters={filters}
            loading={loading}
            error={error}
            onRefresh={handleRefresh}
        />
    );
};

export default TestRunSelector;