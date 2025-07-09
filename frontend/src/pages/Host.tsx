import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Server, HardDrive, Zap, Activity, ArrowLeft, RefreshCw, BarChart3, Radar, TrendingUp, Box, ChevronDown } from 'lucide-react';
import { DashboardHeader, DashboardFooter } from '../components/layout';
import { Card, Button, Loading, ErrorDisplay } from '../components/ui';
import { fetchHostAnalysis, getHostList, type HostAnalysisData } from '../services/api/hostAnalysis';
import PerformanceMatrix from '../components/host/PerformanceMatrix';
import DriveRadarChart from '../components/host/DriveRadarChart';
import PerformanceScatterPlot from '../components/host/PerformanceScatterPlot';
import Performance3DChart from '../components/host/Performance3DChart';
import HostFilters from '../components/host/HostFilters';

const Host: React.FC = () => {
    const { hostname } = useParams<{ hostname: string }>();
    const navigate = useNavigate();
    const [hostData, setHostData] = useState<HostAnalysisData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Host selection states
    const [availableHosts, setAvailableHosts] = useState<string[]>([]);
    const [loadingHosts, setLoadingHosts] = useState(true);
    const [selectedHost, setSelectedHost] = useState<string>('');
    
    // Filter states
    const [selectedBlockSizes, setSelectedBlockSizes] = useState<string[]>([]);
    const [selectedPatterns, setSelectedPatterns] = useState<string[]>([]);
    const [selectedQueueDepths, setSelectedQueueDepths] = useState<number[]>([]);
    const [selectedProtocols, setSelectedProtocols] = useState<string[]>([]);
    
    // Visualization states
    const [activeView, setActiveView] = useState<'overview' | 'matrix' | 'radar' | 'scatter' | '3d'>('overview');
    const [matrixMetric, setMatrixMetric] = useState<'iops' | 'avg_latency' | 'bandwidth'>('iops');

    // Load available hosts
    const loadHostList = async () => {
        try {
            setLoadingHosts(true);
            const hosts = await getHostList();
            setAvailableHosts(hosts);
            
            // Auto-select host from URL or first available host
            if (hostname && hosts.includes(hostname)) {
                setSelectedHost(hostname);
            } else if (!hostname && hosts.length > 0) {
                setSelectedHost(hosts[0]);
                navigate(`/host/${hosts[0]}`, { replace: true });
            }
        } catch (err) {
            console.error('Failed to load host list:', err);
            setError('Failed to load available hosts');
        } finally {
            setLoadingHosts(false);
        }
    };

    // Load host analysis data
    const loadHostData = async (targetHost?: string) => {
        const hostToLoad = targetHost || selectedHost || hostname;
        
        if (!hostToLoad) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);
            const data = await fetchHostAnalysis(hostToLoad);
            setHostData(data);
        } catch (err) {
            console.error('Failed to load host analysis:', err);
            setError(err instanceof Error ? err.message : 'Failed to load host analysis');
        } finally {
            setLoading(false);
        }
    };

    // Handle host selection change
    const handleHostChange = (newHost: string) => {
        setSelectedHost(newHost);
        navigate(`/host/${newHost}`);
        loadHostData(newHost);
        // Reset filters when switching hosts
        resetFilters();
    };

    // Load host list on component mount
    useEffect(() => {
        loadHostList();
    }, []);

    // Load host data when hostname changes
    useEffect(() => {
        if (hostname && hostname !== selectedHost) {
            setSelectedHost(hostname);
            loadHostData(hostname);
        }
    }, [hostname]);

    // Load host data when selected host changes (after host list is loaded)
    useEffect(() => {
        if (selectedHost && !loadingHosts) {
            loadHostData(selectedHost);
        }
    }, [selectedHost, loadingHosts]);

    // Filter drives based on selected criteria
    const filteredDrives = useMemo(() => {
        if (!hostData) return [];

        return hostData.drives.map(drive => ({
            ...drive,
            configurations: drive.configurations.filter(config => {
                const blockSizeMatch = selectedBlockSizes.length === 0 || selectedBlockSizes.includes(config.block_size);
                const patternMatch = selectedPatterns.length === 0 || selectedPatterns.includes(config.read_write_pattern);
                const queueDepthMatch = selectedQueueDepths.length === 0 || selectedQueueDepths.includes(config.queue_depth);
                
                return blockSizeMatch && patternMatch && queueDepthMatch;
            })
        })).filter(drive => drive.configurations.length > 0);
    }, [hostData, selectedBlockSizes, selectedPatterns, selectedQueueDepths, selectedProtocols]);

    const resetFilters = () => {
        setSelectedBlockSizes([]);
        setSelectedPatterns([]);
        setSelectedQueueDepths([]);
        setSelectedProtocols([]);
    };

    if (loadingHosts || (loading && !selectedHost)) {
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
                        onRetry={() => selectedHost ? loadHostData(selectedHost) : loadHostList()}
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
                {/* Header Section */}
                <div className="mb-8">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
                        <div className="flex items-center gap-4">
                            <Button
                                variant="outline"
                                onClick={() => navigate('/')}
                                className="flex items-center gap-2"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Back to Home
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => selectedHost && loadHostData(selectedHost)}
                                disabled={loading}
                                className="flex items-center gap-2"
                            >
                                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                Refresh
                            </Button>
                        </div>

                        {/* Host Selector */}
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-medium theme-text-secondary">Select Host:</span>
                            <div className="relative">
                                <select
                                    value={selectedHost}
                                    onChange={(e) => handleHostChange(e.target.value)}
                                    className="appearance-none bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-4 py-2 pr-8 text-sm theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    disabled={loadingHosts}
                                >
                                    {availableHosts.map(host => (
                                        <option key={host} value={host}>
                                            {host}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 theme-text-secondary pointer-events-none" />
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3 mb-2">
                        <Server className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                        <h1 className="text-3xl font-bold theme-text-primary">
                            {selectedHost || 'Host Analysis'}
                        </h1>
                    </div>
                    <p className="theme-text-secondary text-lg">
                        Performance Analysis Dashboard
                    </p>
                </div>

                {/* Loading state for host data */}
                {loading && selectedHost && (
                    <div className="flex justify-center py-12">
                        <Loading />
                    </div>
                )}

                {/* Content when host data is available */}
                {!loading && hostData && (
                <>
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <Card className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="theme-text-secondary text-sm font-medium">Total Tests</p>
                                <p className="theme-text-primary text-2xl font-bold">
                                    {hostData.totalTests.toLocaleString()}
                                </p>
                            </div>
                            <Activity className="w-8 h-8 text-blue-600 dark:text-blue-400 opacity-80" />
                        </div>
                    </Card>

                    <Card className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="theme-text-secondary text-sm font-medium">Storage Drives</p>
                                <p className="theme-text-primary text-2xl font-bold">
                                    {hostData.drives.length}
                                </p>
                            </div>
                            <HardDrive className="w-8 h-8 text-green-600 dark:text-green-400 opacity-80" />
                        </div>
                    </Card>

                    <Card className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="theme-text-secondary text-sm font-medium">Avg IOPS</p>
                                <p className="theme-text-primary text-2xl font-bold">
                                    {hostData.performanceSummary.avgIOPS.toFixed(0)}
                                </p>
                            </div>
                            <Zap className="w-8 h-8 text-yellow-600 dark:text-yellow-400 opacity-80" />
                        </div>
                    </Card>

                    <Card className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="theme-text-secondary text-sm font-medium">Avg Latency</p>
                                <p className="theme-text-primary text-2xl font-bold">
                                    {hostData.performanceSummary.avgLatency.toFixed(2)}ms
                                </p>
                            </div>
                            <Activity className="w-8 h-8 text-purple-600 dark:text-purple-400 opacity-80" />
                        </div>
                    </Card>
                </div>

                {/* View Selection */}
                <div className="mb-8">
                    <div className="flex flex-wrap gap-2 mb-4">
                        <Button
                            variant={activeView === 'overview' ? 'primary' : 'outline'}
                            onClick={() => setActiveView('overview')}
                            className="flex items-center gap-2"
                        >
                            <HardDrive className="w-4 h-4" />
                            Overview
                        </Button>
                        <Button
                            variant={activeView === 'matrix' ? 'primary' : 'outline'}
                            onClick={() => setActiveView('matrix')}
                            className="flex items-center gap-2"
                        >
                            <BarChart3 className="w-4 h-4" />
                            Performance Matrix
                        </Button>
                        <Button
                            variant={activeView === 'radar' ? 'primary' : 'outline'}
                            onClick={() => setActiveView('radar')}
                            className="flex items-center gap-2"
                        >
                            <Radar className="w-4 h-4" />
                            Radar Comparison
                        </Button>
                        <Button
                            variant={activeView === 'scatter' ? 'primary' : 'outline'}
                            onClick={() => setActiveView('scatter')}
                            className="flex items-center gap-2"
                        >
                            <TrendingUp className="w-4 h-4" />
                            IOPS vs Latency
                        </Button>
                        <Button
                            variant={activeView === '3d' ? 'primary' : 'outline'}
                            onClick={() => setActiveView('3d')}
                            className="flex items-center gap-2"
                        >
                            <Box className="w-4 h-4" />
                            3D Performance
                        </Button>
                    </div>

                    {/* Matrix Metric Selection */}
                    {activeView === 'matrix' && (
                        <div className="flex gap-2 mb-4">
                            <span className="text-sm theme-text-secondary self-center">Metric:</span>
                            <Button
                                variant={matrixMetric === 'iops' ? 'primary' : 'outline'}
                                size="sm"
                                onClick={() => setMatrixMetric('iops')}
                            >
                                IOPS
                            </Button>
                            <Button
                                variant={matrixMetric === 'avg_latency' ? 'primary' : 'outline'}
                                size="sm"
                                onClick={() => setMatrixMetric('avg_latency')}
                            >
                                Latency
                            </Button>
                            <Button
                                variant={matrixMetric === 'bandwidth' ? 'primary' : 'outline'}
                                size="sm"
                                onClick={() => setMatrixMetric('bandwidth')}
                            >
                                Bandwidth
                            </Button>
                        </div>
                    )}
                </div>

                {/* Main Content Area */}
                <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
                    {/* Filters Sidebar */}
                    <div className="xl:col-span-1">
                        <HostFilters
                            testCoverage={hostData.testCoverage}
                            selectedBlockSizes={selectedBlockSizes}
                            selectedPatterns={selectedPatterns}
                            selectedQueueDepths={selectedQueueDepths}
                            selectedProtocols={selectedProtocols}
                            onBlockSizeChange={setSelectedBlockSizes}
                            onPatternChange={setSelectedPatterns}
                            onQueueDepthChange={setSelectedQueueDepths}
                            onProtocolChange={setSelectedProtocols}
                            onReset={resetFilters}
                        />

                        {/* Best/Worst Drives Summary */}
                        <div className="mt-6 space-y-4">
                            <Card className="p-4">
                                <h4 className="text-sm font-semibold theme-text-primary mb-2 flex items-center gap-2">
                                    <Zap className="w-4 h-4 text-green-600" />
                                    Best Drive
                                </h4>
                                <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded">
                                    <p className="font-bold text-green-700 dark:text-green-400 text-sm">
                                        {hostData.performanceSummary.bestDrive}
                                    </p>
                                </div>
                            </Card>

                            <Card className="p-4">
                                <h4 className="text-sm font-semibold theme-text-primary mb-2 flex items-center gap-2">
                                    <Activity className="w-4 h-4 text-orange-600" />
                                    Needs Improvement
                                </h4>
                                <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded">
                                    <p className="font-bold text-orange-700 dark:text-orange-400 text-sm">
                                        {hostData.performanceSummary.worstDrive}
                                    </p>
                                </div>
                            </Card>
                        </div>
                    </div>

                    {/* Visualization Area */}
                    <div className="xl:col-span-3">
                        <Card className="p-6">
                            {activeView === 'overview' && (
                                <div>
                                    <h3 className="text-xl font-semibold theme-text-primary mb-6 flex items-center gap-2">
                                        <HardDrive className="w-6 h-6" />
                                        Drive Performance Overview
                                    </h3>
                                    
                                    <div className="grid gap-6">
                                        {filteredDrives.map((drive) => (
                                            <div key={drive.drive_model} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
                                                    <div>
                                                        <h4 className="text-lg font-semibold theme-text-primary">
                                                            {drive.drive_model}
                                                        </h4>
                                                        <p className="theme-text-secondary text-sm">
                                                            {drive.drive_type} • {drive.protocol} • {drive.configurations.length} tests
                                                        </p>
                                                    </div>
                                                    <div className="flex flex-wrap gap-4 text-sm">
                                                        <div className="text-center">
                                                            <p className="theme-text-secondary">Max IOPS</p>
                                                            <p className="font-bold text-blue-600 dark:text-blue-400">
                                                                {drive.topPerformance.maxIOPS.toFixed(0)}
                                                            </p>
                                                        </div>
                                                        <div className="text-center">
                                                            <p className="theme-text-secondary">Min Latency</p>
                                                            <p className="font-bold text-green-600 dark:text-green-400">
                                                                {drive.topPerformance.minLatency.toFixed(2)}ms
                                                            </p>
                                                        </div>
                                                        <div className="text-center">
                                                            <p className="theme-text-secondary">Max Bandwidth</p>
                                                            <p className="font-bold text-purple-600 dark:text-purple-400">
                                                                {drive.topPerformance.maxBandwidth.toFixed(1)} MB/s
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                {/* Test Configuration Grid */}
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                    {drive.configurations
                                                        .filter(config => config.iops !== null)
                                                        .sort((a, b) => (b.iops || 0) - (a.iops || 0))
                                                        .slice(0, 6)
                                                        .map((config, configIndex) => (
                                                        <div key={configIndex} className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
                                                            <div className="text-xs theme-text-secondary mb-1">
                                                                {config.block_size} • {config.read_write_pattern} • QD{config.queue_depth}
                                                            </div>
                                                            <div className="space-y-1">
                                                                <div className="flex justify-between">
                                                                    <span className="text-xs theme-text-secondary">IOPS:</span>
                                                                    <span className="text-xs font-medium theme-text-primary">
                                                                        {config.iops?.toFixed(0) || 'N/A'}
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span className="text-xs theme-text-secondary">Latency:</span>
                                                                    <span className="text-xs font-medium theme-text-primary">
                                                                        {config.avg_latency?.toFixed(2)}ms
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span className="text-xs theme-text-secondary">Bandwidth:</span>
                                                                    <span className="text-xs font-medium theme-text-primary">
                                                                        {config.bandwidth?.toFixed(1)} MB/s
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
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

                            {activeView === '3d' && (
                                <Performance3DChart 
                                    drives={filteredDrives} 
                                    allDrives={hostData?.drives} 
                                />
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