import React, { useState, useEffect } from "react";
import { Maximize2, Minimize2, Activity, AlertCircle, RefreshCw } from "lucide-react";
import { useTimeSeriesData } from "../../hooks/useTimeSeriesData";
import TimeSeriesControls from "./TimeSeriesControls";
import TimeSeriesChart from "./TimeSeriesChart";
import TimeSeriesStats from "./TimeSeriesStats";
import { 
    validateMetricsSelection,
    type EnabledMetrics,
    type TimeRange 
} from "../../utils/timeSeriesHelpers";

interface TimeSeriesContainerProps {
    isMaximized: boolean;
    onToggleMaximize: () => void;
}

const TimeSeriesContainer: React.FC<TimeSeriesContainerProps> = ({
    isMaximized,
    onToggleMaximize,
}) => {
    // State for user selections
    const [selectedServerIds, setSelectedServerIds] = useState<string[]>([]);
    const [timeRange, setTimeRange] = useState<TimeRange>("7d");
    const [enabledMetrics, setEnabledMetrics] = useState<EnabledMetrics>({
        iops: true,
        latency: true,
        bandwidth: false,
    });

    // Use the custom hook for data management
    const {
        serverGroups,
        chartData,
        loading,
        serversLoading,
        error,
        loadTimeSeriesData,
        refreshServers,
        clearError,
    } = useTimeSeriesData();

    // Auto-select first server group when servers are loaded
    useEffect(() => {
        if (serverGroups.length > 0 && selectedServerIds.length === 0) {
            setSelectedServerIds([serverGroups[0].id]);
        }
    }, [serverGroups, selectedServerIds]);

    // Load time series data when selections change
    useEffect(() => {
        if (selectedServerIds.length > 0) {
            loadTimeSeriesData(selectedServerIds, timeRange);
        }
    }, [selectedServerIds, timeRange, loadTimeSeriesData]);

    // Event handlers
    const handleServerToggle = (serverId: string) => {
        setSelectedServerIds(prev => 
            prev.includes(serverId)
                ? prev.filter(id => id !== serverId)
                : [...prev, serverId]
        );
    };

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
        if (selectedServerIds.length > 0) {
            loadTimeSeriesData(selectedServerIds, timeRange);
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
                isMaximized ? "fixed inset-4 z-50" : "h-auto"
            }`}
        >
            {/* Header Controls */}
            <div className="p-4 border-b theme-border-primary">
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
                    serverGroups={serverGroups}
                    selectedServerIds={selectedServerIds}
                    timeRange={timeRange}
                    enabledMetrics={enabledMetrics}
                    onServerToggle={handleServerToggle}
                    onTimeRangeChange={handleTimeRangeChange}
                    onMetricToggle={handleMetricToggle}
                    loading={loading || serversLoading}
                />
            </div>

            {/* Chart Area */}
            <TimeSeriesChart
                chartData={chartData}
                serverGroups={serverGroups}
                enabledMetrics={enabledMetrics}
                timeRange={timeRange}
                selectedServerIds={selectedServerIds}
                loading={loading}
                isMaximized={isMaximized}
            />

            {/* Server Statistics */}
            <TimeSeriesStats
                selectedServerIds={selectedServerIds}
                serverGroups={serverGroups}
                chartData={chartData}
            />
        </div>
    );
};

export default TimeSeriesContainer;