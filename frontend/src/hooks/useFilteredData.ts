import { useMemo } from 'react';
import type { TestRun } from '../types';
import type { ActiveFilters } from './useFilterState';

/**
 * Type definition for filter predicate functions
 */
type FilterPredicate = (run: TestRun, filterValues: (string | number)[]) => boolean;

/**
 * Configuration for each filter including the predicate logic
 */
const FILTER_PREDICATES: Record<keyof ActiveFilters, FilterPredicate> = {
    drive_types: (run, values) => values.includes(run.drive_type),
    drive_models: (run, values) => values.includes(run.drive_model),
    patterns: (run, values) => values.includes(run.read_write_pattern),
    block_sizes: (run, values) => values.includes(run.block_size),
    hostnames: (run, values) => run.hostname ? values.includes(run.hostname) : false,
    protocols: (run, values) => run.protocol ? values.includes(run.protocol) : false,
    host_disk_combinations: (run, values) => {
        if (!run.hostname || !run.protocol || !run.drive_model) return false;
        const combo = `${run.hostname} - ${run.protocol} - ${run.drive_model}`;
        return values.includes(combo);
    },
    syncs: (run, values) => run.sync !== undefined ? values.includes(run.sync) : false,
    queue_depths: (run, values) => values.includes(run.queue_depth),
    directs: (run, values) => run.direct !== undefined ? values.includes(run.direct) : false,
    num_jobs: (run, values) => run.num_jobs ? values.includes(run.num_jobs) : false,
    test_sizes: (run, values) => run.test_size ? values.includes(run.test_size) : false,
    durations: (run, values) => values.includes(run.duration),
};

/**
 * Applies a single filter to the test runs array
 * More efficient than nested filtering as it processes all data in one pass
 */
const applyFilter = (
    runs: TestRun[],
    filterType: keyof ActiveFilters,
    filterValues: (string | number)[]
): TestRun[] => {
    if (filterValues.length === 0) {
        return runs; // No filtering needed
    }

    const predicate = FILTER_PREDICATES[filterType];
    return runs.filter(run => predicate(run, filterValues));
};

/**
 * Applies all active filters to the test runs array in sequence
 * Uses early termination if any filter results in empty data
 */
const applyAllFilters = (
    runs: TestRun[],
    activeFilters: ActiveFilters
): TestRun[] => {
    let filtered = runs;

    // Process filters in order, using early termination for performance
    for (const [filterType, filterValues] of Object.entries(activeFilters)) {
        if (filterValues.length > 0) {
            filtered = applyFilter(filtered, filterType as keyof ActiveFilters, filterValues);
            
            // Early termination - if no results left, no need to continue
            if (filtered.length === 0) {
                break;
            }
        }
    }

    return filtered;
};

/**
 * Hook for efficiently filtering test run data
 * Uses optimized filtering logic with early termination and single-pass operations
 */
export const useFilteredData = (
    testRuns: TestRun[],
    activeFilters: ActiveFilters
): TestRun[] => {
    return useMemo(() => {
        // Early return for empty data
        if (testRuns.length === 0) {
            return [];
        }

        // Check if any filters are active
        const hasFilters = Object.values(activeFilters).some(filterArray => filterArray.length > 0);
        
        if (!hasFilters) {
            return testRuns; // No filtering needed
        }

        return applyAllFilters(testRuns, activeFilters);
    }, [testRuns, activeFilters]);
};

/**
 * Hook that provides both filtered data and filter statistics
 * Useful for components that need both the filtered results and metadata
 */
export const useFilteredDataWithStats = (
    testRuns: TestRun[],
    activeFilters: ActiveFilters
) => {
    const filteredRuns = useFilteredData(testRuns, activeFilters);
    
    const stats = useMemo(() => {
        const totalCount = testRuns.length;
        const filteredCount = filteredRuns.length;
        const filterCount = Object.values(activeFilters)
            .reduce((sum, filterArray) => sum + filterArray.length, 0);
        
        return {
            totalCount,
            filteredCount,
            filterCount,
            reductionPercentage: totalCount > 0 ? ((totalCount - filteredCount) / totalCount) * 100 : 0,
            hasFilters: filterCount > 0,
        };
    }, [testRuns.length, filteredRuns.length, activeFilters]);
    
    return {
        filteredRuns,
        stats,
    };
};