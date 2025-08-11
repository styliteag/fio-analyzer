import { useState, useCallback } from 'react';

export interface ActiveFilters {
    drive_types: string[];
    drive_models: string[];
    patterns: string[];
    block_sizes: (string | number)[];
    hostnames: string[];
    protocols: string[];
    host_disk_combinations: string[];
    syncs: number[];
    queue_depths: number[];
    directs: number[];
    num_jobs: number[];
    test_sizes: string[];
    durations: number[];
}

/**
 * Creates an empty filter state with all arrays initialized to empty
 */
const createEmptyFilters = (): ActiveFilters => ({
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
});

/**
 * Hook for managing filter state with optimized operations
 * Handles state management, updates, and reset functionality
 */
export const useFilterState = () => {
    const [activeFilters, setActiveFilters] = useState<ActiveFilters>(createEmptyFilters);

    /**
     * Checks if any filters are currently active
     * Uses Object.values for more efficient checking than manual enumeration
     */
    const hasActiveFilters = useCallback((): boolean => {
        return Object.values(activeFilters).some(filterArray => filterArray.length > 0);
    }, [activeFilters]);

    /**
     * Clears all active filters by resetting to empty state
     * More efficient than manually setting each property
     */
    const clearAllFilters = useCallback(() => {
        setActiveFilters(createEmptyFilters());
    }, []);

    /**
     * Updates a specific filter with new values
     * Type-safe with proper key constraints
     */
    const updateFilter = useCallback((
        filterType: keyof ActiveFilters,
        values: (string | number)[]
    ) => {
        setActiveFilters(prev => ({
            ...prev,
            [filterType]: values,
        }));
    }, []);

    /**
     * Resets a specific filter to empty array
     */
    const clearFilter = useCallback((filterType: keyof ActiveFilters) => {
        setActiveFilters(prev => ({
            ...prev,
            [filterType]: [],
        }));
    }, []);

    /**
     * Adds a value to a specific filter if not already present
     */
    const addToFilter = useCallback((
        filterType: keyof ActiveFilters,
        value: string | number
    ) => {
        setActiveFilters(prev => {
            const currentValues = prev[filterType];
            if ((currentValues as (string | number)[]).includes(value)) {
                return prev; // No change needed
            }
            return {
                ...prev,
                [filterType]: [...currentValues, value],
            };
        });
    }, []);

    /**
     * Removes a value from a specific filter
     */
    const removeFromFilter = useCallback((
        filterType: keyof ActiveFilters,
        value: string | number
    ) => {
        setActiveFilters(prev => ({
            ...prev,
            [filterType]: (prev[filterType] as (string | number)[]).filter(v => v !== value),
        }));
    }, []);

    /**
     * Toggles a value in a specific filter (add if not present, remove if present)
     */
    const toggleFilterValue = useCallback((
        filterType: keyof ActiveFilters,
        value: string | number
    ) => {
        setActiveFilters(prev => {
            const currentValues = prev[filterType] as (string | number)[];
            const isPresent = currentValues.includes(value);
            
            return {
                ...prev,
                [filterType]: isPresent
                    ? currentValues.filter(v => v !== value)
                    : [...currentValues, value],
            };
        });
    }, []);

    return {
        activeFilters,
        setActiveFilters,
        hasActiveFilters,
        clearAllFilters,
        updateFilter,
        clearFilter,
        addToFilter,
        removeFromFilter,
        toggleFilterValue,
    };
};