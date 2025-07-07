import { useState, useEffect } from "react";
import { DashboardHeader, DashboardFooter } from "../components/layout";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Loading from "../components/ui/Loading";
import ErrorDisplay from "../components/ui/ErrorDisplay";
import { useAuth } from "../contexts/AuthContext";
import { ArrowLeft, History as HistoryIcon, Calendar, Filter, Download, Search, Clock } from "lucide-react";
import { fetchTestRuns } from "../services/api/testRuns";
import type { TestRun } from "../types";

interface HistoryStats {
	totalTests: number;
	oldestTest: string;
	newestTest: string;
	uniqueHosts: number;
	testsByMonth: { [key: string]: number };
}

export default function History() {
	const { } = useAuth();
	const [historyStats, setHistoryStats] = useState<HistoryStats | null>(null);
	const [recentTests, setRecentTests] = useState<TestRun[]>([]);
	const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Get the correct API documentation URL based on environment
	const getApiDocsUrl = () => {
		const apiBaseUrl = import.meta.env.VITE_API_URL || "";
		if (apiBaseUrl) {
			return `${apiBaseUrl}/api-docs`;
		} else {
			return "/api-docs";
		}
	};

	// Load history data
	const loadHistoryData = async () => {
		try {
			setLoading(true);
			setError(null);

			// Calculate date range
			const now = new Date();
			let startDate: Date | undefined;
			
			switch (timeRange) {
				case '7d':
					startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
					break;
				case '30d':
					startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
					break;
				case '90d':
					startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
					break;
				default:
					startDate = undefined;
			}

			// Fetch historical test runs
			const testRunsResult = await fetchTestRuns({ 
				includeHistorical: true 
			});

			let allTests = testRunsResult.data || [];

			// Filter by time range if specified
			if (startDate) {
				allTests = allTests.filter(test => 
					test.timestamp && new Date(test.timestamp) >= startDate!
				);
			}

			// Sort by timestamp (newest first)
			const sortedTests = allTests
				.filter(test => test.timestamp)
				.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

			setRecentTests(sortedTests.slice(0, 50)); // Show latest 50 tests

			// Calculate statistics
			if (sortedTests.length > 0) {
				const timestamps = sortedTests.map(t => new Date(t.timestamp));
				const uniqueHosts = new Set(sortedTests
					.filter(t => t.hostname)
					.map(t => t.hostname)
				);

				// Group tests by month for trending
				const testsByMonth: { [key: string]: number } = {};
				sortedTests.forEach(test => {
					const date = new Date(test.timestamp);
					const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
					testsByMonth[monthKey] = (testsByMonth[monthKey] || 0) + 1;
				});

				setHistoryStats({
					totalTests: sortedTests.length,
					oldestTest: Math.min(...timestamps.map(d => d.getTime())).toString(),
					newestTest: Math.max(...timestamps.map(d => d.getTime())).toString(),
					uniqueHosts: uniqueHosts.size,
					testsByMonth
				});
			} else {
				setHistoryStats({
					totalTests: 0,
					oldestTest: '',
					newestTest: '',
					uniqueHosts: 0,
					testsByMonth: {}
				});
			}

		} catch (err) {
			console.error('Failed to load history data:', err);
			setError('Failed to load history data. Please try again.');
		} finally {
			setLoading(false);
		}
	};

	// Load data on component mount and when time range changes
	useEffect(() => {
		loadHistoryData();
	}, [timeRange]);

	const handleRefresh = () => {
		loadHistoryData();
	};

	const formatRelativeTime = (timestamp: string): string => {
		const now = new Date();
		const past = new Date(timestamp);
		const diffMs = now.getTime() - past.getTime();
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
		const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
		
		if (diffDays > 30) {
			return past.toLocaleDateString();
		} else if (diffDays > 0) {
			return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
		} else if (diffHours > 0) {
			return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
		} else {
			return 'Recent';
		}
	};

	const timeRangeOptions = [
		{ value: '7d' as const, label: 'Last 7 days' },
		{ value: '30d' as const, label: 'Last 30 days' },
		{ value: '90d' as const, label: 'Last 90 days' },
		{ value: 'all' as const, label: 'All time' }
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
						Test History
					</h1>
				</div>
			</div>

			{/* Main Content */}
			<main className="w-full px-4 sm:px-6 lg:px-8 py-6">
				{/* Page Description */}
				<div className="mb-8">
					<p className="theme-text-secondary text-lg">
						Browse and analyze your historical FIO test results and performance trends over time.
					</p>
				</div>

				{/* Controls */}
				<div className="mb-8">
					<div className="flex flex-wrap gap-4 items-center">
						<Button
							onClick={handleRefresh}
							disabled={loading}
							className="flex items-center gap-2"
						>
							<HistoryIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
							{loading ? "Loading..." : "Refresh"}
						</Button>

						{/* Time Range Selector */}
						<div className="flex items-center gap-2">
							<Calendar className="w-4 h-4 theme-text-secondary" />
							<span className="theme-text-secondary text-sm">Time Range:</span>
							<select
								value={timeRange}
								onChange={(e) => setTimeRange(e.target.value as any)}
								className="px-3 py-1 rounded border theme-border-primary theme-bg-primary theme-text-primary text-sm"
							>
								{timeRangeOptions.map(option => (
									<option key={option.value} value={option.value}>
										{option.label}
									</option>
								))}
							</select>
						</div>

						<Button
							variant="outline"
							onClick={() => window.location.href = "/admin"}
							className="flex items-center gap-2"
						>
							<Filter className="w-4 h-4" />
							Advanced Filters
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

				{/* History Statistics */}
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
					<Card className="p-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="theme-text-secondary text-sm font-medium">
									Total Tests
								</p>
								<p className="theme-text-primary text-2xl font-bold mt-1">
									{loading ? <Loading size="sm" /> : historyStats?.totalTests.toLocaleString() || "---"}
								</p>
							</div>
							<div className="text-blue-600 dark:text-blue-400 opacity-80">
								<HistoryIcon className="w-8 h-8" />
							</div>
						</div>
					</Card>

					<Card className="p-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="theme-text-secondary text-sm font-medium">
									Unique Hosts
								</p>
								<p className="theme-text-primary text-2xl font-bold mt-1">
									{loading ? <Loading size="sm" /> : historyStats?.uniqueHosts.toString() || "---"}
								</p>
							</div>
							<div className="text-green-600 dark:text-green-400 opacity-80">
								<Search className="w-8 h-8" />
							</div>
						</div>
					</Card>

					<Card className="p-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="theme-text-secondary text-sm font-medium">
									Oldest Test
								</p>
								<p className="theme-text-primary text-lg font-bold mt-1">
									{loading ? <Loading size="sm" /> : 
										historyStats?.oldestTest ? 
											new Date(parseInt(historyStats.oldestTest)).toLocaleDateString() : 
											"---"
									}
								</p>
							</div>
							<div className="text-purple-600 dark:text-purple-400 opacity-80">
								<Clock className="w-8 h-8" />
							</div>
						</div>
					</Card>

					<Card className="p-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="theme-text-secondary text-sm font-medium">
									Latest Test
								</p>
								<p className="theme-text-primary text-lg font-bold mt-1">
									{loading ? <Loading size="sm" /> : 
										historyStats?.newestTest ? 
											formatRelativeTime(new Date(parseInt(historyStats.newestTest)).toISOString()) : 
											"---"
									}
								</p>
							</div>
							<div className="text-orange-600 dark:text-orange-400 opacity-80">
								<Calendar className="w-8 h-8" />
							</div>
						</div>
					</Card>
				</div>

				{/* Recent Tests Table */}
				<Card className="p-6">
					<div className="flex items-center justify-between mb-4">
						<h2 className="text-xl font-semibold theme-text-primary flex items-center gap-2">
							<HistoryIcon className="w-5 h-5" />
							Recent Test History
						</h2>
						<Button
							variant="outline"
							className="flex items-center gap-2"
						>
							<Download className="w-4 h-4" />
							Export
						</Button>
					</div>
					
					<div className="space-y-4">
						{loading ? (
							<div className="space-y-3">
								{Array.from({ length: 5 }).map((_, index) => (
									<div key={index} className="flex items-center justify-between py-3 border-b theme-border-primary">
										<div className="flex items-center space-x-4">
											<div className="animate-pulse h-4 bg-gray-300 rounded w-24 theme-bg-tertiary" />
											<div className="animate-pulse h-4 bg-gray-300 rounded w-32 theme-bg-tertiary" />
											<div className="animate-pulse h-4 bg-gray-300 rounded w-20 theme-bg-tertiary" />
										</div>
										<div className="animate-pulse h-4 bg-gray-300 rounded w-16 theme-bg-tertiary" />
									</div>
								))}
							</div>
						) : recentTests.length > 0 ? (
							<div className="overflow-x-auto">
								<table className="w-full">
									<thead>
										<tr className="border-b theme-border-primary">
											<th className="text-left py-2 theme-text-primary font-medium">Date</th>
											<th className="text-left py-2 theme-text-primary font-medium">Hostname</th>
											<th className="text-left py-2 theme-text-primary font-medium">Test Name</th>
											<th className="text-left py-2 theme-text-primary font-medium">Pattern</th>
											<th className="text-left py-2 theme-text-primary font-medium">Block Size</th>
											<th className="text-left py-2 theme-text-primary font-medium">Drive Type</th>
											<th className="text-right py-2 theme-text-primary font-medium">Duration</th>
										</tr>
									</thead>
									<tbody>
										{recentTests.map((test, index) => (
											<tr key={test.id || index} className="border-b theme-border-primary last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
												<td className="py-3 theme-text-secondary">
													{formatRelativeTime(test.timestamp)}
												</td>
												<td className="py-3 theme-text-primary font-medium">
													{test.hostname || 'Unknown'}
												</td>
												<td className="py-3 theme-text-secondary">
													{test.test_name || test.description || 'N/A'}
												</td>
												<td className="py-3 theme-text-secondary">
													{test.read_write_pattern}
												</td>
												<td className="py-3 theme-text-secondary">
													{test.block_size}
												</td>
												<td className="py-3 theme-text-secondary">
													{test.drive_type || 'N/A'}
												</td>
												<td className="py-3 theme-text-secondary text-right">
													{test.duration ? `${test.duration}s` : 'N/A'}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						) : (
							<p className="theme-text-secondary text-center py-8">
								No test history found for the selected time range
							</p>
						)}
					</div>
				</Card>
			</main>

			<DashboardFooter getApiDocsUrl={getApiDocsUrl} />
		</div>
	);
}