import React from "react";
import { Server, Clock, TrendingUp } from "lucide-react";
import type { 
    ServerGroup, 
    TimeRange, 
    EnabledMetrics 
} from "../../utils/timeSeriesHelpers";

interface TimeSeriesControlsProps {
    serverGroups: ServerGroup[];
    selectedServerIds: string[];
    timeRange: TimeRange;
    enabledMetrics: EnabledMetrics;
    onServerToggle: (serverId: string) => void;
    onTimeRangeChange: (timeRange: TimeRange) => void;
    onMetricToggle: (metric: keyof EnabledMetrics) => void;
    loading?: boolean;
}

const TimeSeriesControls: React.FC<TimeSeriesControlsProps> = ({
    serverGroups,
    selectedServerIds,
    timeRange,
    enabledMetrics,
    onServerToggle,
    onTimeRangeChange,
    onMetricToggle,
    loading = false,
}) => {
    const timeRangeOptions: { value: TimeRange; label: string }[] = [
        { value: "24h", label: "24h" },
        { value: "7d", label: "7d" },
        { value: "30d", label: "30d" },
    ];

    const metricOptions: { key: keyof EnabledMetrics; label: string }[] = [
        { key: "iops", label: "IOPS" },
        { key: "latency", label: "Latency" },
        { key: "bandwidth", label: "Bandwidth" },
    ];

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Server Selection */}
            <div className="space-y-2">
                <label className="text-sm font-medium theme-text-secondary flex items-center">
                    <Server className="h-4 w-4 mr-1" />
                    Servers
                </label>
                <div>
                    {serverGroups.length === 0 ? (
                        <div className="text-sm theme-text-secondary">
                            {loading ? "Loading servers..." : "No servers available"}
                        </div>
                    ) : (
                        <select
                            multiple
                            value={selectedServerIds}
                            onChange={e => {
                                const options = Array.from(e.target.options);
                                const newSelected = options.filter(o => o.selected).map(o => o.value);
                                // Call onServerToggle for each server that changed
                                serverGroups.forEach(group => {
                                    const isSelected = selectedServerIds.includes(group.id);
                                    const willBeSelected = newSelected.includes(group.id);
                                    if (isSelected !== willBeSelected) {
                                        onServerToggle(group.id);
                                    }
                                });
                            }}
                            disabled={loading}
                            className="w-full min-h-[2.5rem] max-h-32 rounded border theme-border-primary theme-bg-secondary theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {serverGroups.map(group => (
                                <option key={group.id} value={group.id}>
                                    {group.hostname} ({group.protocol}) - {group.driveModels.length} drive{group.driveModels.length !== 1 ? 's' : ''}
                                </option>
                            ))}
                        </select>
                    )}
                </div>
            </div>

            {/* Time Range */}
            <div className="space-y-2">
                <label className="text-sm font-medium theme-text-secondary flex items-center">
                    <Clock className="h-4 w-4 mr-1" />
                    Time Range
                </label>
                <div className="flex space-x-2">
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
    );
};

export default TimeSeriesControls;