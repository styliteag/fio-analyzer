import { useState, useEffect } from "react";
import { DashboardHeader, DashboardFooter } from "../components/layout";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Loading from "../components/ui/Loading";
import ErrorDisplay from "../components/ui/ErrorDisplay";
import TestRunSelector from "../components/TestRunSelector";
import { useAuth } from "../contexts/AuthContext";
import { useTestRunFilters } from "../hooks/useTestRunFilters";
import { ArrowLeft, TrendingUp, Activity, Zap, Timer, HardDrive, Server } from "lucide-react";
import { fetchTestRuns } from "../services/api/testRuns";
import type { TestRun } from "../types";

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

	// Filter state for test runs
	const {
		activeFilters,
		filteredRuns,
		hasActiveFilters,
		updateFilter,
		clearAllFilters,
	} = useTestRunFilters(testRuns);

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

			const result = await fetchTestRuns({ includeHistorical: true });
			
			if (result.error) {
				setError(result.error);
			} else if (result.data) {
				setTestRuns(result.data);
				calculateTestRunMetrics(result.data);
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

			{/* Navigation */}
			<div className="w-full px-4 sm:px-6 lg:px-8 pt-4 pb-2">
				<div className="flex items-center gap-4">
					<Button
						variant="outline"
						onClick={() => window.location.href = "/"}
						className="flex items-center gap-2"
					>
						<ArrowLeft className="w-4 h-4" />
						Back to Home
					</Button>
					<h1 className="text-2xl font-bold theme-text-primary">
						Test Run Analytics
					</h1>
				</div>
			</div>

			{/* Main Content */}
			<main className="w-full px-4 sm:px-6 lg:px-8 py-6">
				{/* Page Description */}
				<div className="mb-8">
					<p className="theme-text-secondary text-lg">
						Analyze and explore your FIO test runs data. Select specific test runs to examine patterns, configurations, and system characteristics.
					</p>
				</div>

				{/* Actions */}
				<div className="mb-8">
					<div className="flex flex-wrap gap-4">
						<Button
							onClick={handleRefresh}
							disabled={loading}
							className="flex items-center gap-2"
						>
							<Activity className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
							{loading ? "Loading..." : "Refresh Data"}
						</Button>
						<Button
							variant="outline"
							onClick={() => window.location.href = "/dashboard"}
							className="flex items-center gap-2"
						>
							<TrendingUp className="w-4 h-4" />
							Visualize Data
						</Button>
					</div>
				</div>

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

				{/* Performance Metrics Grid */}
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
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
						hasActiveFilters={hasActiveFilters()}
						onFilterChange={updateFilter}
						onClearAllFilters={clearAllFilters}
						loading={loading}
					/>
				</Card>
			</main>

			<DashboardFooter getApiDocsUrl={getApiDocsUrl} />
		</div>
	);
}