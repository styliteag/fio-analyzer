import { useState, useEffect, useMemo } from "react";
import { DashboardHeader, DashboardFooter, ChartArea } from "../components/layout";
import TemplateSelector from "../components/TemplateSelector";
import Card from "../components/ui/Card";
import Loading from "../components/ui/Loading";
import ErrorDisplay from "../components/ui/ErrorDisplay";
import TestRunSelector from "../components/TestRunSelector";
import { useAuth } from "../contexts/AuthContext";
import { useTestRunFilters } from "../hooks/useTestRunFilters";
import { usePerformanceData } from "../hooks";
import { TrendingUp, Activity, Zap, Timer, HardDrive, Server } from "lucide-react";
import { fetchTestRuns } from "../services/api/testRuns";
import type { TestRun, ChartTemplate } from "../types";

interface TestRunMetrics {
	totalRuns: number;
	uniqueHostnames: number;
	uniqueDriveModels: number;
	dateRange: string;
	commonPatterns: string[];
	commonBlockSizes: string[];
}

export default function Performance() {
	useAuth(); // Ensure authentication context is available
	const [metrics, setMetrics] = useState<TestRunMetrics | null>(null);
	const [testRuns, setTestRuns] = useState<TestRun[]>([]);
	const [selectedRuns, setSelectedRuns] = useState<TestRun[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [refreshTrigger, setRefreshTrigger] = useState(0);
	const [selectedTemplate, setSelectedTemplate] = useState<ChartTemplate | null>(null);
	const [isChartMaximized, setIsChartMaximized] = useState(false);

	// Filter state for test runs
	const {
		activeFilters,
		filteredRuns,
		hasActiveFilters: _hasActiveFilters, // eslint-disable-line @typescript-eslint/no-unused-vars
		updateFilter,
		clearAllFilters,
	} = useTestRunFilters(testRuns);

	// Memoize values to prevent unnecessary re-renders
	const testRunIds = useMemo(() => selectedRuns.map(run => run.id), [selectedRuns]);
	const metricTypes = useMemo(() => 
		selectedTemplate?.metrics || ["iops", "avg_latency", "bandwidth"], 
		[selectedTemplate?.metrics]
	);
	const shouldAutoFetch = useMemo(() => 
		selectedRuns.length > 0 && selectedTemplate !== null, 
		[selectedRuns.length, selectedTemplate]
	);

	// Use performance data hook with stable options
	const hookOptions = useMemo(() => ({
		testRunIds,
		metricTypes,
		autoFetch: shouldAutoFetch,
	}), [testRunIds, metricTypes, shouldAutoFetch]);
	
	const { data: performanceData, loading: dataLoading } = usePerformanceData(hookOptions);

	// Enhance performance data with queue_depth from selected runs
	const enhancedPerformanceData = useMemo(() => {
		if (!performanceData || performanceData.length === 0) {
			return [];
		}
		
		return performanceData.map((perfData) => {
			const correspondingRun = selectedRuns.find(
				(run) => run.id === perfData.id,
			);
			return {
				...perfData,
				queue_depth: correspondingRun?.queue_depth || 1,
			};
		});
	}, [performanceData, selectedRuns]);

	// Memoize 3D chart data transformation
	const threeDChartData = useMemo(() => {
		return enhancedPerformanceData.map(d => {
			const metrics = (d as any).metrics;
			const latency_percentiles = (d as any).latency_percentiles;
			
			// Extract IOPS value
			const iops = metrics?.iops?.value || metrics?.combined?.iops?.value || 0;
			
			// Extract latency value (prefer p95, fallback to avg)
			const latency = latency_percentiles?.combined?.p95?.value || 
						   metrics?.avg_latency?.value || 
						   metrics?.combined?.avg_latency?.value || 0;
			
			// Calculate bandwidth from metrics
			const bandwidth = metrics?.bandwidth?.value || 
							metrics?.combined?.bandwidth?.value || 
							metrics?.throughput?.value || 
							metrics?.combined?.throughput?.value || 0;
			
			return {
				blocksize: d.block_size,
				queuedepth: d.queue_depth,
				iops: iops,
				latency: latency,
				bandwidth: bandwidth,
			};
		}).filter(d => d.iops > 0 || d.latency > 0 || d.bandwidth > 0); // Only include data with valid metrics
	}, [enhancedPerformanceData]);

	// Get the correct API documentation URL based on environment
	const getApiDocsUrl = () => {
		const apiBaseUrl = import.meta.env.VITE_API_URL || "";
		if (apiBaseUrl) {
			return `${apiBaseUrl}/api-docs`;
		} else {
			return "/api-docs";
		}
	};

	// Load test runs data
	const loadTestRuns = async () => {
		try {
			setLoading(true);
			setError(null);

			const result = await fetchTestRuns();
			
			if (result) {
				setTestRuns(result);
				calculateTestRunMetrics(result);
			}

		} catch (err) {
			console.error('Failed to load test runs:', err);
			setError('Failed to load test runs data. Please try again.');
		} finally {
			setLoading(false);
		}
	};

	// Calculate metrics from test runs
	const calculateTestRunMetrics = (runs: TestRun[]) => {
		if (runs.length === 0) {
			setMetrics(null);
			return;
		}

		const uniqueHostnames = new Set(runs.filter(r => r.hostname).map(r => r.hostname));
		const uniqueDriveModels = new Set(runs.filter(r => r.drive_model).map(r => r.drive_model));
		
		// Get common patterns and block sizes
		const patternCounts = runs.reduce((acc, run) => {
			if (run.read_write_pattern) {
				acc[run.read_write_pattern] = (acc[run.read_write_pattern] || 0) + 1;
			}
			return acc;
		}, {} as Record<string, number>);
		
		const blockSizeCounts = runs.reduce((acc, run) => {
			if (run.block_size) {
				acc[run.block_size] = (acc[run.block_size] || 0) + 1;
			}
			return acc;
		}, {} as Record<string, number>);

		const topPatterns = Object.entries(patternCounts)
			.sort(([,a], [,b]) => b - a)
			.slice(0, 3)
			.map(([pattern]) => pattern);

		const topBlockSizes = Object.entries(blockSizeCounts)
			.sort(([,a], [,b]) => b - a)
			.slice(0, 3)
			.map(([size]) => size);

		// Calculate date range
		const timestamps = runs.filter(r => r.timestamp).map(r => new Date(r.timestamp));
		const dateRange = timestamps.length > 0 
			? `${new Date(Math.min(...timestamps.map(d => d.getTime()))).toLocaleDateString()} - ${new Date(Math.max(...timestamps.map(d => d.getTime()))).toLocaleDateString()}`
			: 'No date range';

		setMetrics({
			totalRuns: runs.length,
			uniqueHostnames: uniqueHostnames.size,
			uniqueDriveModels: uniqueDriveModels.size,
			dateRange,
			commonPatterns: topPatterns,
			commonBlockSizes: topBlockSizes
		});
	};

	// Load data on component mount
	useEffect(() => {
		loadTestRuns();
	}, [refreshTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

	const handleRefresh = () => {
		setRefreshTrigger(prev => prev + 1);
	};

	const handleToggleMaximize = () => {
		setIsChartMaximized(prev => !prev);
	};

	const metricCards = [
		{
			title: "Total Test Runs",
			value: metrics?.totalRuns.toLocaleString() || "---",
			icon: Activity,
			color: "text-blue-600 dark:text-blue-400",
			description: "Total test runs in dataset"
		},
		{
			title: "Unique Hostnames",
			value: metrics?.uniqueHostnames.toString() || "---",
			icon: Server,
			color: "text-green-600 dark:text-green-400",
			description: "Different systems tested"
		},
		{
			title: "Drive Models",
			value: metrics?.uniqueDriveModels.toString() || "---",
			icon: HardDrive,
			color: "text-purple-600 dark:text-purple-400",
			description: "Different drive models tested"
		},
		{
			title: "Selected Runs",
			value: selectedRuns.length.toLocaleString() || "0",
			icon: Zap,
			color: "text-yellow-600 dark:text-yellow-400",
			description: "Currently selected test runs"
		},
		{
			title: "Common Patterns",
			value: metrics?.commonPatterns.slice(0, 2).join(', ') || "---",
			icon: TrendingUp,
			color: "text-indigo-600 dark:text-indigo-400",
			description: "Most frequent test patterns"
		},
		{
			title: "Common Block Sizes",
			value: metrics?.commonBlockSizes.slice(0, 2).join(', ') || "---",
			icon: Timer,
			color: "text-red-600 dark:text-red-400",
			description: "Most frequent block sizes"
		}
	];

	return (
		<div className="min-h-screen theme-bg-secondary transition-colors">
			<DashboardHeader />

			{/* Main Content */}
			<main className="w-full px-4 sm:px-6 lg:px-8 py-6">

				{/* Error Display */}
				{error && (
					<div className="mb-8">
						<ErrorDisplay 
							error={error} 
							onRetry={handleRefresh}
							showRetry={true}
						/>
					</div>
				)}


				{/* Test Run Selector */}
				<Card className="p-6">
					<h2 className="text-xl font-semibold theme-text-primary mb-4 flex items-center gap-2">
						<Server className="w-5 h-5" />
						Test Run Selection
					</h2>
					<TestRunSelector
						selectedRuns={selectedRuns}
						onSelectionChange={setSelectedRuns}
						refreshTrigger={refreshTrigger}
						testRuns={testRuns}
						activeFilters={activeFilters}
						filteredRuns={filteredRuns}
						onFilterChange={updateFilter}
						onClearAllFilters={clearAllFilters}
						loading={loading}
					/>
				</Card>
				{/* Graphs Section */}
				<div className="mb-8 mt-4">
					
					{/* Two Column Layout for Template Selector and Charts */}
					<div className={`w-full ${isChartMaximized ? "hidden" : "grid grid-cols-12 gap-6"}`}>
						{/* Left Column - Template Selector (25%) */}
						<div className="col-span-3">
							<TemplateSelector
								selectedTemplate={selectedTemplate}
								onTemplateSelect={setSelectedTemplate}
							/>
						</div>

						{/* Right Column - Chart Visualization (75%) */}
						<div className="col-span-9">
							{selectedTemplate ? (
								<ChartArea
									selectedTemplate={selectedTemplate}
									enhancedPerformanceData={enhancedPerformanceData}
									threeDChartData={threeDChartData}
									isChartMaximized={isChartMaximized}
									handleToggleMaximize={handleToggleMaximize}
									loading={dataLoading}
									sharedFilters={activeFilters}
								/>
							) : (
								<Card className="p-8">
									<div className="text-center">
										<TrendingUp className="w-12 h-12 mx-auto text-gray-400 mb-4" />
										<h3 className="text-lg font-semibold theme-text-primary mb-2">
											Select a Chart Template
										</h3>
										<p className="theme-text-secondary">
											Choose a chart template from the left panel to visualize your selected test runs data.
										</p>
									</div>
								</Card>
							)}
						</div>
					</div>

					{/* Maximized Chart */}
					{isChartMaximized && selectedTemplate && (
						<ChartArea
							selectedTemplate={selectedTemplate}
							enhancedPerformanceData={enhancedPerformanceData}
							threeDChartData={threeDChartData}
							isChartMaximized={isChartMaximized}
							handleToggleMaximize={handleToggleMaximize}
							loading={dataLoading}
							sharedFilters={activeFilters}
						/>
					)}
				</div>
				{/* Performance Metrics Grid */}
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8 mt-4">
					{metricCards.map((metric, index) => (
						<Card key={index} className="p-6">
							<div className="flex items-center justify-between">
								<div>
									<p className="theme-text-secondary text-sm font-medium">
										{metric.title}
									</p>
									<p className="theme-text-primary text-2xl font-bold mt-1">
										{loading ? <Loading size="sm" /> : metric.value}
									</p>
									<p className="theme-text-secondary text-xs mt-1">
										{metric.description}
									</p>
								</div>
								<div className={`${metric.color} opacity-80`}>
									<metric.icon className="w-8 h-8" />
								</div>
							</div>
						</Card>
					))}
				</div>
			</main>

			<DashboardFooter getApiDocsUrl={getApiDocsUrl} />
		</div>
		
	);
}