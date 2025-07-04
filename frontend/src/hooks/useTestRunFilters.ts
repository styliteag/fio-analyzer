import { useState, useCallback, useMemo } from 'react';
import type { TestRun } from '../types';

export interface ActiveFilters {
    drive_types: string[];
    drive_models: string[];
    patterns: string[];
    block_sizes: (string | number)[];
    hostnames: string[];
    protocols: string[];
}

export const useTestRunFilters = (testRuns: TestRun[]) => {
    const [activeFilters, setActiveFilters] = useState<ActiveFilters>({
        drive_types: [],
        drive_models: [],
        patterns: [],
        block_sizes: [],
        hostnames: [],
        protocols: [],
    });

    const filteredRuns = useMemo(() => {
        let filtered = testRuns;

        if (activeFilters.drive_types.length > 0) {
            filtered = filtered.filter((run) =>
                activeFilters.drive_types.includes(run.drive_type),
            );
        }

        if (activeFilters.drive_models.length > 0) {
            filtered = filtered.filter((run) =>
                activeFilters.drive_models.includes(run.drive_model),
            );
        }

        if (activeFilters.patterns.length > 0) {
            filtered = filtered.filter((run) =>
                activeFilters.patterns.includes(run.read_write_pattern),
            );
        }

        if (activeFilters.block_sizes.length > 0) {
            filtered = filtered.filter((run) =>
                activeFilters.block_sizes.includes(run.block_size),
            );
        }

        if (activeFilters.hostnames.length > 0) {
            filtered = filtered.filter(
                (run) => run.hostname && activeFilters.hostnames.includes(run.hostname),
            );
        }

        if (activeFilters.protocols.length > 0) {
            filtered = filtered.filter(
                (run) => run.protocol && activeFilters.protocols.includes(run.protocol),
            );
        }

        return filtered;
    }, [testRuns, activeFilters]);

    const hasActiveFilters = useCallback(() => {
        return (
            activeFilters.drive_types.length > 0 ||
            activeFilters.drive_models.length > 0 ||
            activeFilters.patterns.length > 0 ||
            activeFilters.block_sizes.length > 0 ||
            activeFilters.hostnames.length > 0 ||
            activeFilters.protocols.length > 0
        );
    }, [activeFilters]);

    const clearAllFilters = useCallback(() => {
        setActiveFilters({
            drive_types: [],
            drive_models: [],
            patterns: [],
            block_sizes: [],
            hostnames: [],
            protocols: [],
        });
    }, []);

    const updateFilter = useCallback((
        filterType: keyof ActiveFilters,
        values: (string | number)[]
    ) => {
        setActiveFilters(prev => ({
            ...prev,
            [filterType]: values,
        }));
    }, []);

    return {
        activeFilters,
        filteredRuns,
        hasActiveFilters,
        clearAllFilters,
        updateFilter,
        setActiveFilters,
    };
};