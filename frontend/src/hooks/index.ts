// Hooks barrel export
export * from './api';

// Re-export existing hooks
export { useThemeColors } from './useThemeColors';
export { useApiCall, type UseApiCallOptions, type UseApiCallResult } from './useApiCall';
export { 
    useChartColors, 
    useSemanticChartColors, 
    useSchemeChartColors, 
    useChartJsColors, 
    useAdaptiveChartColors,
    type UseChartColorsOptions,
    type UseChartColorsResult
} from './useChartColors';

// Export filter-related hooks
export { 
    useTestRunFilters,
    type ActiveFilters,
    type FilterOption,
    type DynamicFilterOptions
} from './useTestRunFilters';
export { useFilterState } from './useFilterState';
export { useFilterOptions } from './useFilterOptions';
export { useFilteredData, useFilteredDataWithStats } from './useFilteredData';

// Re-export commonly used API hooks
export {
    useTestRuns,
    useTestRun,

    useTimeSeriesServers,
    useTimeSeriesLatest,
    useTimeSeriesHistory,
    useTimeSeriesTrends,
    useUpload,
    useBatchUpload,
    useUploadForm,
} from './api';