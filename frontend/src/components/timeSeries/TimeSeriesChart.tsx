import React from "react";
import { Line } from "react-chartjs-2";
import { TrendingUp } from "lucide-react";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    TimeScale,
} from "chart.js";
import "chartjs-adapter-date-fns";
import { useTimeSeriesChart } from "../../hooks/useTimeSeriesChart";
import type { 
    EnabledMetrics, 
    TimeRange,
    TimeSeriesDataSeries
} from "../../utils/timeSeriesHelpers";

// Register ChartJS components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    TimeScale,
);

interface TimeSeriesChartProps {
    seriesData: TimeSeriesDataSeries[];
    enabledMetrics: EnabledMetrics;
    timeRange: TimeRange;
    loading?: boolean;
    isMaximized?: boolean;
}

const TimeSeriesChart: React.FC<TimeSeriesChartProps> = ({
    seriesData,
    enabledMetrics,
    timeRange,
    loading = false,
    isMaximized = false,
}) => {
    const { 
        processedChartData, 
        chartOptions, 
        hasData,
        visibleSeries,
        toggleSeries,
        showAllSeries,
        hideAllSeries,
        availableSeries
    } = useTimeSeriesChart({
        seriesData,
        enabledMetrics,
        timeRange,
    });

    const renderEmptyState = () => (
        <div className="h-full flex items-center justify-center">
            <div className="text-center">
                <TrendingUp className="h-16 w-16 theme-text-secondary mx-auto mb-4" />
                <h4 className="text-lg font-medium theme-text-primary mb-2">
                    No Data Available
                </h4>
                <p className="theme-text-secondary">
                    No performance data found for the selected filters and time range
                </p>
            </div>
        </div>
    );

    const renderLoadingState = () => (
        <div className="absolute inset-0 flex items-center justify-center theme-bg-card bg-opacity-75 z-10">
            <div className="flex items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
                <span className="theme-text-secondary">Loading performance data...</span>
            </div>
        </div>
    );

    const renderSeriesToggle = () => (
        <div className="mb-4 p-3 theme-bg-tertiary rounded-lg">
            <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium theme-text-primary">Series Visibility</h4>
                <div className="flex gap-2">
                    <button
                        onClick={showAllSeries}
                        className="text-xs px-2 py-1 rounded theme-text-secondary hover:theme-text-primary hover:theme-bg-secondary"
                    >
                        Show All
                    </button>
                    <button
                        onClick={hideAllSeries}
                        className="text-xs px-2 py-1 rounded theme-text-secondary hover:theme-text-primary hover:theme-bg-secondary"
                    >
                        Hide All
                    </button>
                </div>
            </div>
            <div className="flex flex-wrap gap-2">
                {availableSeries.map(series => (
                    <button
                        key={series.id}
                        onClick={() => toggleSeries(series.id)}
                        className={`text-xs px-2 py-1 rounded border transition-colors ${
                            visibleSeries.has(series.id)
                                ? 'border-blue-500 bg-blue-50 text-blue-700 hover:bg-blue-100'
                                : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50'
                        }`}
                        title={series.label}
                    >
                        {series.hostname} - {series.blockSize} {series.pattern}
                    </button>
                ))}
            </div>
        </div>
    );

    return (
        <div className={`p-4 ${isMaximized ? "h-full" : "h-96"} relative`}>
            {loading && renderLoadingState()}
            
            {!hasData ? (
                renderEmptyState()
            ) : (
                <div className="h-full">
                    {availableSeries.length > 1 && renderSeriesToggle()}
                    <div className={`${availableSeries.length > 1 ? 'h-5/6' : 'h-full'}`}>
                        <Line 
                            data={processedChartData!} 
                            options={chartOptions} 
                            key={`chart-${timeRange}`}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default TimeSeriesChart;