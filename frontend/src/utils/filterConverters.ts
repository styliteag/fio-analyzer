import type { ActiveFilters } from '../hooks/useTestRunFilters';
import type { TimeSeriesFilters } from '../components/timeSeries/TimeSeriesFilters';

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
        block_sizes: timeSeriesFilters.block_sizes.map(size => {
            // Try to convert to number if it's a numeric string, otherwise keep as string
            const numValue = parseInt(size, 10);
            return isNaN(numValue) ? size : numValue;
        }),
        patterns: timeSeriesFilters.patterns,
    };
};