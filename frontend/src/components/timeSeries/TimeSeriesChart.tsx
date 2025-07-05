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
        hasData
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

    return (
        <div className={`p-4 ${isMaximized ? "h-full" : "h-96"} relative`}>
            {loading && renderLoadingState()}
            
            {!hasData ? (
                renderEmptyState()
            ) : (
                <div className="h-full">
                    <Line 
                        data={processedChartData!} 
                        options={chartOptions} 
                        key={`chart-${timeRange}`}
                    />
                </div>
            )}
        </div>
    );
};

export default TimeSeriesChart;