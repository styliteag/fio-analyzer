import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Server, Upload } from 'lucide-react';
import { PageHeader, PAGE_CONTAINER } from '../components/layout';
import { Card, Loading, ErrorDisplay, EmptyState } from '../components/ui';
import { useUrlValue } from '../hooks/useUrlState';
import { useHostData } from '../hooks/useHostData';
import { useHostFilters } from '../hooks/useHostFilters';
import HostSelector from '../components/host/HostSelector';
import HostSummaryCards from '../components/host/HostSummaryCards';
import HostVisualizationControls, { VIEW_IDS, type VisualizationView } from '../components/host/HostVisualizationControls';
import HostFiltersSidebar from '../components/host/HostFiltersSidebar';
import HostOverview from '../components/host/HostOverview';
import DriveRadarChart from '../components/host/DriveRadarChart';
import PerformanceScatterPlot from '../components/host/PerformanceScatterPlot';
import ParallelCoordinatesChart from '../components/host/ParallelCoordinatesChart';
import BoxPlotChart from '../components/host/BoxPlotChart';
import FacetScatterGrid from '../components/host/FacetScatterGrid';
import StackedBarChart from '../components/host/StackedBarChart';
import Performance3DChart from '../components/host/Performance3DChart';
import PerformanceFingerprintHeatmap from '../components/host/PerformanceFingerprintHeatmap';
import PerformanceCharts from '../components/host/PerformanceCharts';
import PerformanceGraphs from '../components/host/PerformanceGraphs';
import PerformanceHeatmapView from '../components/host/PerformanceHeatmapView';
import TrendChartsView from '../components/host/TrendChartsView';
import PerformanceMatrixView from '../components/host/PerformanceMatrixView';


