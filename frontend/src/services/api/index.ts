// API services barrel export
export * from './base';
export * from './testRuns';
export * from './performance';
export * from './timeSeries';
export * from './upload';

// Re-export commonly used functions for backward compatibility
export { 
    fetchTestRuns,
    updateTestRun,
    deleteTestRun,
    fetchFilters,
} from './testRuns';

export {
    fetchPerformanceData,
    fetchSinglePerformanceData,
    getDefaultMetrics,
} from './performance';

export {
    fetchTimeSeriesServers,
    fetchTimeSeriesLatest, 
    fetchTimeSeriesHistory,
    fetchTimeSeriesTrends,
} from './timeSeries';

export {
    uploadFioData,
    validateUploadMetadata,
    validateUploadFile,
} from './upload';