// Main chart container component that orchestrates all chart functionality
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, Maximize, Minimize, Filter } from 'lucide-react';
import type { ChartTemplate, PerformanceData } from '../../types';
import { Button, EmptyState } from '../ui';
import ChartControls from './ChartControls';
import SeriesToggle from './SeriesToggle';
import { ExportMenu } from './ChartExport';
import ChartStats from './ChartStats';
import ChartRenderer from './ChartRenderer';
import { processDataForTemplate } from './chartProcessors';
import { chartConfig } from '../../services/config';
import type { SortOption, GroupOption } from './ChartControls';

export interface ChartContainerProps {
    template: ChartTemplate;
    data: PerformanceData[];
    isMaximized?: boolean;
    onToggleMaximize?: () => void;
    showControls?: boolean;
    showStats?: boolean;
    showExport?: boolean;
    className?: string;
}

const ChartContainer: React.FC<ChartContainerProps> = ({
    template,
    data,
    isMaximized = false,
    onToggleMaximize,
    showControls = true,
    showStats = true,
    showExport = true,
    className = '',
}) => {
    const chartRef = useRef<any>(null);
    
    // Chart state
    const [visibleSeries, setVisibleSeries] = useState<Set<string>>(new Set());
    const [chartData, setChartData] = useState<any>(null);
    const [showControlsPanel, setShowControlsPanel] = useState(false);
    
    // Interactive controls state
    const [sortBy, setSortBy] = useState<SortOption>("name");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
    const [groupBy, setGroupBy] = useState<GroupOption>("none");

    // Process data for chart when inputs change
    const processedData = useMemo(() => {
        if (data.length === 0) return null;

        const colors = chartConfig.colors.primary;
        const options = { sortBy, sortOrder, groupBy };
        
        return processDataForTemplate(template, data, colors, options);
    }, [template, data, sortBy, sortOrder, groupBy]);

    // Update chart data and visible series when processed data changes
    useEffect(() => {
        if (processedData) {
            setChartData(processedData);
            
            // Initialize all series as visible
            const allSeries = new Set<string>(
                processedData.datasets.map((d: any) => d.label as string)
            );
            setVisibleSeries(allSeries);
        }
    }, [processedData]);

    // Series visibility handlers
    const toggleSeriesVisibility = useCallback((label: string) => {
        setVisibleSeries(prev => {
            const newSet = new Set(prev);
            if (newSet.has(label)) {
                newSet.delete(label);
            } else {
                newSet.add(label);
            }
            return newSet;
        });
    }, []);


    // Empty state
    if (!chartData || data.length === 0) {
        return (
            <div className={`theme-card rounded-lg shadow-md border ${isMaximized ? 'fixed inset-0 z-50 overflow-auto' : ''} ${className}`}>
                <EmptyState
                    icon={<BarChart3 size={48} />}
                    title="No Data Available"
                    description="Select test runs to view performance data"
                    className="py-24"
                />
            </div>
        );
    }

    return (
        <div className={`theme-card rounded-lg shadow-md border ${isMaximized ? 'fixed inset-0 z-50 overflow-auto' : ''} ${className}`}>
            {/* Header with title and controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 border-b theme-border-primary">
                <div>
                    <h3 className="text-lg font-semibold theme-text-primary">
                        {template.name}
                    </h3>
                    <p className="text-sm theme-text-secondary mt-1">
                        {template.description}
                    </p>
                </div>
                
                <div className="flex items-center space-x-2">
                    {/* Show Controls toggle button (icon only) */}
                    {showControls && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowControlsPanel(!showControlsPanel)}
                            icon={Filter}
                            title={showControlsPanel ? 'Hide Controls' : 'Show Controls'}
                        >
                            {''}
                        </Button>
                    )}
                    
                    {/* Export controls (icon only) */}
                    {showExport && (
                        <ExportMenu
                            chartRef={chartRef}
                            data={data}
                            chartTitle={template.name}
                        />
                    )}
                    
                    {/* Maximize/minimize button (icon only) */}
                    {onToggleMaximize && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onToggleMaximize}
                            icon={isMaximized ? Minimize : Maximize}
                            title={isMaximized ? 'Exit fullscreen' : 'Enter fullscreen'}
                        >
                            {''}
                        </Button>
                    )}
                </div>
            </div>

            {/* Interactive controls */}
            {showControls && showControlsPanel && (
                <div className="p-6 border-b theme-border-primary">
                    <ChartControls
                        sortBy={sortBy}
                        setSortBy={setSortBy}
                        sortOrder={sortOrder}
                        setSortOrder={setSortOrder}
                        groupBy={groupBy}
                        setGroupBy={setGroupBy}
                        showControls={showControlsPanel}
                        onToggleControls={() => setShowControlsPanel(!showControlsPanel)}
                        data={data}
                    />
                </div>
            )}

            {/* Series visibility toggles */}
            <div className="px-6 pt-6">
                <SeriesToggle
                    datasets={chartData.datasets}
                    visibleSeries={visibleSeries}
                    onToggleSeries={toggleSeriesVisibility}
                />
            </div>

            {/* Chart rendering area */}
            <div className="px-6">
                <ChartRenderer
                    ref={chartRef}
                    chartData={chartData}
                    template={template}
                    isMaximized={isMaximized}
                    onSeriesToggle={toggleSeriesVisibility}
                    visibleSeries={visibleSeries}
                />
            </div>

            {/* Chart statistics */}
            {showStats && (
                <div className="p-6 border-t theme-border-primary">
                    <ChartStats
                        data={data}
                        template={template}
                        visibleSeries={visibleSeries}
                        totalSeries={chartData.datasets.length}
                    />
                </div>
            )}
        </div>
    );
};

export default ChartContainer;