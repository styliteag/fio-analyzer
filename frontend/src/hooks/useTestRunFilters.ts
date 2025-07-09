import { useState, useCallback, useMemo } from 'react';
import type { TestRun } from '../types';

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
    host_disk_combinations: FilterOption[];
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
        host_disk_combinations: [],
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

        if (activeFilters.host_disk_combinations.length > 0) {
            filtered = filtered.filter((run) => {
                if (!run.hostname || !run.protocol || !run.drive_model) return false;
                const combo = `${run.hostname} - ${run.protocol} - ${run.drive_model}`;
                return activeFilters.host_disk_combinations.includes(combo);
            });
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

        // Count occurrences for each field in ALL runs (not just filtered)
        const allCounts: Record<string, Record<string | number, number>> = {
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

        // Count occurrences in ALL runs to get all possible values
        testRuns.forEach(run => {
            // Drive types
            if (run.drive_type) {
                allCounts.drive_types[run.drive_type] = (allCounts.drive_types[run.drive_type] || 0) + 1;
            }

            // Drive models
            if (run.drive_model) {
                allCounts.drive_models[run.drive_model] = (allCounts.drive_models[run.drive_model] || 0) + 1;
            }

            // Patterns
            if (run.read_write_pattern) {
                allCounts.patterns[run.read_write_pattern] = (allCounts.patterns[run.read_write_pattern] || 0) + 1;
            }

            // Block sizes
            if (run.block_size) {
                allCounts.block_sizes[run.block_size] = (allCounts.block_sizes[run.block_size] || 0) + 1;
            }

            // Hostnames
            if (run.hostname) {
                allCounts.hostnames[run.hostname] = (allCounts.hostnames[run.hostname] || 0) + 1;
            }

            // Protocols
            if (run.protocol) {
                allCounts.protocols[run.protocol] = (allCounts.protocols[run.protocol] || 0) + 1;
            }

            // Sync
            if (run.sync !== undefined) {
                allCounts.syncs[run.sync] = (allCounts.syncs[run.sync] || 0) + 1;
            }

            // Queue depths
            allCounts.queue_depths[run.queue_depth] = (allCounts.queue_depths[run.queue_depth] || 0) + 1;

            // Direct
            if (run.direct !== undefined) {
                allCounts.directs[run.direct] = (allCounts.directs[run.direct] || 0) + 1;
            }

            // Num jobs
            if (run.num_jobs) {
                allCounts.num_jobs[run.num_jobs] = (allCounts.num_jobs[run.num_jobs] || 0) + 1;
            }

            // Test sizes
            if (run.test_size) {
                allCounts.test_sizes[run.test_size] = (allCounts.test_sizes[run.test_size] || 0) + 1;
            }

            // Durations
            allCounts.durations[run.duration] = (allCounts.durations[run.duration] || 0) + 1;
        });

        // Count occurrences in filtered runs for accurate counts
        const filteredCounts: Record<string, Record<string | number, number>> = {
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

        filteredRuns.forEach(run => {
            // Drive types
            if (run.drive_type) {
                filteredCounts.drive_types[run.drive_type] = (filteredCounts.drive_types[run.drive_type] || 0) + 1;
            }

            // Drive models
            if (run.drive_model) {
                filteredCounts.drive_models[run.drive_model] = (filteredCounts.drive_models[run.drive_model] || 0) + 1;
            }

            // Patterns
            if (run.read_write_pattern) {
                filteredCounts.patterns[run.read_write_pattern] = (filteredCounts.patterns[run.read_write_pattern] || 0) + 1;
            }

            // Block sizes
            if (run.block_size) {
                filteredCounts.block_sizes[run.block_size] = (filteredCounts.block_sizes[run.block_size] || 0) + 1;
            }

            // Hostnames
            if (run.hostname) {
                filteredCounts.hostnames[run.hostname] = (filteredCounts.hostnames[run.hostname] || 0) + 1;
            }

            // Protocols
            if (run.protocol) {
                filteredCounts.protocols[run.protocol] = (filteredCounts.protocols[run.protocol] || 0) + 1;
            }

            // Sync
            if (run.sync !== undefined) {
                filteredCounts.syncs[run.sync] = (filteredCounts.syncs[run.sync] || 0) + 1;
            }

            // Queue depths
            filteredCounts.queue_depths[run.queue_depth] = (filteredCounts.queue_depths[run.queue_depth] || 0) + 1;

            // Direct
            if (run.direct !== undefined) {
                filteredCounts.directs[run.direct] = (filteredCounts.directs[run.direct] || 0) + 1;
            }

            // Num jobs
            if (run.num_jobs) {
                filteredCounts.num_jobs[run.num_jobs] = (filteredCounts.num_jobs[run.num_jobs] || 0) + 1;
            }

            // Test sizes
            if (run.test_size) {
                filteredCounts.test_sizes[run.test_size] = (filteredCounts.test_sizes[run.test_size] || 0) + 1;
            }

            // Durations
            filteredCounts.durations[run.duration] = (filteredCounts.durations[run.duration] || 0) + 1;
        });

        // Convert all counts to filter options, but use filtered counts for the display
        Object.keys(allCounts).forEach(field => {
            const allFieldCounts = allCounts[field];
            const filteredFieldCounts = filteredCounts[field];
            
            options[field as keyof DynamicFilterOptions] = Object.entries(allFieldCounts)
                .map(([value]) => ({
                    value: field === 'queue_depths' || field === 'durations' || field === 'syncs' || field === 'directs' || field === 'num_jobs' 
                        ? parseInt(value) 
                        : value,
                    label: field === 'durations' ? `${value}s` : value,
                    count: filteredFieldCounts[value] || 0 // Use filtered count, 0 if not in filtered results
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
    }, [testRuns, filteredRuns]);

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