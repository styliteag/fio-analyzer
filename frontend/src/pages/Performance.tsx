import { useState, useEffect } from "react";
import { DashboardHeader, DashboardFooter } from "../components/layout";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Loading from "../components/ui/Loading";
import ErrorDisplay from "../components/ui/ErrorDisplay";
import { useAuth } from "../contexts/AuthContext";
import { ArrowLeft, TrendingUp, Activity, Zap, Timer, HardDrive, Server } from "lucide-react";
import { fetchTimeSeriesLatest, fetchTimeSeriesServers } from "../services/api/timeSeries";
import { fetchTestRuns } from "../services/api/testRuns";
import type { ServerInfo } from "../types";

interface PerformanceMetrics {
	totalIOPS: number;
	avgLatency: number;
	maxIOPS: number;
	minLatency: number;
	activeSystems: number;
	testsToday: number;
}

export default function Performance() {
	const { } = useAuth();
	const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
	const [servers, setServers] = useState<ServerInfo[]>([]);
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

	// Load performance data
	const loadPerformanceData = async () => {
		try {
			setLoading(true);
			setError(null);

			// Fetch data in parallel
			const [latestResult, serversResult, recentRunsResult] = await Promise.allSettled([
				fetchTimeSeriesLatest(),
				fetchTimeSeriesServers(),
				fetchTestRuns({ includeHistorical: false })
			]);

			// Extract data from results
			const latest = latestResult.status === 'fulfilled' ? latestResult.value.data || [] : [];
			const serverList = serversResult.status === 'fulfilled' ? serversResult.value.data || [] : [];
			const recentRuns = recentRunsResult.status === 'fulfilled' ? recentRunsResult.value.data || [] : [];

			setServers(serverList);

			// Calculate performance metrics
			const iopsData = latest.filter(d => d.metric_type === 'iops' && d.value > 0);
			const latencyData = latest.filter(d => d.metric_type === 'avg_latency' && d.value > 0);

			const totalIOPS = iopsData.reduce((sum, d) => sum + d.value, 0);
			const avgLatency = latencyData.length > 0 
				? latencyData.reduce((sum, d) => sum + d.value, 0) / latencyData.length 
				: 0;
			const maxIOPS = iopsData.length > 0 ? Math.max(...iopsData.map(d => d.value)) : 0;
			const minLatency = latencyData.length > 0 ? Math.min(...latencyData.map(d => d.value)) : 0;
			const activeSystems = serverList.filter(s => s.test_count > 0).length;

			// Count tests from today
			const today = new Date().toISOString().split('T')[0];
			const testsToday = recentRuns.filter(run => 
				run.timestamp && run.timestamp.startsWith(today)
			).length;

			setMetrics({
				totalIOPS: Math.round(totalIOPS),
				avgLatency: Math.round(avgLatency * 10) / 10,
				maxIOPS: Math.round(maxIOPS),
				minLatency: Math.round(minLatency * 10) / 10,
				activeSystems,
				testsToday
			});

		} catch (err) {
			console.error('Failed to load performance data:', err);
			setError('Failed to load performance data. Please try again.');
		} finally {
			setLoading(false);
		}
	};

	// Load data on component mount
	useEffect(() => {
		loadPerformanceData();
	}, []);

	const handleRefresh = () => {
		loadPerformanceData();
	};

	const metricCards = [
		{
			title: "Total IOPS",
			value: metrics?.totalIOPS.toLocaleString() || "---",
			icon: Zap,
			color: "text-yellow-600 dark:text-yellow-400",
			description: "Combined IOPS across all systems"
		},
		{
			title: "Average Latency",
			value: metrics?.avgLatency ? `${metrics.avgLatency}ms` : "---",
			icon: Timer,
			color: "text-blue-600 dark:text-blue-400",
			description: "Mean response time"
		},
		{
			title: "Peak IOPS",
			value: metrics?.maxIOPS.toLocaleString() || "---",
			icon: TrendingUp,
			color: "text-green-600 dark:text-green-400",
			description: "Highest IOPS recorded"
		},
		{
			title: "Best Latency",
			value: metrics?.minLatency ? `${metrics.minLatency}ms` : "---",
			icon: Activity,
			color: "text-purple-600 dark:text-purple-400",
			description: "Lowest latency achieved"
		},
		{
			title: "Active Systems",
			value: metrics?.activeSystems.toString() || "---",
			icon: Server,
			color: "text-indigo-600 dark:text-indigo-400",
			description: "Systems with test data"
		},
		{
			title: "Tests Today",
			value: metrics?.testsToday.toString() || "---",
			icon: HardDrive,
			color: "text-red-600 dark:text-red-400",
			description: "Tests run in the last 24h"
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
						Performance Analytics
					</h1>
				</div>
			</div>

			{/* Main Content */}
			<main className="w-full px-4 sm:px-6 lg:px-8 py-6">
				{/* Page Description */}
				<div className="mb-8">
					<p className="theme-text-secondary text-lg">
						Real-time performance metrics and system analytics from your FIO testing infrastructure.
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
							Advanced Charts
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

				{/* Server Performance Summary */}
				<Card className="p-6">
					<h2 className="text-xl font-semibold theme-text-primary mb-4 flex items-center gap-2">
						<Server className="w-5 h-5" />
						Server Performance Summary
					</h2>
					<div className="space-y-4">
						{loading ? (
							<div className="space-y-3">
								{Array.from({ length: 3 }).map((_, index) => (
									<div key={index} className="flex items-center justify-between py-2">
										<div className="animate-pulse h-4 bg-gray-300 rounded w-1/3 theme-bg-tertiary" />
										<div className="animate-pulse h-4 bg-gray-300 rounded w-1/4 theme-bg-tertiary" />
									</div>
								))}
							</div>
						) : servers.length > 0 ? (
							<div className="overflow-x-auto">
								<table className="w-full">
									<thead>
										<tr className="border-b theme-border-primary">
											<th className="text-left py-2 theme-text-primary font-medium">Hostname</th>
											<th className="text-left py-2 theme-text-primary font-medium">Protocol</th>
											<th className="text-left py-2 theme-text-primary font-medium">Drive Model</th>
											<th className="text-right py-2 theme-text-primary font-medium">Test Count</th>
											<th className="text-right py-2 theme-text-primary font-medium">Last Test</th>
										</tr>
									</thead>
									<tbody>
										{servers.slice(0, 10).map((server, index) => (
											<tr key={index} className="border-b theme-border-primary last:border-0">
												<td className="py-2 theme-text-primary font-medium">{server.hostname}</td>
												<td className="py-2 theme-text-secondary">{server.protocol}</td>
												<td className="py-2 theme-text-secondary">{server.drive_model}</td>
												<td className="py-2 theme-text-secondary text-right">{server.test_count}</td>
												<td className="py-2 theme-text-secondary text-right">
													{server.last_test_time ? new Date(server.last_test_time).toLocaleDateString() : 'N/A'}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						) : (
							<p className="theme-text-secondary text-center py-8">
								No server data available
							</p>
						)}
					</div>
				</Card>
			</main>

			<DashboardFooter getApiDocsUrl={getApiDocsUrl} />
		</div>
	);
}