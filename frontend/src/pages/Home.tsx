import { useState, useMemo } from "react";
import { DashboardHeader, DashboardFooter } from "../components/layout";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Loading from "../components/ui/Loading";
import { useAuth } from "../contexts/AuthContext";
import { Activity, Database, TrendingUp, Upload, Users, Settings, BarChart3 } from "lucide-react";

interface DashboardStats {
	totalTestRuns: number;
	activeServers: number;
	avgIOPS: number;
	avgLatency: number;
	lastUpload: string;
	totalUsers: number;
}

export default function Home() {
	const { username } = useAuth();
	const [stats, setStats] = useState<DashboardStats | null>(null);
	const [loading, setLoading] = useState(false);

	// Get the correct API documentation URL based on environment
	const getApiDocsUrl = () => {
		const apiBaseUrl = import.meta.env.VITE_API_URL || "";
		if (apiBaseUrl) {
			return `${apiBaseUrl}/api-docs`;
		} else {
			return "/api-docs";
		}
	};

	// Mock stats for now - these would come from the new backend
	const mockStats: DashboardStats = useMemo(() => ({
		totalTestRuns: 1247,
		activeServers: 23,
		avgIOPS: 85432,
		avgLatency: 2.4,
		lastUpload: "2 hours ago",
		totalUsers: 8
	}), []);

	const handleLoadStats = async () => {
		setLoading(true);
		// Simulate API call
		await new Promise(resolve => setTimeout(resolve, 1000));
		setStats(mockStats);
		setLoading(false);
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
			title: "Total Users",
			value: stats?.totalUsers.toString() || "---",
			icon: Users,
			color: "text-red-600 dark:text-red-400"
		}
	];

	return (
		<div className="min-h-screen theme-bg-secondary transition-colors">
			<DashboardHeader />

			{/* Quick Access to Advanced Dashboard */}
			<div className="w-full px-4 sm:px-6 lg:px-8 pt-4 pb-2">
				<div className="flex justify-end">
					<Button
						variant="outline"
						onClick={() => window.location.href = "/dashboard"}
						className="flex items-center gap-2 text-sm"
					>
						<BarChart3 className="w-4 h-4" />
						Advanced Analytics Dashboard
					</Button>
				</div>
			</div>

			{/* Main Content */}
			<main className="w-full px-4 sm:px-6 lg:px-8 py-6">
				{/* Welcome Section */}
				<div className="mb-8">
					<h1 className="text-3xl font-bold theme-text-primary mb-2">
						Welcome back, {username || 'User'}!
					</h1>
					<p className="theme-text-secondary text-lg">
						Storage Performance Analytics Dashboard - New Backend Edition
					</p>
				</div>

				{/* Quick Actions */}
				<div className="mb-8">
					<div className="flex flex-wrap gap-4">
						<Button
							onClick={handleLoadStats}
							disabled={loading}
							className="flex items-center gap-2"
						>
							<Database className="w-4 h-4" />
							{loading ? "Loading..." : "Load Statistics"}
						</Button>
						<Button
							variant="outline"
							onClick={() => window.location.href = "/upload"}
							className="flex items-center gap-2"
						>
							<Upload className="w-4 h-4" />
							Upload Test Data
						</Button>
						<Button
							variant="outline"
							onClick={() => window.location.href = "/admin"}
							className="flex items-center gap-2"
						>
							<Settings className="w-4 h-4" />
							Admin Panel
						</Button>
					</div>
				</div>

				{/* Statistics Grid */}
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
					{statCards.map((stat, index) => (
						<Card key={index} className="p-6">
							<div className="flex items-center justify-between">
								<div>
									<p className="theme-text-secondary text-sm font-medium">
										{stat.title}
									</p>
									<p className="theme-text-primary text-2xl font-bold mt-1">
										{loading ? <Loading size="sm" /> : stat.value}
									</p>
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
							{stats ? (
								<>
									<div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
										<span className="theme-text-secondary">New test run uploaded</span>
										<span className="theme-text-primary text-sm">2 hours ago</span>
									</div>
									<div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
										<span className="theme-text-secondary">Server performance analyzed</span>
										<span className="theme-text-primary text-sm">4 hours ago</span>
									</div>
									<div className="flex items-center justify-between py-2">
										<span className="theme-text-secondary">New user registered</span>
										<span className="theme-text-primary text-sm">1 day ago</span>
									</div>
								</>
							) : (
								<p className="theme-text-secondary text-center py-8">
									Load statistics to see recent activity
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
							<div className="flex items-center justify-between">
								<span className="theme-text-secondary">Backend API</span>
								<span className="text-green-600 dark:text-green-400 font-medium">
									● Online
								</span>
							</div>
							<div className="flex items-center justify-between">
								<span className="theme-text-secondary">Database</span>
								<span className="text-green-600 dark:text-green-400 font-medium">
									● Connected
								</span>
							</div>
							<div className="flex items-center justify-between">
								<span className="theme-text-secondary">File Storage</span>
								<span className="text-green-600 dark:text-green-400 font-medium">
									● Available
								</span>
							</div>
							<div className="flex items-center justify-between">
								<span className="theme-text-secondary">Authentication</span>
								<span className="text-green-600 dark:text-green-400 font-medium">
									● Active
								</span>
							</div>
						</div>
					</Card>
				</div>

				{/* Quick Links */}
				<div className="mt-8">
					<Card className="p-6">
						<h2 className="text-xl font-semibold theme-text-primary mb-4">
							Quick Links
						</h2>
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
							<a
								href="/dashboard"
								className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
							>
								<h3 className="font-medium theme-text-primary">Classic Dashboard</h3>
								<p className="theme-text-secondary text-sm mt-1">
									Advanced analytics and visualization
								</p>
							</a>
							<a
								href="/upload"
								className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
							>
								<h3 className="font-medium theme-text-primary">Upload Data</h3>
								<p className="theme-text-secondary text-sm mt-1">
									Upload new FIO test results
								</p>
							</a>
							<a
								href={getApiDocsUrl()}
								target="_blank"
								rel="noopener noreferrer"
								className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
							>
								<h3 className="font-medium theme-text-primary">API Documentation</h3>
								<p className="theme-text-secondary text-sm mt-1">
									Interactive API reference
								</p>
							</a>
							<a
								href="/admin"
								className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
							>
								<h3 className="font-medium theme-text-primary">Admin Panel</h3>
								<p className="theme-text-secondary text-sm mt-1">
									Manage users and system settings
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