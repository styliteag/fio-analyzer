import { useMemo } from 'react';
import type { TestRun } from '../types';

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

/**
 * Type definition for field extractors - functions that extract values from test runs
 */
type FieldExtractor = (run: TestRun) => (string | number | undefined);

/**
 * Configuration for each filter field including extraction logic and processing
 */
const FIELD_CONFIGS: Record<keyof DynamicFilterOptions, {
    extractor: FieldExtractor;
    isNumeric: boolean;
    labelFormatter?: (value: string | number) => string;
}> = {
    drive_types: {
        extractor: (run) => run.drive_type,
        isNumeric: false,
    },
    drive_models: {
        extractor: (run) => run.drive_model,
        isNumeric: false,
    },
    patterns: {
        extractor: (run) => run.read_write_pattern,
        isNumeric: false,
    },
    block_sizes: {
        extractor: (run) => run.block_size,
        isNumeric: false,
    },
    hostnames: {
        extractor: (run) => run.hostname,
        isNumeric: false,
    },
    protocols: {
        extractor: (run) => run.protocol,
        isNumeric: false,
    },
    host_disk_combinations: {
        extractor: (run) => {
            if (!run.hostname || !run.protocol || !run.drive_model) return undefined;
            return `${run.hostname} - ${run.protocol} - ${run.drive_model}`;
        },
        isNumeric: false,
    },
    syncs: {
        extractor: (run) => run.sync,
        isNumeric: true,
    },
    queue_depths: {
        extractor: (run) => run.queue_depth,
        isNumeric: true,
    },
    directs: {
        extractor: (run) => run.direct,
        isNumeric: true,
    },
    num_jobs: {
        extractor: (run) => run.num_jobs,
        isNumeric: true,
    },
    test_sizes: {
        extractor: (run) => run.test_size,
        isNumeric: false,
    },
    durations: {
        extractor: (run) => run.duration,
        isNumeric: true,
        labelFormatter: (value) => `${value}s`,
    },
};

/**
 * Efficiently counts occurrences of values using Map-based approach
 * O(n) complexity instead of O(n²) nested loops
 */
const countOccurrences = (
    runs: TestRun[],
    fieldConfigs: typeof FIELD_CONFIGS
): Record<keyof DynamicFilterOptions, Map<string | number, number>> => {
    const counts: Record<keyof DynamicFilterOptions, Map<string | number, number>> = {} as any;
    
    // Initialize empty Maps for each field
    Object.keys(fieldConfigs).forEach(field => {
        counts[field as keyof DynamicFilterOptions] = new Map();
    });

    // Single pass through runs to count all fields
    runs.forEach(run => {
        Object.entries(fieldConfigs).forEach(([field, config]) => {
            const value = config.extractor(run);
            if (value !== undefined && value !== null) {
                const fieldKey = field as keyof DynamicFilterOptions;
                const currentCount = counts[fieldKey].get(value) || 0;
                counts[fieldKey].set(value, currentCount + 1);
            }
        });
    });

    return counts;
};

/**
 * Converts Map-based counts to sorted FilterOption arrays
 */
const createFilterOptions = (
    allCounts: Map<string | number, number>,
    filteredCounts: Map<string | number, number>,
    config: { isNumeric: boolean; labelFormatter?: (value: string | number) => string }
): FilterOption[] => {
    const options: FilterOption[] = [];
    
    // Create options from all possible values
    allCounts.forEach((_, value) => {
        const filteredCount = filteredCounts.get(value) || 0;
        const processedValue = config.isNumeric && typeof value === 'string' 
            ? parseInt(value) 
            : value;
        
        options.push({
            value: processedValue,
            label: config.labelFormatter ? config.labelFormatter(processedValue) : String(processedValue),
            count: filteredCount,
        });
    });

    // Sort by count descending, then by value ascending
    return options.sort((a, b) => {
        if (b.count !== a.count) {
            return b.count - a.count;
        }
        return String(a.value).localeCompare(String(b.value));
    });
};

/**
 * Hook for calculating dynamic filter options with optimized performance
 * Uses Map-based counting and single-pass algorithms for O(n) complexity
 */
export const useFilterOptions = (
    allRuns: TestRun[],
    filteredRuns: TestRun[]
): DynamicFilterOptions => {
    return useMemo(() => {
        // Early return for empty data
        if (allRuns.length === 0) {
            return Object.keys(FIELD_CONFIGS).reduce((acc, field) => {
                acc[field as keyof DynamicFilterOptions] = [];
                return acc;
            }, {} as DynamicFilterOptions);
        }

        // Count occurrences in both all runs and filtered runs
        const allCounts = countOccurrences(allRuns, FIELD_CONFIGS);
        const filteredCounts = countOccurrences(filteredRuns, FIELD_CONFIGS);

        // Build the result object
        const result: DynamicFilterOptions = {} as DynamicFilterOptions;
        
        Object.entries(FIELD_CONFIGS).forEach(([field, config]) => {
            const fieldKey = field as keyof DynamicFilterOptions;
            result[fieldKey] = createFilterOptions(
                allCounts[fieldKey],
                filteredCounts[fieldKey],
                config
            );
        });

        return result;
    }, [allRuns, filteredRuns]);
};