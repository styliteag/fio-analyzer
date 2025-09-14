import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { DashboardHeader, DashboardFooter } from '../components/layout';
import { Card, Loading, ErrorDisplay } from '../components/ui';
import { useHostData } from '../hooks/useHostData';
import { useHostFilters } from '../hooks/useHostFilters';
import HostSelector from '../components/host/HostSelector';
import HostSummaryCards from '../components/host/HostSummaryCards';
import HostVisualizationControls, { type VisualizationView, type MatrixMetric } from '../components/host/HostVisualizationControls';
import HostFiltersSidebar from '../components/host/HostFiltersSidebar';
import HostOverview from '../components/host/HostOverview';
import PerformanceMatrix from '../components/host/PerformanceMatrix';
import DriveRadarChart from '../components/host/DriveRadarChart';
import PerformanceScatterPlot from '../components/host/PerformanceScatterPlot';
import ParallelCoordinatesChart from '../components/host/ParallelCoordinatesChart';
import BoxPlotChart from '../components/host/BoxPlotChart';
import FacetScatterGrid from '../components/host/FacetScatterGrid';
import StackedBarChart from '../components/host/StackedBarChart';
import Performance3DChart from '../components/host/Performance3DChart';
import PerformanceFingerprintHeatmap from '../components/host/PerformanceFingerprintHeatmap';
import BlockSizeEfficiencyMatrix from '../components/host/BlockSizeEfficiencyMatrix';

const Host: React.FC = () => {
    const { hostname } = useParams<{ hostname: string }>();
    
    // Visualization states
    const [activeView, setActiveView] = useState<VisualizationView>('overview');
    const [matrixMetric, setMatrixMetric] = useState<MatrixMetric>('iops');

    // Use custom hooks for data and filters
    const {
        availableHosts,
        loadingHosts,
        selectedHosts,
        combinedHostData,
        loading,
        error,
        handleHostsChange,
        refreshData
    } = useHostData({ hostname });

    const {
        selectedBlockSizes,
        selectedPatterns,
        selectedQueueDepths,
        selectedNumJobs,
        selectedProtocols,
        selectedHostDiskCombinations,
        setSelectedBlockSizes,
        setSelectedPatterns,
        setSelectedQueueDepths,
        setSelectedNumJobs,
        setSelectedProtocols,
        setSelectedHostDiskCombinations,
        filteredDrives,
        resetFilters
    } = useHostFilters({ combinedHostData });

    // Handle host changes and reset filters
    const handleHostsChangeWithReset = (newHosts: string[]) => {
        handleHostsChange(newHosts);
        resetFilters();
    };

    if (loadingHosts || (loading && selectedHosts.length === 0)) {
        return (
            <div className="min-h-screen theme-bg-secondary">
                <DashboardHeader />
                <main className="container mx-auto px-4 py-8">
                    <Loading />
                </main>
                <DashboardFooter getApiDocsUrl={() => "/api-docs"} />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen theme-bg-secondary">
                <DashboardHeader />
                <main className="container mx-auto px-4 py-8">
                    <ErrorDisplay 
                        error={error}
                        onRetry={refreshData}
                        showRetry={true}
                    />
                </main>
                <DashboardFooter getApiDocsUrl={() => "/api-docs"} />
            </div>
        );
    }

    if (availableHosts.length === 0) {
        return (
            <div className="min-h-screen theme-bg-secondary">
                <DashboardHeader />
                <main className="container mx-auto px-4 py-8">
                    <div className="text-center">
                        <p className="theme-text-secondary">No hosts available for analysis</p>
                    </div>
                </main>
                <DashboardFooter getApiDocsUrl={() => "/api-docs"} />
            </div>
        );
    }

    return (
        <div className="min-h-screen theme-bg-secondary">
            <DashboardHeader />
            
            <main className="container mx-auto px-4 py-8">
                {/* Host Selector */}
                <HostSelector
                    availableHosts={availableHosts}
                    selectedHosts={selectedHosts}
                    loadingHosts={loadingHosts}
                    loading={loading}
                    onHostsChange={handleHostsChangeWithReset}
                    onRefresh={refreshData}
                />

                {/* Loading state for host data */}
                {loading && selectedHosts.length > 0 && (
                    <div className="flex justify-center py-12">
                        <Loading />
                    </div>
                )}

                {/* Content when host data is available */}
                {!loading && combinedHostData && (
                    <>
                        {/* Summary Cards */}
                        <HostSummaryCards 
                            hostData={combinedHostData}
                            selectedHostsCount={selectedHosts.length}
                        />

                        {/* Visualization Controls */}
                        <HostVisualizationControls
                            activeView={activeView}
                            matrixMetric={matrixMetric}
                            onViewChange={setActiveView}
                            onMatrixMetricChange={setMatrixMetric}
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
                                selectedProtocols={selectedProtocols}
                                selectedHostDiskCombinations={selectedHostDiskCombinations}
                                onBlockSizeChange={setSelectedBlockSizes}
                                onPatternChange={setSelectedPatterns}
                                onQueueDepthChange={setSelectedQueueDepths}
                                onNumJobsChange={setSelectedNumJobs}
                                onProtocolChange={setSelectedProtocols}
                                onHostDiskCombinationChange={setSelectedHostDiskCombinations}
                                onReset={resetFilters}
                            />

                            {/* Visualization Area */}
                            <div className="xl:col-span-3">
                                <Card className="p-6">
                                    {activeView === 'overview' && (
                                        <HostOverview filteredDrives={filteredDrives} />
                                    )}

                                    {activeView === 'matrix' && (
                                        <PerformanceMatrix drives={filteredDrives} metric={matrixMetric} />
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

                                    {activeView === '3d' && (
                                        <Performance3DChart drives={filteredDrives} />
                                    )}

                                    {activeView === 'heatmap' && (
                                        <PerformanceFingerprintHeatmap drives={filteredDrives} />
                                    )}

                                    {activeView === 'efficiency' && (
                                        <BlockSizeEfficiencyMatrix drives={filteredDrives} />
                                    )}
                                </Card>
                            </div>
                        </div>
                    </>
                )}
            </main>
            
            <DashboardFooter getApiDocsUrl={() => "/api-docs"} />
        </div>
    );
};

export default Host;