import { Activity, Database, Download, LogOut, Upload, Book } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ChartContainer } from "../components/charts";
import TemplateSelector from "../components/TemplateSelector";
import TestRunSelector from "../components/TestRunSelector";
import ThemeToggle from "../components/ThemeToggle";
import ThreeDBarChart from "../components/ThreeDBarChart";
import TimeSeriesChart from "../components/TimeSeriesChart";
import { useAuth } from "../contexts/AuthContext";
import { usePerformanceData } from "../hooks";
import type { ChartTemplate, TestRun } from "../types";

export default function Dashboard() {
	const navigate = useNavigate();
	const { username, logout } = useAuth();
	
	// Get the correct API documentation URL based on environment
	const getApiDocsUrl = () => {
		const apiBaseUrl = import.meta.env.VITE_API_URL || "";
		if (apiBaseUrl) {
			// In Docker/production, use the configured API URL
			return `${apiBaseUrl}/api-docs`;
		} else {
			// In development, use relative path which resolves to localhost:8000
			return "/api-docs";
		}
	};
	const [selectedRuns, setSelectedRuns] = useState<TestRun[]>([]);
	const [selectedTemplate, setSelectedTemplate] =
		useState<ChartTemplate | null>(null);
	const [refreshTrigger, setRefreshTrigger] = useState(0);
	const [isChartMaximized, setIsChartMaximized] = useState(false);

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

	// Use new performance data hook with stable options
	const hookOptions = useMemo(() => ({
		testRunIds,
		metricTypes,
		autoFetch: shouldAutoFetch,
	}), [testRunIds, metricTypes, shouldAutoFetch]);
	
	const { data: performanceData, loading } = usePerformanceData(hookOptions);

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
			return {
				blocksize: d.block_size,
				queuedepth: d.queue_depth,
				iops: metrics?.combined?.iops?.value,
				latency: latency_percentiles?.combined?.p95?.value,
				throughput: undefined,
			};
		});
	}, [enhancedPerformanceData]);

	// Memoize toggle maximize handler
	const handleToggleMaximize = useMemo(() => 
		() => setIsChartMaximized(!isChartMaximized), 
		[isChartMaximized]
	);

	useEffect(() => {
		// Refresh data when navigating back to dashboard
		const handleFocus = () => {
			setRefreshTrigger((prev) => prev + 1);
		};

		window.addEventListener("focus", handleFocus);
		return () => window.removeEventListener("focus", handleFocus);
	}, []);

	return (
		<div className="min-h-screen theme-bg-secondary transition-colors">
			{/* Header */}
			<header className="theme-header shadow-sm">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex items-center justify-between h-16">
						<div className="flex items-center">
							<Activity className="h-8 w-8 theme-text-accent mr-3" />
							<h1 className="text-2xl font-bold theme-text-primary">
								Storage Performance Visualizer
							</h1>
						</div>
						<div className="flex items-center space-x-4">
							<ThemeToggle />
							<button
								type="button"
								onClick={() => navigate("/upload")}
								className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md theme-btn-primary transition-colors"
							>
								<Upload className="h-4 w-4 mr-2" />
								Upload
							</button>
							<div className="flex items-center text-sm theme-text-secondary mr-4">
								<Database className="h-4 w-4 mr-1" />
								FIO Benchmark Analysis
							</div>
							<div className="flex items-center space-x-2">
								<span className="text-sm theme-text-secondary">
									Welcome, {username}
								</span>
								<button
									type="button"
									onClick={logout}
									className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md theme-text-secondary hover:theme-text-primary transition-colors"
									title="Logout"
								>
									<LogOut className="h-4 w-4" />
								</button>
							</div>
						</div>
					</div>
				</div>
			</header>

			{/* Main Content */}
			<main className="w-full px-4 sm:px-6 lg:px-8 py-8">
				{/* Test Run Selection */}
				<div className="w-full mb-8">
					<TestRunSelector
						selectedRuns={selectedRuns}
						onSelectionChange={setSelectedRuns}
						refreshTrigger={refreshTrigger}
					/>
				</div>

				{/* Two Column Layout for Templates and Graphs */}
				<div
					className={`w-full ${isChartMaximized ? "hidden" : "grid grid-cols-10 gap-8"}`}
				>
					{/* Left Column - Templates (30%) */}
					<div className="col-span-3">
						<TemplateSelector
							selectedTemplate={selectedTemplate}
							onTemplateSelect={setSelectedTemplate}
						/>
					</div>

					{/* Right Column - Chart (70%) */}
					<div className="col-span-7">
						{selectedTemplate && (
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
									/>
								) : selectedTemplate.chartType === '3d-bar' ? (
									<ThreeDBarChart 
										data={threeDChartData} 
										isMaximized={isChartMaximized}
										onToggleMaximize={handleToggleMaximize}
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
						)}
					</div>
				</div>

				{/* Maximized Chart */}
				{isChartMaximized && selectedTemplate && (
					selectedTemplate.chartType === 'time-series' ? (
						<TimeSeriesChart
							isMaximized={isChartMaximized}
							onToggleMaximize={handleToggleMaximize}
						/>
					) : selectedTemplate.chartType === '3d-bar' ? (
						<ThreeDBarChart 
							data={threeDChartData} 
							isMaximized={isChartMaximized}
							onToggleMaximize={handleToggleMaximize}
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
					)
				)}

				{/* Instructions */}
				{selectedRuns.length === 0 && !isChartMaximized && (
					<div className="theme-bg-accent border theme-border-accent rounded-lg p-6 text-center mt-8">
						<Activity className="h-12 w-12 theme-text-accent mx-auto mb-4" />
						<h3 className="text-lg font-medium theme-text-accent mb-2">
							Get Started with Performance Analysis
						</h3>
						<p className="theme-text-accent mb-4">
							Select test runs from the dropdown above to begin visualizing your
							storage performance data.
						</p>
						<div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
							<div className="theme-bg-card p-4 rounded border theme-border-accent">
								<div className="font-medium theme-text-accent mb-1">
									1. Select Test Runs
								</div>
								<div className="theme-text-accent">
									Choose benchmark results to compare
								</div>
							</div>
							<div className="theme-bg-card p-4 rounded border theme-border-accent">
								<div className="font-medium theme-text-accent mb-1">
									2. Pick a Template
								</div>
								<div className="theme-text-accent">
									Select visualization type for your analysis
								</div>
							</div>
							<div className="theme-bg-card p-4 rounded border theme-border-accent">
								<div className="font-medium theme-text-accent mb-1">
									3. Analyze Results
								</div>
								<div className="theme-text-accent">
									Interactive charts with export options
								</div>
							</div>
						</div>

						<div className="mt-6">
							<button
								type="button"
								onClick={() => navigate("/upload")}
								className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md theme-btn-primary transition-colors"
							>
								<Upload className="h-5 w-5 mr-2" />
								Upload FIO Results
							</button>
						</div>
					</div>
				)}
			</main>

			{/* Footer */}
			<footer className="theme-header mt-12">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
					<div className="text-center">
						<div className="text-sm theme-text-secondary mb-4">
							<p>
								Storage Performance Visualizer - Analyze FIO benchmark results
								with interactive charts
							</p>
							<p className="mt-1">
								Features: Multi-drive comparison, latency analysis, throughput
								trends, and more
							</p>
						</div>

						{/* Download Links */}
						<div className="flex justify-center items-center space-x-6 text-sm">
							<a
								href="/script.sh"
								className="inline-flex items-center px-3 py-2 theme-text-secondary hover:theme-text-primary transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
								title="Download FIO testing script"
							>
								<Download className="h-4 w-4 mr-2" />
								Testing Script
							</a>
							<span className="theme-text-secondary">•</span>
							<a
								href="/env.example"
								download
								className="inline-flex items-center px-3 py-2 theme-text-secondary hover:theme-text-primary transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
								title="Download configuration template"
							>
								<Download className="h-4 w-4 mr-2" />
								Config Template
							</a>
							<span className="theme-text-secondary">•</span>
							<a
								href={getApiDocsUrl()}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center px-3 py-2 theme-text-secondary hover:theme-text-primary transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
								title="View interactive API documentation"
							>
								<Book className="h-4 w-4 mr-2" />
								API Docs
							</a>
						</div>

						<div className="mt-2 text-xs theme-text-secondary">
							Download scripts to run automated FIO tests • View API documentation for integration
						</div>
					</div>
				</div>
			</footer>
		</div>
	);
}
