import React, { useState } from 'react';
import { DashboardHeader, DashboardFooter } from '../components/layout';
import { Card, Loading, ErrorDisplay } from '../components/ui';
import { useHostData } from '../hooks/useHostData';
import { useHostFilters } from '../hooks/useHostFilters';
import HostSelector from '../components/host/HostSelector';
import HostSummaryCards from '../components/host/HostSummaryCards';
import HostVisualizationControls, { type VisualizationView } from '../components/host/HostVisualizationControls';
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
import PerformanceGraphs from '../components/host/PerformanceGraphs';

const Host: React.FC = () => {
    
    // Visualization states
    const [activeView, setActiveView] = useState<VisualizationView>('overview');

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
    } = useHostData();

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

    // Show host selector when no hosts are selected
    if (selectedHosts.length === 0) {
        return (
            <div className="min-h-screen theme-bg-secondary">
                <DashboardHeader />
                <main className="container mx-auto px-4 py-8">
                    <div className="max-w-4xl mx-auto">
                        <div className="mb-8">
                            <h1 className="text-3xl font-bold theme-text-primary mb-2">Host Analysis</h1>
                            <p className="theme-text-secondary">Select one or more hosts to analyze their storage performance</p>
                        </div>
                        
                        <Card className="p-6">
                            <div className="mb-4">
                                <h2 className="text-xl font-semibold theme-text-primary mb-2">Available Hosts</h2>
                                <p className="theme-text-secondary text-sm">Choose hosts to analyze their performance data</p>
                            </div>
                            
                            <HostSelector
                                selectedHosts={selectedHosts}
                                onHostsChange={handleHostsChangeWithReset}
                                availableHosts={availableHosts}
                                loadingHosts={loadingHosts}
                                loading={loading}
                                onRefresh={refreshData}
                            />
                        </Card>
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

                                    {activeView === 'graphs' && (
                                        <PerformanceGraphs drives={filteredDrives} />
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