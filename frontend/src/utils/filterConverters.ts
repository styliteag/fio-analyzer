import type { ActiveFilters } from '../hooks/useTestRunFilters';

// Define TimeSeriesFilters interface locally since the component was removed
export interface TimeSeriesFilters {
    hostnames: string[];
    protocols: string[];
    drive_models: string[];
    drive_types: string[];
    block_sizes: string[];
    patterns: string[];
    queue_depths: number[];
    syncs: number[];
    directs: number[];
    num_jobs: number[];
    test_sizes: string[];
    durations: number[];
    start_date: string;
    end_date: string;
}

/**
 * Converts TestRun ActiveFilters format to TimeSeriesFilters format
 */
export const convertActiveFiltersToTimeSeriesFilters = (
    activeFilters: ActiveFilters
): TimeSeriesFilters => {
    return {
        hostnames: activeFilters.hostnames,
        protocols: activeFilters.protocols,
        drive_models: activeFilters.drive_models,
        drive_types: activeFilters.drive_types,
        block_sizes: activeFilters.block_sizes.map(size => size.toString()),
        patterns: activeFilters.patterns,
        queue_depths: activeFilters.queue_depths,
        syncs: activeFilters.syncs,
        directs: activeFilters.directs,
        num_jobs: activeFilters.num_jobs,
        test_sizes: activeFilters.test_sizes,
        durations: activeFilters.durations,
        start_date: '',
        end_date: '',
    };
};

/**
 * Converts TimeSeriesFilters format back to TestRun ActiveFilters format
 */
export const convertTimeSeriesFiltersToActiveFilters = (
    timeSeriesFilters: TimeSeriesFilters
): ActiveFilters => {
    return {
        hostnames: timeSeriesFilters.hostnames,
        protocols: timeSeriesFilters.protocols,
        drive_models: timeSeriesFilters.drive_models,
        drive_types: timeSeriesFilters.drive_types,
        block_sizes: timeSeriesFilters.block_sizes.map((size: string) => {
            // Try to convert to number if it's a numeric string, otherwise keep as string
            const numValue = parseInt(size, 10);
            return isNaN(numValue) ? size : numValue;
        }),
        patterns: timeSeriesFilters.patterns,
        queue_depths: timeSeriesFilters.queue_depths,
        host_disk_combinations: [],
        syncs: timeSeriesFilters.syncs,
        directs: timeSeriesFilters.directs,
        num_jobs: timeSeriesFilters.num_jobs,
        test_sizes: timeSeriesFilters.test_sizes,
        durations: timeSeriesFilters.durations,
    };
};