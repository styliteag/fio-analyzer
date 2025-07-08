import { useEffect, useState, useMemo } from "react";
import TemplateSelector from "../components/TemplateSelector";
import TestRunSelector from "../components/TestRunSelector";
import { DashboardHeader, DashboardFooter, WelcomeGuide, ChartArea } from "../components/layout";
import { usePerformanceData } from "../hooks";
import { useTestRunFilters } from "../hooks/useTestRunFilters";
import { useServerSideTestRuns } from "../hooks/useServerSideTestRuns";
import { fetchTestRuns } from "../services/api/testRuns";
import type { ChartTemplate, TestRun } from "../types";

export default function Dashboard() {
	// Feature flag for server-side filtering (can be toggled by environment or user preference)
	const useServerSideFiltering = false; // Set to true to enable server-side filtering
	
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
	
	// Shared state for test runs and filters (lifted up from TestRunSelector)
	const [testRuns, setTestRuns] = useState<TestRun[]>([]);
	const [filtersLoading, setFiltersLoading] = useState(true);

	// Traditional client-side filtering
	const {
		activeFilters: clientFilters,
		filteredRuns: clientFilteredRuns,
		hasActiveFilters: _clientHasActiveFilters, // eslint-disable-line @typescript-eslint/no-unused-vars
		updateFilter: clientUpdateFilter,
		clearAllFilters: clientClearAllFilters,
	} = useTestRunFilters(testRuns);

	// Server-side filtering hook
	const {
		testRuns: serverTestRuns,
		activeFilters: serverFilters,
		setActiveFilters: setServerFilters,
		clearFilters: clearServerFilters,
		hasActiveFilters: _serverHasActiveFilters, // eslint-disable-line @typescript-eslint/no-unused-vars
		loading: serverLoading,
		error: _serverError, // eslint-disable-line @typescript-eslint/no-unused-vars
		filters: _serverFilterOptions // eslint-disable-line @typescript-eslint/no-unused-vars
	} = useServerSideTestRuns({ 
		autoFetch: useServerSideFiltering 
	});

	// Choose data source based on feature flag
	const activeFilters = useServerSideFiltering ? serverFilters : clientFilters;
	const filteredRuns = useServerSideFiltering ? serverTestRuns : clientFilteredRuns;
	const updateFilter = useServerSideFiltering ? 
		(filterType: any, values: any) => setServerFilters({...serverFilters, [filterType]: values}) : 
		clientUpdateFilter;
	const clearAllFilters = useServerSideFiltering ? clearServerFilters : clientClearAllFilters;
	const dataLoading = useServerSideFiltering ? serverLoading : filtersLoading;
	const allTestRuns = useServerSideFiltering ? serverTestRuns : testRuns;

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

	// Memoize toggle maximize handler
	const handleToggleMaximize = useMemo(() => 
		() => setIsChartMaximized(!isChartMaximized), 
		[isChartMaximized]
	);

	// Load test runs function (only for client-side filtering mode)
	const loadTestRuns = useMemo(() => async () => {
		if (useServerSideFiltering) {
			// Server-side filtering handles data loading via useServerSideTestRuns hook
			setFiltersLoading(false);
			return;
		}
		
		try {
			setFiltersLoading(true);
			const result = await fetchTestRuns();
			if (result.data) {
				setTestRuns(result.data);
			}
		} catch (err) {
			console.error('Failed to load test runs:', err);
		} finally {
			setFiltersLoading(false);
		}
	}, [useServerSideFiltering]);

	// Load test runs on mount and refresh trigger (only for client-side mode)
	useEffect(() => {
		loadTestRuns();
	}, [loadTestRuns, refreshTrigger]);

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
			<DashboardHeader />

			{/* Main Content */}
			<main className="w-full px-4 sm:px-6 lg:px-8 py-8">
				{/* Test Run Selection */}
				<div className="w-full mb-8">
					<TestRunSelector
						selectedRuns={selectedRuns}
						onSelectionChange={setSelectedRuns}
						refreshTrigger={refreshTrigger}
						// Pass shared filter state
						testRuns={allTestRuns}
						activeFilters={activeFilters}
						filteredRuns={filteredRuns}
						onFilterChange={updateFilter}
						onClearAllFilters={clearAllFilters}
						// Pass loading state
						loading={dataLoading}
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
							<ChartArea
								selectedTemplate={selectedTemplate}
								enhancedPerformanceData={enhancedPerformanceData}
								threeDChartData={threeDChartData}
								isChartMaximized={isChartMaximized}
								handleToggleMaximize={handleToggleMaximize}
								loading={loading}
								// Pass shared filter state for time-series charts
								sharedFilters={activeFilters}
							/>
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
						loading={loading}
						// Pass shared filter state for time-series charts
						sharedFilters={activeFilters}
					/>
				)}

				{/* Welcome Guide */}
				{selectedRuns.length === 0 && !isChartMaximized && (
					<WelcomeGuide />
				)}
			</main>

			<DashboardFooter getApiDocsUrl={getApiDocsUrl} />
		</div>
	);
}
