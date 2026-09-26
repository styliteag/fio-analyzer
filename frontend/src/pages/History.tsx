import { useCallback, useEffect, useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import {
	Chart as ChartJS,
	CategoryScale,
	LinearScale,
	PointElement,
	LineElement,
	TimeScale,
	Tooltip,
	Legend,
} from "chart.js";
import "chartjs-adapter-date-fns";
import { LineChart } from "lucide-react";
import { PageHeader, PAGE_CONTAINER } from "../components/layout";
import { Card, EmptyState, ErrorDisplay, Loading } from "../components/ui";
import HistoryControls, { ALL_SERVERS, serverId } from "../components/history/HistoryControls";
import {
	buildHistoryChartData,
	buildHistoryChartOptions,
	HISTORY_DAY_OPTIONS,
	uniqueConfigKeys,
	type HistoryRow,
} from "../components/history/historyChart";
import { fetchTimeSeriesServers, type TimeSeriesHistoryOptions } from "../services/api/timeSeries";
import { usePaginatedTimeSeriesData } from "../hooks/usePaginatedTimeSeriesData";
import { useUpdateUrlParams, useUrlList, useUrlNumber, useUrlValue, writeValue } from "../hooks/useUrlState";
import type { ServerInfo } from "../types";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, TimeScale, Tooltip, Legend);

const DEFAULT_METRICS = ["iops"];

const buildQuery = (server: string, days: number): TimeSeriesHistoryOptions => {
	const [hostname, protocol, driveModel] = server && server !== ALL_SERVERS ? server.split("|") : [];
	return {
		...(days > 0 ? { days } : {}),
		...(hostname ? { hostname } : {}),
		...(protocol ? { protocol } : {}),
		...(driveModel ? { driveModel } : {}),
	};
};

export default function History() {
	const [servers, setServers] = useState<ServerInfo[]>([]);
	const [serversLoading, setServersLoading] = useState(true);
	const [serversError, setServersError] = useState<string | null>(null);

	// Page state lives in the URL so views can be bookmarked and shared
	const [serverParam] = useUrlValue<string>("server", "");
	const updateParams = useUpdateUrlParams();
	const [days, setDays] = useUrlNumber("days", 30, HISTORY_DAY_OPTIONS.map((option) => option.value));
	const [metricParams, setMetrics] = useUrlList("metric");
	const [selectedConfigs, setSelectedConfigs] = useUrlList("cfg");
	const metrics = metricParams.length > 0 ? metricParams : DEFAULT_METRICS;

	const history = usePaginatedTimeSeriesData();
	const { fetchAllData } = history;
	const rows = history.data as HistoryRow[];

	useEffect(() => {
		fetchTimeSeriesServers().then((res) => {
			if (res.error) {
				setServersError(res.error);
			} else {
				setServers(res.data || []);
			}
			setServersLoading(false);
		});
	}, []);

	// Without an explicit choice show the host with the most tests: "all hosts" is usually too cluttered
	const busiest = [...servers].sort((a, b) => b.test_count - a.test_count)[0];
	const knownParam = serverParam === ALL_SERVERS || servers.some((item) => serverId(item) === serverParam);
	const server = knownParam ? serverParam : busiest ? serverId(busiest) : ALL_SERVERS;

	const load = useCallback(() => {
		fetchAllData(buildQuery(server, days));
	}, [fetchAllData, server, days]);

	// Reload whenever host or time range changes (metrics/configs filter client-side)
	useEffect(() => {
		if (!serversLoading) load();
	}, [load, serversLoading]);

	const configOptions = useMemo(() => uniqueConfigKeys(rows), [rows]);
	const chartData = useMemo(
		() => buildHistoryChartData(rows, selectedConfigs, metrics, server === ALL_SERVERS),
		[rows, selectedConfigs, metrics, server],
	);
	const chartOptions = useMemo(() => buildHistoryChartOptions(days, metrics), [days, metrics]);

	const loading = history.loading || serversLoading;
	const error = history.error || serversError;
	const tooManySeries = chartData.datasets.length > 40;

	const renderChart = () => {
		if (loading) {
			return (
				<div className="h-full flex flex-col items-center justify-center gap-3">
					<Loading />
					{history.progress && (
						<p className="text-sm theme-text-secondary">
							Loading {history.progress.loadedRecords.toLocaleString()} of {history.progress.totalRecords.toLocaleString()} records…
						</p>
					)}
				</div>
			);
		}
		if (metrics.length === 0 || chartData.datasets.length === 0) {
			return (
				<EmptyState
					icon={<LineChart className="h-12 w-12" />}
					title={metrics.length === 0 ? "Pick at least one metric" : "No test runs in this range"}
					description={
						metrics.length === 0
							? "Tick one or more metrics on the left."
							: "Choose a longer time range or another host. Only repeated test runs build a history."
					}
				/>
			);
		}
		return <Line data={chartData} options={chartOptions} />;
	};

	return (
		<div className={PAGE_CONTAINER}>
			<PageHeader
				title="Performance History"
				description="Track how each test configuration performs over time. Spot regressions after firmware, kernel or config changes."
			/>

			{error && (
				<div className="mb-6">
					<ErrorDisplay error={error} onRetry={load} showRetry />
				</div>
			)}

			<div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
				<Card className="p-5 lg:col-span-1 self-start">
					<HistoryControls
						servers={servers}
						serverValue={server}
						onServerChange={(value) =>
							updateParams((params) => {
								writeValue(params, "server", value);
								params.delete("cfg"); // configurations differ per host
							})
						}
						configOptions={configOptions}
						selectedConfigs={selectedConfigs}
						onConfigsChange={setSelectedConfigs}
						metrics={metrics}
						onMetricsChange={setMetrics}
						days={days}
						onDaysChange={setDays}
						loading={loading}
						onRefresh={load}
					/>
				</Card>

				<Card className="p-4 lg:col-span-3">
					{tooManySeries && !loading && (
						<p className="mb-2 text-sm theme-text-secondary">
							{chartData.datasets.length} lines shown. Pick a host or specific test configurations to reduce clutter.
						</p>
					)}
					<div className="h-[60vh] min-h-[420px]">{renderChart()}</div>
				</Card>
			</div>
		</div>
	);
}
