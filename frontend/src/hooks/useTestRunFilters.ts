import { useState, useCallback, useMemo } from 'react';
import type { TestRun } from '../types';

export interface ActiveFilters {
    drive_types: string[];
    drive_models: string[];
    patterns: string[];
    block_sizes: (string | number)[];
    hostnames: string[];
    protocols: string[];
    syncs: number[];
    queue_depths: number[];
    directs: number[];
    num_jobs: number[];
    test_sizes: string[];
    durations: number[];
}

export interface FilterOption {
    value: string | number;
    label: string;
    count: number;
}

export interface DynamicFilterOptions {
    drive_types: FilterOption[];
    drive_models: FilterOption[];
    patterns: FilterOption[];
    block_sizes: FilterOption[];
    hostnames: FilterOption[];
    protocols: FilterOption[];
    syncs: FilterOption[];
    queue_depths: FilterOption[];
    directs: FilterOption[];
    num_jobs: FilterOption[];
    test_sizes: FilterOption[];
    durations: FilterOption[];
}

export const useTestRunFilters = (testRuns: TestRun[]) => {
    const [activeFilters, setActiveFilters] = useState<ActiveFilters>({
        drive_types: [],
        drive_models: [],
        patterns: [],
        block_sizes: [],
        hostnames: [],
        protocols: [],
        syncs: [],
        queue_depths: [],
        directs: [],
        num_jobs: [],
        test_sizes: [],
        durations: [],
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

        if (activeFilters.syncs.length > 0) {
            filtered = filtered.filter(
                (run) => run.sync !== undefined && activeFilters.syncs.includes(run.sync),
            );
        }

        if (activeFilters.queue_depths.length > 0) {
            filtered = filtered.filter(
                (run) => activeFilters.queue_depths.includes(run.queue_depth),
            );
        }

        if (activeFilters.directs.length > 0) {
            filtered = filtered.filter(
                (run) => run.direct !== undefined && activeFilters.directs.includes(run.direct),
            );
        }

        if (activeFilters.num_jobs.length > 0) {
            filtered = filtered.filter(
                (run) => run.num_jobs && activeFilters.num_jobs.includes(run.num_jobs),
            );
        }

        if (activeFilters.test_sizes.length > 0) {
            filtered = filtered.filter(
                (run) => run.test_size && activeFilters.test_sizes.includes(run.test_size),
            );
        }

        if (activeFilters.durations.length > 0) {
            filtered = filtered.filter(
                (run) => activeFilters.durations.includes(run.duration),
            );
        }

        return filtered;
    }, [testRuns, activeFilters]);

    // Calculate dynamic filter options based on current filtered runs
    const dynamicFilterOptions = useMemo((): DynamicFilterOptions => {
        const options: DynamicFilterOptions = {
            drive_types: [],
            drive_models: [],
            patterns: [],
            block_sizes: [],
            hostnames: [],
            protocols: [],
            syncs: [],
            queue_depths: [],
            directs: [],
            num_jobs: [],
            test_sizes: [],
            durations: [],
        };

        // Count occurrences for each field
        const counts: Record<string, Record<string | number, number>> = {
            drive_types: {},
            drive_models: {},
            patterns: {},
            block_sizes: {},
            hostnames: {},
            protocols: {},
            syncs: {},
            queue_depths: {},
            directs: {},
            num_jobs: {},
            test_sizes: {},
            durations: {},
        };

        // Count occurrences in filtered runs
        filteredRuns.forEach(run => {
            // Drive types
            if (run.drive_type) {
                counts.drive_types[run.drive_type] = (counts.drive_types[run.drive_type] || 0) + 1;
            }

            // Drive models
            if (run.drive_model) {
                counts.drive_models[run.drive_model] = (counts.drive_models[run.drive_model] || 0) + 1;
            }

            // Patterns
            if (run.read_write_pattern) {
                counts.patterns[run.read_write_pattern] = (counts.patterns[run.read_write_pattern] || 0) + 1;
            }

            // Block sizes
            if (run.block_size) {
                counts.block_sizes[run.block_size] = (counts.block_sizes[run.block_size] || 0) + 1;
            }

            // Hostnames
            if (run.hostname) {
                counts.hostnames[run.hostname] = (counts.hostnames[run.hostname] || 0) + 1;
            }

            // Protocols
            if (run.protocol) {
                counts.protocols[run.protocol] = (counts.protocols[run.protocol] || 0) + 1;
            }

            // Sync
            if (run.sync !== undefined) {
                counts.syncs[run.sync] = (counts.syncs[run.sync] || 0) + 1;
            }

            // Queue depths
            counts.queue_depths[run.queue_depth] = (counts.queue_depths[run.queue_depth] || 0) + 1;

            // Direct
            if (run.direct !== undefined) {
                counts.directs[run.direct] = (counts.directs[run.direct] || 0) + 1;
            }

            // Num jobs
            if (run.num_jobs) {
                counts.num_jobs[run.num_jobs] = (counts.num_jobs[run.num_jobs] || 0) + 1;
            }

            // Test sizes
            if (run.test_size) {
                counts.test_sizes[run.test_size] = (counts.test_sizes[run.test_size] || 0) + 1;
            }

            // Durations
            counts.durations[run.duration] = (counts.durations[run.duration] || 0) + 1;
        });

        // Convert counts to filter options
        Object.keys(counts).forEach(field => {
            const fieldCounts = counts[field];
            options[field as keyof DynamicFilterOptions] = Object.entries(fieldCounts)
                .map(([value, count]) => ({
                    value: field === 'queue_depths' || field === 'durations' || field === 'syncs' || field === 'directs' || field === 'num_jobs' 
                        ? parseInt(value) 
                        : value,
                    label: field === 'durations' ? `${value}s` : value,
                    count
                }))
                .sort((a, b) => {
                    // Sort by count descending, then by value
                    if (b.count !== a.count) {
                        return b.count - a.count;
                    }
                    return String(a.value).localeCompare(String(b.value));
                });
        });

        return options;
    }, [filteredRuns]);

    const hasActiveFilters = useCallback(() => {
        return (
            activeFilters.drive_types.length > 0 ||
            activeFilters.drive_models.length > 0 ||
            activeFilters.patterns.length > 0 ||
            activeFilters.block_sizes.length > 0 ||
            activeFilters.hostnames.length > 0 ||
            activeFilters.protocols.length > 0 ||
            activeFilters.syncs.length > 0 ||
            activeFilters.queue_depths.length > 0 ||
            activeFilters.directs.length > 0 ||
            activeFilters.num_jobs.length > 0 ||
            activeFilters.test_sizes.length > 0 ||
            activeFilters.durations.length > 0
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
            syncs: [],
            queue_depths: [],
            directs: [],
            num_jobs: [],
            test_sizes: [],
            durations: [],
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
        dynamicFilterOptions,
        hasActiveFilters,
        clearAllFilters,
        updateFilter,
        setActiveFilters,
    };
};