// API hooks barrel export
export * from './useTestRuns';
export * from './usePerformanceData';
export * from './useTimeSeries';
export * from './useUpload';

// Re-export commonly used hooks
export {
    useTestRuns,
    useTestRun,
    type UseTestRunsResult,
    type UseTestRunsOptions,
} from './useTestRuns';

export {
    usePerformanceData,
    useSinglePerformanceData,
    useFilteredPerformanceData,
    usePerformanceMetrics,
    type UsePerformanceDataResult,
    type UsePerformanceDataOptions,
} from './usePerformanceData';

export {
    useTimeSeriesServers,
    useTimeSeriesLatest,
    useTimeSeriesHistory,
    useTimeSeriesTrends,
    type UseTimeSeriesServersResult,
    type UseTimeSeriesLatestResult,
    type UseTimeSeriesHistoryResult,
    type UseTimeSeriesTrendsResult,
} from './useTimeSeries';

export {
    useUpload,
    useBatchUpload,
    useUploadForm,
    type UseUploadResult,
    type UseBatchUploadResult,
    type UseUploadFormResult,
} from './useUpload';