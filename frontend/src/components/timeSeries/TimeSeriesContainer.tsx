import React, { useState, useEffect, useMemo } from "react";
import { Maximize2, Minimize2, Activity, AlertCircle, RefreshCw } from "lucide-react";
import { useTimeSeriesData } from "../../hooks/useTimeSeriesData";
import { convertActiveFiltersToTimeSeriesFilters } from "../../utils/filterConverters";
import TimeSeriesControls from "./TimeSeriesControls";
import TimeSeriesChart from "./TimeSeriesChart";
import { 
    validateMetricsSelection,
    type EnabledMetrics,
    type TimeRange 
} from "../../utils/timeSeriesHelpers";
import type { ActiveFilters } from "../../hooks/useTestRunFilters";

interface TimeSeriesContainerProps {
    isMaximized: boolean;
    onToggleMaximize: () => void;
    sharedFilters?: ActiveFilters;
}

const TimeSeriesContainer: React.FC<TimeSeriesContainerProps> = ({
    isMaximized,
    onToggleMaximize,
    sharedFilters,
}) => {
    // State for user selections
    const [timeRange, setTimeRange] = useState<TimeRange>("7d");
    const [enabledMetrics, setEnabledMetrics] = useState<EnabledMetrics>({
        iops: true,
        latency: true,
        bandwidth: false,
    });

    // Use the custom hook for data management
    const {
        serverGroups,
        seriesData,
        loading,
        serversLoading,
        error,
        loadTimeSeriesData,
        refreshServers,
        clearError,
    } = useTimeSeriesData();

    // Calculate total data points across all series
    const totalDataPoints = useMemo(() => {
        return seriesData.reduce((total, series) => {
            return total + (series.data ? series.data.length : 0);
        }, 0);
    }, [seriesData]);

    // Convert shared filters from TestRun format to TimeSeries format
    const activeFilters = useMemo(() => {
        if (!sharedFilters) {
            return {
                hostnames: [],
                protocols: [],
                drive_models: [],
                drive_types: [],
                block_sizes: [],
                patterns: [],
                queue_depths: [],
                syncs: [],
                directs: [],
                num_jobs: [],
                test_sizes: [],
                durations: [],
                start_date: '',
                end_date: '',
            };
        }
        return convertActiveFiltersToTimeSeriesFilters(sharedFilters);
    }, [sharedFilters]);

    // Note: We no longer need filter options since filters are inherited from Dashboard

    // Load time series data when filters change
    useEffect(() => {
        if (serverGroups.length > 0) {
            // Use all server groups - filtering is handled by the API
            const allServerIds = serverGroups.map(group => group.id);
            loadTimeSeriesData(allServerIds, timeRange, activeFilters);
        }
    }, [serverGroups, timeRange, activeFilters, loadTimeSeriesData]);

    const handleTimeRangeChange = (newTimeRange: TimeRange) => {
        setTimeRange(newTimeRange);
    };

    const handleMetricToggle = (metric: keyof EnabledMetrics) => {
        setEnabledMetrics(prev => ({
            ...prev,
            [metric]: !prev[metric],
        }));
    };

    const handleRefresh = () => {
        refreshServers();
        if (serverGroups.length > 0) {
            const allServerIds = serverGroups.map(group => group.id);
            loadTimeSeriesData(allServerIds, timeRange, activeFilters);
        }
    };

    const handleClearError = () => {
        clearError();
    };

    // Validation
    const hasValidMetrics = validateMetricsSelection(enabledMetrics);

    return (
        <div
            className={`theme-card rounded-lg shadow-md border ${
                isMaximized ? "fixed inset-4 z-50 flex flex-col" : "h-auto"
            }`}
        >
            {/* Header Controls */}
            <div className={`p-4 border-b theme-border-primary ${isMaximized ? "flex-shrink-0" : ""}`}>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                        <Activity className="h-6 w-6 theme-text-accent mr-3" />
                        <h3 className="text-xl font-semibold theme-text-primary">
                            Performance Monitoring
                        </h3>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={handleRefresh}
                            disabled={loading || serversLoading}
                            className="p-2 rounded-md theme-text-secondary hover:theme-text-primary hover:theme-bg-tertiary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Refresh data"
                        >
                            <RefreshCw 
                                size={20} 
                                className={`${loading || serversLoading ? 'animate-spin' : ''}`}
                            />
                        </button>
                        <button
                            onClick={onToggleMaximize}
                            className="p-2 rounded-md theme-text-secondary hover:theme-text-primary hover:theme-bg-tertiary transition-colors"
                            title={isMaximized ? "Minimize" : "Maximize"}
                        >
                            {isMaximized ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                        </button>
                    </div>
                </div>

                {/* Error Display */}
                {error && (
                    <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-md">
                        <div className="flex items-center">
                            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                            <span className="text-red-700">{error}</span>
                            <button
                                onClick={handleClearError}
                                className="ml-auto text-red-500 hover:text-red-700"
                            >
                                ×
                            </button>
                        </div>
                    </div>
                )}

                {/* Metrics Validation Warning */}
                {!hasValidMetrics && (
                    <div className="mb-4 p-3 bg-yellow-100 border border-yellow-300 rounded-md">
                        <div className="flex items-center">
                            <AlertCircle className="h-5 w-5 text-yellow-500 mr-2" />
                            <span className="text-yellow-700">
                                Please select at least one metric to display
                            </span>
                        </div>
                    </div>
                )}

                {/* Control Row */}
                <TimeSeriesControls
                    timeRange={timeRange}
                    enabledMetrics={enabledMetrics}
                    onTimeRangeChange={handleTimeRangeChange}
                    onMetricToggle={handleMetricToggle}
                    loading={loading || serversLoading}
                    // Show inherited filters from Test Run Selection
                    inheritedFilters={sharedFilters}
                    totalDataPoints={totalDataPoints}
                />
            </div>

            {/* Chart Area */}
            <div className={isMaximized ? "flex-1 min-h-0" : ""}>
                <TimeSeriesChart
                    seriesData={seriesData}
                    enabledMetrics={enabledMetrics}
                    timeRange={timeRange}
                    loading={loading}
                    isMaximized={isMaximized}
                />
            </div>

        </div>
    );
};

export default TimeSeriesContainer;