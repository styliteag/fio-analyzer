import { useEffect, useCallback } from "react";
import { DashboardHeader, DashboardFooter } from "../components/layout";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Loading from "../components/ui/Loading";
import ErrorDisplay from "../components/ui/ErrorDisplay";
import { useAuth } from "../contexts/AuthContext";
import { useApiCall } from "../hooks";
import { Activity, Database, TrendingUp, Upload, Users, Settings, RefreshCw, Zap, History, Microscope, Server } from "lucide-react";
import { fetchDashboardStats, type DashboardStats } from "../services/api/dashboard";


export default function Home() {
	const { username } = useAuth();
	
	// Memoize callback to prevent recreation
	const onError = useCallback((error: string) => {
		console.error('Dashboard stats failed:', error);
	}, []);

	// Use the standardized API call hook for dashboard stats
	const {
		data: stats,
		loading,
		error,
		execute: loadStats
	} = useApiCall<DashboardStats>({
		enableLogging: true,
		onError
	});

	// Get the correct API documentation URL based on environment
	const getApiDocsUrl = () => {
		const apiBaseUrl = import.meta.env.VITE_API_URL || "";
		if (apiBaseUrl) {
			return `${apiBaseUrl}/api-docs`;
		} else {
			return "/api-docs";
		}
	};

	// Wrapper to convert raw API call to ApiResponse format
	const loadDashboardStats = useCallback(async () => {
		try {
			const data = await fetchDashboardStats();
			return { data, status: 200 };
		} catch (error) {
			return {
				error: error instanceof Error ? error.message : 'Failed to load dashboard statistics',
				status: 500
			};
		}
	}, []);

	// Load stats on component mount
	useEffect(() => {
		loadStats(loadDashboardStats);
	}, [loadStats, loadDashboardStats]);

	const handleRefreshStats = () => {
		loadStats(loadDashboardStats);
	};

	const statCards = [
		{
			title: "Total Test Runs",
			value: stats?.totalTestRuns.toLocaleString() || "---",
			icon: Database,
			color: "text-blue-600 dark:text-blue-400"
		},
		{
			title: "Active Servers",
			value: stats?.activeServers.toString() || "---",
			icon: Activity,
			color: "text-green-600 dark:text-green-400"
		},
		{
			title: "Avg IOPS",
			value: stats?.avgIOPS.toLocaleString() || "---",
			icon: TrendingUp,
			color: "text-purple-600 dark:text-purple-400"
		},
		{
			title: "Avg Latency",
			value: stats?.avgLatency ? `${stats.avgLatency}ms` : "---",
			icon: Activity,
			color: "text-orange-600 dark:text-orange-400"
		},
		{
			title: "Last Upload",
			value: stats?.lastUpload || "---",
			icon: Upload,
			color: "text-indigo-600 dark:text-indigo-400"
		},
		{
			title: "Total Hostnames / with History",
			value: stats ? `${stats.totalHostnames} / ${stats.hostnamesWithHistory}` : "---",
			icon: Users,
			color: "text-red-600 dark:text-red-400"
		}
	];

	return (
		<div className="min-h-screen theme-bg-secondary transition-colors">
			<DashboardHeader />

			{/* Main Content */}
			<main className="w-full px-4 sm:px-6 lg:px-8 py-6">
				{/* Welcome Section */}
				<div className="mb-8">
					<h1 className="text-3xl font-bold theme-text-primary mb-2">
						Welcome back, {username || 'User'}!
					</h1>
					<p className="theme-text-secondary text-lg">
						Storage Performance Analytics Dashboard
					</p>
				</div>

				{/* Quick Actions */}
				<div className="mb-8">
					<div className="flex flex-wrap gap-4">
						<Button
							variant="outline"
							onClick={() => window.location.href = "/performance"}
							className="flex items-center gap-2"
						>
							<Zap className="w-4 h-4" />
							Performance Analytics
						</Button>
						<Button
							variant="outline"
							onClick={() => window.location.href = "/history"}
							className="flex items-center gap-2"
						>
							<History className="w-4 h-4" />
							Test History
						</Button>
						<Button
							variant="outline"
							onClick={() => window.location.href = "/compare"}
							className="flex items-center gap-2"
						>
							<Microscope className="w-4 h-4" />
							Advanced Host Comparison
						</Button>
						<Button
							variant="outline"
							onClick={() => window.location.href = "/host"}
							className="flex items-center gap-2"
						>
							<Server className="w-4 h-4" />
							Host Analysis
						</Button>
						<Button
							onClick={handleRefreshStats}
							disabled={loading}
							className="flex items-center gap-2"
						>
							<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
							{loading ? "Loading..." : "Refresh Statistics"}
						</Button>

									{/* Quick Access to Advanced Dashboard */}

					</div>
				</div>

				{/* Error Display */}
				{error && (
					<div className="mb-8">
						<ErrorDisplay 
							error={error} 
							onRetry={handleRefreshStats}
							showRetry={true}
						/>
					</div>
				)}

				{/* Statistics Grid */}
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
					{statCards.map((stat, index) => (
						<Card key={index} className="p-6">
							<div className="flex items-center justify-between">
								<div>
									<p className="theme-text-secondary text-sm font-medium">
										{stat.title}
									</p>
									<div className="theme-text-primary text-2xl font-bold mt-1">
										{loading ? <Loading size="sm" /> : stat.value}
									</div>
								</div>
								<div className={`${stat.color} opacity-80`}>
									<stat.icon className="w-8 h-8" />
								</div>
							</div>
						</Card>
					))}
				</div>

				{/* Main Content Area */}
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
					{/* Recent Activity */}
					<Card className="p-6">
						<h2 className="text-xl font-semibold theme-text-primary mb-4 flex items-center gap-2">
							<Activity className="w-5 h-5" />
							Recent Activity
						</h2>
						<div className="space-y-3">
							{loading ? (
								<div className="space-y-3">
									{Array.from({ length: 3 }).map((_, index) => (
										<div key={index} className="flex items-center justify-between py-2">
											<div className="animate-pulse h-4 bg-gray-300 rounded w-2/3 theme-bg-tertiary" />
											<div className="animate-pulse h-4 bg-gray-300 rounded w-16 theme-bg-tertiary" />
										</div>
									))}
								</div>
							) : stats && stats.recentActivity.length > 0 ? (
								stats.recentActivity.map((activity, index) => (
									<div key={index} className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-0">
										<span className="theme-text-secondary">{activity.description}</span>
										<span className="theme-text-primary text-sm">{activity.relativeTime}</span>
									</div>
								))
							) : (
								<p className="theme-text-secondary text-center py-8">
									No recent activity
								</p>
							)}
						</div>
					</Card>

					{/* System Status */}
					<Card className="p-6">
						<h2 className="text-xl font-semibold theme-text-primary mb-4 flex items-center gap-2">
							<TrendingUp className="w-5 h-5" />
							System Status
						</h2>
						<div className="space-y-4">
							{loading ? (
								<div className="space-y-4">
									{Array.from({ length: 4 }).map((_, index) => (
										<div key={index} className="flex items-center justify-between">
											<div className="animate-pulse h-4 bg-gray-300 rounded w-24 theme-bg-tertiary" />
											<div className="animate-pulse h-4 bg-gray-300 rounded w-16 theme-bg-tertiary" />
										</div>
									))}
								</div>
							) : stats ? (
								<>
									<div className="flex items-center justify-between">
										<span className="theme-text-secondary">Backend API</span>
										<span className={`font-medium ${
											stats.systemStatus.api === 'online' 
												? 'text-green-600 dark:text-green-400' 
												: stats.systemStatus.api === 'degraded'
												? 'text-yellow-600 dark:text-yellow-400'
												: 'text-red-600 dark:text-red-400'
										}`}>
											● {stats.systemStatus.api === 'online' ? 'Online' : 
												stats.systemStatus.api === 'degraded' ? 'Degraded' : 'Offline'}
										</span>
									</div>
									<div className="flex items-center justify-between">
										<span className="theme-text-secondary">Database</span>
										<span className={`font-medium ${
											stats.systemStatus.database === 'connected' 
												? 'text-green-600 dark:text-green-400' 
												: 'text-red-600 dark:text-red-400'
										}`}>
											● {stats.systemStatus.database === 'connected' ? 'Connected' : 'Error'}
										</span>
									</div>
									<div className="flex items-center justify-between">
										<span className="theme-text-secondary">File Storage</span>
										<span className={`font-medium ${
											stats.systemStatus.storage === 'available' 
												? 'text-green-600 dark:text-green-400' 
												: 'text-red-600 dark:text-red-400'
										}`}>
											● {stats.systemStatus.storage === 'available' ? 'Available' : 'Error'}
										</span>
									</div>
									<div className="flex items-center justify-between">
										<span className="theme-text-secondary">Authentication</span>
										<span className={`font-medium ${
											stats.systemStatus.auth === 'active' 
												? 'text-green-600 dark:text-green-400' 
												: 'text-red-600 dark:text-red-400'
										}`}>
											● {stats.systemStatus.auth === 'active' ? 'Active' : 'Error'}
										</span>
									</div>
								</>
							) : (
								<p className="theme-text-secondary text-center py-8">
									Unable to check system status
								</p>
							)}
						</div>
					</Card>
				</div>

				{/* Quick Links */}
				<div className="mt-8">
					<Card className="p-6">
						<h2 className="text-xl font-semibold theme-text-primary mb-4">
							Quick Links
						</h2>
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
							<a
								href="/performance"
								className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
							>
								<div className="flex items-center gap-2 mb-2">
									<Zap className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
									<h3 className="font-medium theme-text-primary">Performance Analytics</h3>
								</div>
								<p className="theme-text-secondary text-sm">
									Real-time metrics and system performance
								</p>
							</a>
							<a
								href="/history"
								className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
							>
								<div className="flex items-center gap-2 mb-2">
									<History className="w-5 h-5 text-blue-600 dark:text-blue-400" />
									<h3 className="font-medium theme-text-primary">Test History</h3>
								</div>
								<p className="theme-text-secondary text-sm">
									Browse and analyze historical test data
								</p>
							</a>
							<a
								href="/upload"
								className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
							>
								<div className="flex items-center gap-2 mb-2">
									<Upload className="w-5 h-5 text-green-600 dark:text-green-400" />
									<h3 className="font-medium theme-text-primary">Upload Data</h3>
								</div>
								<p className="theme-text-secondary text-sm">
									Upload new FIO test results
								</p>
							</a>
							<a
								href="/admin"
								className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
							>
								<div className="flex items-center gap-2 mb-2">
									<Settings className="w-5 h-5 text-red-600 dark:text-red-400" />
									<h3 className="font-medium theme-text-primary">Admin Panel</h3>
								</div>
								<p className="theme-text-secondary text-sm">
									Manage users and system settings
								</p>
							</a>
							<a
								href="/host"
								className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
							>
								<div className="flex items-center gap-2 mb-2">
									<Server className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
									<h3 className="font-medium theme-text-primary">Host Analysis</h3>
								</div>
								<p className="theme-text-secondary text-sm">
									Deep dive into individual host performance
								</p>
							</a>
							<a
								href={getApiDocsUrl()}
								target="_blank"
								rel="noopener noreferrer"
								className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
							>
								<div className="flex items-center gap-2 mb-2">
									<Database className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
									<h3 className="font-medium theme-text-primary">API Documentation</h3>
								</div>
								<p className="theme-text-secondary text-sm">
									Interactive API reference
								</p>
							</a>
						</div>
					</Card>
				</div>
			</main>

			<DashboardFooter getApiDocsUrl={getApiDocsUrl} />
		</div>
	);
}