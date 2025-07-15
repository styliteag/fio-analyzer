// Chart area component that handles different chart types
import React from 'react';
import { ChartContainer } from '../charts';
import ThreeDBarChart from '../ThreeDBarChart';
import TimeSeriesChart from '../TimeSeriesChart';
import PerformanceRadarGrid from '../PerformanceRadarGrid';
import type { ChartTemplate, PerformanceData } from '../../types';
import type { ActiveFilters } from '../../hooks/useTestRunFilters';

interface ChartAreaProps {
    selectedTemplate: ChartTemplate;
    enhancedPerformanceData: PerformanceData[];
    threeDChartData: any[];
    isChartMaximized: boolean;
    handleToggleMaximize: () => void;
    loading: boolean;
    sharedFilters?: ActiveFilters;
}

export const ChartArea: React.FC<ChartAreaProps> = ({
    selectedTemplate,
    enhancedPerformanceData,
    threeDChartData,
    isChartMaximized,
    handleToggleMaximize,
    loading,
    sharedFilters,
}) => {
    if (!selectedTemplate) return null;

    return (
        <div className="relative">
            {loading && (
                <div className="absolute inset-0 theme-bg-card bg-opacity-75 flex items-center justify-center z-10 rounded-lg">
                    <div className="flex items-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
                        <span className="theme-text-secondary">
                            Loading performance data...
                        </span>
                    </div>
                </div>
            )}
            
            {selectedTemplate.chartType === 'time-series' ? (
                <TimeSeriesChart
                    isMaximized={isChartMaximized}
                    onToggleMaximize={handleToggleMaximize}
                    sharedFilters={sharedFilters}
                />
            ) : selectedTemplate.chartType === '3d-bar' ? (
                <ThreeDBarChart 
                    data={threeDChartData} 
                    isMaximized={isChartMaximized}
                    onToggleMaximize={handleToggleMaximize}
                />
            ) : selectedTemplate.chartType === 'radar-grid' ? (
                <PerformanceRadarGrid
                    data={enhancedPerformanceData}
                    isMaximized={isChartMaximized}
                />
            ) : (
                <ChartContainer
                    template={selectedTemplate}
                    data={enhancedPerformanceData}
                    isMaximized={isChartMaximized}
                    onToggleMaximize={handleToggleMaximize}
                    showControls={true}
                    showStats={true}
                    showExport={true}
                />
            )}
        </div>
    );
};