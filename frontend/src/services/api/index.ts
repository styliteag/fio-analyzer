// API services barrel export
export * from './base';
export * from './testRuns';
export * from './performance';
export * from './timeSeries';
export * from './upload';
export * from './dashboard';

// Re-export commonly used functions for backward compatibility
export { 
    fetchTestRuns,
    fetchTestRun,
    updateTestRun,
    bulkUpdateTestRuns,
    deleteTestRun,
    deleteTestRuns,
    fetchFilters,
    convertActiveFiltersToOptions,
    extractTestRuns,
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
    fetchTimeSeriesAll,
} from './timeSeries';

export {
    uploadFioData,
    validateUploadMetadata,
    validateUploadFile,
    bulkImportFioData,
} from './upload';

export {
    fetchDashboardStats,
    fetchQuickStats,
} from './dashboard';