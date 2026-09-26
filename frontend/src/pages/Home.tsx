import { useCallback, useEffect, useState } from "react";
import { Activity, Database, RefreshCw, Server, TrendingUp, Upload } from "lucide-react";
import { PageHeader, PAGE_CONTAINER } from "../components/layout";
import { MetricsCard, createMetric, metricColors } from "../components/shared";
import { Button, Card, ErrorDisplay } from "../components/ui";
import TaskCards from "../components/home/TaskCards";
import GettingStarted from "../components/home/GettingStarted";
import HostsTable from "../components/home/HostsTable";
import { useAuth } from "../contexts/AuthContext";
import { useApiCall } from "../hooks";
import { fetchDashboardStats, type DashboardStats } from "../services/api/dashboard";
import { fetchTimeSeriesServers } from "../services/api/timeSeries";
import { formatLatencyMicroseconds } from "../services/data/formatters";
import type { ServerInfo } from "../types";

const loadDashboardStats = async () => {
	try {
		return { data: await fetchDashboardStats(), status: 200 };
	} catch (error) {
		return {
			error: error instanceof Error ? error.message : "Failed to load dashboard statistics",
			status: 500,
		};
	}
};

export default function Home() {
	const { username } = useAuth();
	const { data: stats, loading, error, execute } = useApiCall<DashboardStats>();
	const [servers, setServers] = useState<ServerInfo[]>([]);
	const [serversLoading, setServersLoading] = useState(true);

	const refresh = useCallback(() => {
		execute(loadDashboardStats);
		setServersLoading(true);
		fetchTimeSeriesServers()
			.then((res) => setServers(res.data || []))
			.finally(() => setServersLoading(false));
	}, [execute]);

	useEffect(() => {
		refresh();
	}, [refresh]);

	const isEmpty = !loading && !error && stats?.totalTestRuns === 0;

	const statCards = [
		createMetric("Test runs", stats?.totalTestRuns ?? "---", Database, metricColors.blue, "Latest result per host and configuration"),
		createMetric(
			"Hosts",
			stats ? `${stats.totalHostnames}` : "---",
			Server,
			metricColors.green,
			stats ? `${stats.hostnamesWithHistory} with history` : undefined,
		),
		createMetric("Last upload", stats?.lastUpload || "---", Upload, metricColors.indigo),
		createMetric("Avg IOPS", stats?.avgIOPS || "---", TrendingUp, metricColors.purple, "Across all hosts and tests"),
		createMetric(
			"Avg latency",
			stats?.avgLatency ? formatLatencyMicroseconds(stats.avgLatency).text : "---",
			Activity,
			metricColors.orange,
			"Across all hosts and tests",
		),
	];

	return (
		<div className={PAGE_CONTAINER}>
			<PageHeader
				title="Dashboard"
				description={`Welcome${username ? `, ${username}` : ""}. Pick a task below or jump straight to a host.`}
				actions={
					<Button variant="outline" size="sm" onClick={refresh} disabled={loading} title="Reload statistics">
						<RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
						Refresh
					</Button>
				}
			/>

			{error && (
				<div className="mb-8">
					<ErrorDisplay error={error} onRetry={refresh} showRetry={true} />
				</div>
			)}

			{isEmpty && <GettingStarted />}

			<TaskCards />

			{!isEmpty && (
				<>
					<div className="mb-8">
						<MetricsCard
							metrics={statCards}
							loading={loading}
							error={error}
							gridCols={{ default: 1, md: 2, lg: 5 }}
							formatNumbers={true}
							showCardLoading={true}
						/>
					</div>

					<Card className="p-6">
						<div className="flex items-baseline justify-between mb-4">
							<h2 className="text-xl font-semibold theme-text-primary">Tested hosts</h2>
							<span className="text-sm theme-text-secondary">Most recent first</span>
						</div>
						<HostsTable servers={servers} loading={serversLoading} />
					</Card>
				</>
			)}
		</div>
	);
}
