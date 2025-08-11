import type { TestRun } from '../types';
import { useFilterState } from './useFilterState';
import { useFilterOptions } from './useFilterOptions';
import { useFilteredData } from './useFilteredData';

// Re-export types for backward compatibility
export type { ActiveFilters } from './useFilterState';
export type { FilterOption, DynamicFilterOptions } from './useFilterOptions';

/**
 * Main hook for test run filtering functionality
 * Composed from smaller, focused hooks for better performance and maintainability
 * 
 * This hook maintains backward compatibility with the original API while providing
 * significant performance improvements through:
 * - Map-based counting instead of nested loops (O(n) vs O(n²))
 * - Optimized filtering with early termination
 * - Proper memoization with correct dependencies
 * - Separation of concerns into focused hooks
 */
export const useTestRunFilters = (testRuns: TestRun[]) => {
    // Filter state management
    const {
        activeFilters,
        setActiveFilters,
        hasActiveFilters,
        clearAllFilters,
        updateFilter,
        clearFilter,
        addToFilter,
        removeFromFilter,
        toggleFilterValue,
    } = useFilterState();

    // Apply filters to get filtered data
    const filteredRuns = useFilteredData(testRuns, activeFilters);

    // Calculate dynamic filter options with counts
    const dynamicFilterOptions = useFilterOptions(testRuns, filteredRuns);

    return {
        // Core data
        activeFilters,
        filteredRuns,
        dynamicFilterOptions,

        // State management (backward compatible)
        setActiveFilters,
        hasActiveFilters,
        clearAllFilters,
        updateFilter,

        // Additional utilities (new)
        clearFilter,
        addToFilter,
        removeFromFilter,
        toggleFilterValue,
    };
};