import React from "react";
import { Clock, TrendingUp, Filter, Activity } from "lucide-react";
import type { 
    TimeRange, 
    EnabledMetrics 
} from "../../utils/timeSeriesHelpers";
import type { ActiveFilters } from "../../hooks/useTestRunFilters";

interface TimeSeriesControlsProps {
    timeRange: TimeRange;
    enabledMetrics: EnabledMetrics;
    onTimeRangeChange: (timeRange: TimeRange) => void;
    onMetricToggle: (metric: keyof EnabledMetrics) => void;
    loading?: boolean;
    inheritedFilters?: ActiveFilters;
    totalDataPoints?: number;
}

const TimeSeriesControls: React.FC<TimeSeriesControlsProps> = ({
    timeRange,
    enabledMetrics,
    onTimeRangeChange,
    onMetricToggle,
    loading = false,
    inheritedFilters,
    totalDataPoints = 0,
}) => {
    const timeRangeOptions: { value: TimeRange; label: string }[] = [
        { value: "24h", label: "24h" },
        { value: "7d", label: "7d" },
        { value: "30d", label: "30d" },
        { value: "90d", label: "90d" },
        { value: "6m", label: "6m" },
        { value: "1y", label: "1y" },
        { value: "all", label: "All time" },
    ];

    const metricOptions: { key: keyof EnabledMetrics; label: string }[] = [
        { key: "iops", label: "IOPS" },
        { key: "latency", label: "Latency" },
        { key: "bandwidth", label: "Bandwidth" },
    ];

    return (
        <div className="space-y-4">
            {/* Data Points Indicator */}
            {totalDataPoints > 0 && (
                <div className="flex items-center justify-between p-3 theme-bg-tertiary rounded-lg">
                    <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 theme-text-secondary" />
                        <span className="text-sm theme-text-secondary">
                            Displaying <span className="font-semibold theme-text-primary">{totalDataPoints.toLocaleString()}</span> data points
                        </span>
                    </div>
                    <div className="text-xs theme-text-secondary">
                        {timeRange === "all" ? "All available data" : `${timeRange} timeframe`}
                    </div>
                </div>
            )}

            {/* Basic Controls */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Time Range */}
            <div className="space-y-2">
                <label className="text-sm font-medium theme-text-secondary flex items-center">
                    <Clock className="h-4 w-4 mr-1" />
                    Time Range
                </label>
                <div className="flex flex-wrap gap-2">
                    {timeRangeOptions.map((option) => (
                        <button
                            key={option.value}
                            onClick={() => onTimeRangeChange(option.value)}
                            disabled={loading}
                            className={`px-3 py-1 rounded text-sm transition-colors ${
                                timeRange === option.value
                                    ? "theme-btn-primary"
                                    : "theme-bg-secondary theme-text-secondary hover:theme-bg-tertiary"
                            } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Metrics Selection */}
            <div className="space-y-2">
                <label className="text-sm font-medium theme-text-secondary flex items-center">
                    <TrendingUp className="h-4 w-4 mr-1" />
                    Metrics
                </label>
                <div className="space-y-1">
                    {metricOptions.map((option) => (
                        <label key={option.key} className="flex items-center text-sm">
                            <input
                                type="checkbox"
                                checked={enabledMetrics[option.key]}
                                onChange={() => onMetricToggle(option.key)}
                                disabled={loading}
                                className="mr-2"
                            />
                            <span className="theme-text-primary">
                                {option.label}
                            </span>
                        </label>
                    ))}
                </div>
            </div>
            </div>

            {/* Inherited Filters Display */}
            {inheritedFilters && (
                <div className="border-t theme-border-secondary pt-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Filter className="h-4 w-4 theme-text-secondary" />
                        <h4 className="text-sm font-medium theme-text-secondary">
                            Applied Filters from Test Run Selection
                        </h4>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {inheritedFilters.hostnames.length > 0 && (
                            <div className="px-3 py-1 theme-bg-tertiary rounded-full text-xs theme-text-primary">
                                <strong>Hosts:</strong> {inheritedFilters.hostnames.join(', ')}
                            </div>
                        )}
                        {inheritedFilters.protocols.length > 0 && (
                            <div className="px-3 py-1 theme-bg-tertiary rounded-full text-xs theme-text-primary">
                                <strong>Protocols:</strong> {inheritedFilters.protocols.join(', ')}
                            </div>
                        )}
                        {inheritedFilters.drive_models.length > 0 && (
                            <div className="px-3 py-1 theme-bg-tertiary rounded-full text-xs theme-text-primary">
                                <strong>Models:</strong> {inheritedFilters.drive_models.join(', ')}
                            </div>
                        )}
                        {inheritedFilters.drive_types.length > 0 && (
                            <div className="px-3 py-1 theme-bg-tertiary rounded-full text-xs theme-text-primary">
                                <strong>Types:</strong> {inheritedFilters.drive_types.join(', ')}
                            </div>
                        )}
                        {inheritedFilters.block_sizes.length > 0 && (
                            <div className="px-3 py-1 theme-bg-tertiary rounded-full text-xs theme-text-primary">
                                <strong>Block Sizes:</strong> {inheritedFilters.block_sizes.join(', ')}
                            </div>
                        )}
                        {inheritedFilters.patterns.length > 0 && (
                            <div className="px-3 py-1 theme-bg-tertiary rounded-full text-xs theme-text-primary">
                                <strong>Patterns:</strong> {inheritedFilters.patterns.join(', ')}
                            </div>
                        )}
                        {Object.values(inheritedFilters).every(arr => arr.length === 0) && (
                            <div className="px-3 py-1 theme-bg-tertiary rounded-full text-xs theme-text-secondary">
                                No filters applied - showing all available data
                            </div>
                        )}
                    </div>
                    
                </div>
            )}
        </div>
    );
};

export default TimeSeriesControls;