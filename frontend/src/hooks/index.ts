// Hooks barrel export
export * from './api';

// Re-export existing hooks
export { useThemeColors } from './useThemeColors';
export { useApiCall, type UseApiCallOptions, type UseApiCallResult } from './useApiCall';

// Re-export commonly used API hooks
export {
    useTestRuns,
    useTestRun,
    usePerformanceData,
    useSinglePerformanceData,
    useTimeSeriesServers,
    useTimeSeriesLatest,
    useTimeSeriesHistory,
    useTimeSeriesTrends,
    useUpload,
    useBatchUpload,
    useUploadForm,
} from './api';