const Host: React.FC = () => {

    // Active visualization is kept in the URL (?view=radar)
    const [activeView, setActiveView] = useUrlValue<VisualizationView>('view', 'overview', VIEW_IDS);

    // Use custom hooks for data and filters
    const {
        availableHosts,
        loadingHosts,
        selectedHosts: selectedDataHosts,
        combinedHostData,
        loading,
        error,
        failedHosts,
        handleHostsChange,
        refreshData
    } = useHostData();

    const {
        selectedBlockSizes,
        selectedPatterns,
        selectedQueueDepths,
        selectedNumJobs,
        selectedSyncs,
        selectedDirects,
        selectedIoDepths,
        selectedTestSizes,
        selectedDurations,
        selectedHosts,
        selectedHostProtocols,
        selectedHostProtocolTypes,
        selectedHostProtocolTypeModels,
        setSelectedBlockSizes,
        setSelectedPatterns,
        setSelectedQueueDepths,
        setSelectedNumJobs,
        setSelectedSyncs,
        setSelectedDirects,
        setSelectedIoDepths,
        setSelectedTestSizes,
        setSelectedDurations,
        setSelectedHosts,
        setSelectedHostProtocols,
        setSelectedHostProtocolTypes,
        setSelectedHostProtocolTypeModels,
        filteredDrives,
        resetFilters
    } = useHostFilters({ combinedHostData });

    // Calculate filtered summary data
    const filteredHostData = useMemo(() => {
        if (!combinedHostData) return null;

        const allConfigs = filteredDrives.flatMap(d => d.configurations);
        const validIopsConfigs = allConfigs.filter(c => c.iops !== null && c.iops !== undefined && c.iops > 0);
        const validLatencyConfigs = allConfigs.filter(c => c.avg_latency !== null && c.avg_latency !== undefined && c.avg_latency > 0);

        const totalTests = validIopsConfigs.length;
        const avgIOPS = validIopsConfigs.length > 0
            ? validIopsConfigs.reduce((sum, c) => sum + (c.iops || 0), 0) / validIopsConfigs.length
            : 0;
        const avgLatency = validLatencyConfigs.length > 0
            ? validLatencyConfigs.reduce((sum, c) => sum + (c.avg_latency || 0), 0) / validLatencyConfigs.length
            : 0;

        return {
            ...combinedHostData,
            drives: filteredDrives,
            totalTests,
            performanceSummary: {
                ...combinedHostData.performanceSummary,
                avgIOPS,
                avgLatency
            }
        };
    }, [combinedHostData, filteredDrives]);

    const hasHosts = availableHosts.length > 0;
    const nothingSelected = selectedDataHosts.length === 0;

    return (
        <div className={PAGE_CONTAINER}>
            <PageHeader
                title="Host Analysis"
                description="Compare storage performance across hosts, protocols, drive types and models."
            />

            {error && (
                <div className="mb-6">
                    <ErrorDisplay error={error} onRetry={refreshData} showRetry={true} />
                </div>
            )}

            {!loadingHosts && !hasHosts && !error && (
                <Card className="p-6">
                    <EmptyState
                        icon={<Server className="h-12 w-12" />}
                        title="No benchmark data yet"
                        description="Upload FIO JSON results or run fio-test.sh on a host. Hosts appear here after their first upload."
                        action={
                            <Link to="/upload" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium theme-btn-primary">
                                <Upload className="h-4 w-4" aria-hidden="true" />
                                Upload results
                            </Link>
                        }
                    />
                </Card>
            )}

            {(loadingHosts || hasHosts) && (
                <HostSelector
                    availableHosts={availableHosts}
                    selectedHosts={selectedDataHosts}
                    loadingHosts={loadingHosts}
                    loading={loading}
                    onHostsChange={handleHostsChange}
                    onRefresh={refreshData}
                />
            )}

            {failedHosts.length > 0 && !error && (
                <div role="alert" className="mb-6 flex items-center gap-2 rounded-lg border border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 px-4 py-3 text-sm text-yellow-800 dark:text-yellow-200">
                    <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                    Could not load data for: {failedHosts.join(', ')}. Showing the remaining hosts.
                </div>
            )}

            {hasHosts && nothingSelected && (
                <Card className="p-6">
                    <EmptyState
                        icon={<Server className="h-12 w-12" />}
                        title="Pick hosts to start"
                        description="Select one host for a deep dive, or several to compare them. Your selection, view and filters are saved in the URL, so you can bookmark or share it."
                        action={
                            <div role="group" aria-label="Quick pick a host" className="flex flex-wrap justify-center gap-2">
                                {availableHosts.slice(0, 8).map((host) => (
                                    <button
                                        key={host}
                                        type="button"
                                        onClick={() => handleHostsChange([host])}
                                        className="px-3 py-1.5 rounded-full border text-sm theme-nav-link theme-border-primary"
                                    >
                                        {host}
                                    </button>
                                ))}
                            </div>
                        }
                    />
                </Card>
            )}

            {loading && !nothingSelected && (
                <div className="flex justify-center py-12">
                    <Loading />
                </div>
            )}

                {/* Content when host data is available */}
                {!loading && combinedHostData && filteredHostData && (
                    <>
                        {/* Summary Cards */}
                        <HostSummaryCards
                            hostData={filteredHostData}
                            selectedHostsCount={selectedDataHosts.length}
                        />

                        {/* Visualization Controls */}
                        <HostVisualizationControls
                            activeView={activeView}
                            onViewChange={setActiveView}
                        />

                        {/* Main Content Area */}
                        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
                            {/* Filters Sidebar */}
                            <HostFiltersSidebar
                                hostData={combinedHostData}
                                selectedBlockSizes={selectedBlockSizes}
                                selectedPatterns={selectedPatterns}
                                selectedQueueDepths={selectedQueueDepths}
                                selectedNumJobs={selectedNumJobs}
                                selectedSyncs={selectedSyncs}
                                selectedDirects={selectedDirects}
                                selectedIoDepths={selectedIoDepths}
                                selectedTestSizes={selectedTestSizes}
                                selectedDurations={selectedDurations}
                                selectedHosts={selectedHosts}
                                selectedHostProtocols={selectedHostProtocols}
                                selectedHostProtocolTypes={selectedHostProtocolTypes}
                                selectedHostProtocolTypeModels={selectedHostProtocolTypeModels}
                                onBlockSizeChange={setSelectedBlockSizes}
                                onPatternChange={setSelectedPatterns}
                                onQueueDepthChange={setSelectedQueueDepths}
                                onNumJobsChange={setSelectedNumJobs}
                                onSyncChange={setSelectedSyncs}
                                onDirectChange={setSelectedDirects}
                                onIoDepthChange={setSelectedIoDepths}
                                onTestSizeChange={setSelectedTestSizes}
                                onDurationChange={setSelectedDurations}
                                onHostChange={setSelectedHosts}
                                onHostProtocolChange={setSelectedHostProtocols}
                                onHostProtocolTypeChange={setSelectedHostProtocolTypes}
                                onHostProtocolTypeModelChange={setSelectedHostProtocolTypeModels}
                                onReset={resetFilters}
                            />

                            {/* Visualization Area */}
                            <div className="xl:col-span-3">
                                <Card className="p-6">
                                    {activeView === 'overview' && (
                                        <HostOverview filteredDrives={filteredDrives} />
                                    )}


                                    {activeView === 'radar' && (
                                        <DriveRadarChart drives={filteredDrives} />
                                    )}

                                    {activeView === 'scatter' && (
                                        <PerformanceScatterPlot drives={filteredDrives} />
                                    )}

                                    {activeView === 'parallel' && (
                                        <ParallelCoordinatesChart data={filteredDrives} />
                                    )}

                                    {activeView === 'boxplot' && (
                                        <BoxPlotChart data={filteredDrives} />
                                    )}

                                    {activeView === 'facets' && (
                                        <FacetScatterGrid data={filteredDrives} />
                                    )}

                                    {activeView === 'stacked' && (
                                        <StackedBarChart filteredDrives={filteredDrives} />
                                    )}

                                    {activeView === 'advancedHeatmap' && (
                                        <PerformanceHeatmapView drives={filteredDrives} />
                                    )}

                                    {activeView === 'trends' && (
                                        <TrendChartsView drives={filteredDrives} />
                                    )}

                                    {activeView === 'matrix' && (
                                        <PerformanceMatrixView drives={filteredDrives} />
                                    )}

                                    {activeView === '3d' && (
                                        <Performance3DChart drives={filteredDrives} />
                                    )}

                                    {activeView === 'heatmap' && (
                                        <PerformanceFingerprintHeatmap drives={filteredDrives} />
                                    )}

                                    {activeView === 'charts' && (
                                        <PerformanceCharts drives={filteredDrives} />
                                    )}

                                    {activeView === 'graphs' && (
                                        <PerformanceGraphs drives={filteredDrives} />
                                    )}

                                </Card>
                            </div>
                        </div>
                    </>
                )}
        </div>
    );
};

export default Host;