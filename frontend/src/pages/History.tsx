import { useEffect, useMemo, useState, useCallback } from "react";
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
import { DashboardHeader, DashboardFooter } from "../components/layout";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Loading from "../components/ui/Loading";
import ErrorDisplay from "../components/ui/ErrorDisplay";
import {
	fetchTimeSeriesHistory,
	fetchTimeSeriesServers,
	getTimeSeriesMetricTypes,
} from "../services/api/timeSeries";
import type { TimeSeriesDataPoint, ServerInfo } from "../types";

// Register chart.js pieces once
ChartJS.register(
	CategoryScale,
	LinearScale,
	PointElement,
	LineElement,
	TimeScale,
	Tooltip,
	Legend,
);

export default function History() {
	const [servers, setServers] = useState<ServerInfo[]>([]);
	const [selectedServerId, setSelectedServerId] = useState<string>("");
	const [configOptions, setConfigOptions] = useState<string[]>([]);
	const [selectedConfig, setSelectedConfig] = useState<string>("");
	const [metric, setMetric] = useState("iops");
	const [days, setDays] = useState(30);
	const [data, setData] = useState<TimeSeriesDataPoint[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Helper for footer links
	const getApiDocsUrl = () => {
		const apiBaseUrl = import.meta.env.VITE_API_URL || "";
		return apiBaseUrl ? `${apiBaseUrl}/api-docs` : "/api-docs";
	};

	const getServerId = (s: ServerInfo) => `${s.hostname}|${s.protocol}|${s.drive_model}`;

	// Fetch list of servers once
	useEffect(() => {
		const fetchServers = async () => {
			const res = await fetchTimeSeriesServers();
			if (!res.error) {
				setServers(res.data || []);
			}
		};
		fetchServers();
	}, []);

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);

		const opts: any = { metricType: metric, days };
		if (selectedServerId) {
			const parts = selectedServerId.split("|");
			const hostname = parts[0];
			const protocol = parts[1];
			const drive_model = parts[2];
			
			opts.hostname = hostname;
			// Only add protocol/drive_model if they're not undefined
			if (protocol && protocol !== 'undefined') {
				opts.protocol = protocol;
			}
			if (drive_model && drive_model !== 'undefined') {
				opts.driveModel = drive_model;
			}
		}
		if (selectedConfig) {
			const [pattern, bs, qd] = selectedConfig.split("|");
			opts.readWritePattern = pattern;
			opts.blockSize = bs;
			opts.queueDepth = parseInt(qd, 10);
		}

		const res = await fetchTimeSeriesHistory(opts);
		if (res.error) {
			setError(res.error);
			setData([]);
			setConfigOptions([]);
		} else {
			const newData = res.data || [];
			setData(newData);
			// Recompute config options
			const unique = new Set<string>();
			newData.forEach((d) => {
				unique.add(`${d.read_write_pattern}|${d.block_size}|${d.queue_depth}`);
			});
			setConfigOptions(Array.from(unique));
			// Reset selectedConfig if no longer valid
			if (selectedConfig && !unique.has(selectedConfig)) {
				setSelectedConfig("");
			}
		}
		setLoading(false);
	}, [metric, days, selectedServerId, selectedConfig]);

	// Reload when dependencies change
	useEffect(() => {
		load();
	}, [load]);

	// Build chart.js dataset structure
	const chartData = useMemo(() => {
		const filtered = selectedConfig
			? data.filter((d) => `${d.read_write_pattern}|${d.block_size}|${d.queue_depth}` === selectedConfig)
			: data;

		const palette = [
			"#3b82f6",
			"#10b981",
			"#f59e0b",
			"#ef4444",
			"#8b5cf6",
			"#ec4899",
			"#14b8a6",
		];
		const map: Record<string, { label: string; data: { x: string; y: number }[]; color: string }> = {};
		let colorIdx = 0;
		filtered.forEach((d) => {
			const key = `${d.hostname || "unknown"}-${d.drive_model}`;
			if (!map[key]) {
				map[key] = {
					label: key,
					data: [],
					color: palette[colorIdx % palette.length],
				};
				colorIdx += 1;
			}
			map[key].data.push({ x: d.timestamp, y: d.value });
		});
		return {
			datasets: Object.values(map).map((ds) => ({
				label: ds.label,
				data: ds.data,
				borderColor: ds.color,
				backgroundColor: ds.color,
				fill: false,
				tension: 0.3,
				pointRadius: 1,
				pointHoverRadius: 3,
			})),
		};
	}, [data, selectedConfig]);

	const chartOptions = useMemo(() => {
		const timeUnit: "day" | "week" = days <= 7 ? "day" : "week";
		return {
			responsive: true,
			maintainAspectRatio: false,
			scales: {
				x: {
					type: "time" as const,
					time: { unit: timeUnit },
					title: { display: true, text: "Time" },
				},
				y: {
					beginAtZero: false,
					title: { display: true, text: metric.toUpperCase() },
				},
			},
			plugins: {
				legend: { display: true, position: "bottom" as const },
			},
		} as const;
	}, [days, metric]);

	return (
		<div className="h-screen theme-bg-secondary flex">
			{/* Sidebar with controls */}
			<div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-6 overflow-y-auto">
				<h2 className="text-xl font-bold theme-text-primary mb-6">History Controls</h2>
				
				<div className="space-y-4">
					<div>
						<label className="block text-sm font-medium theme-text-primary mb-2">Server</label>
						<select
							value={selectedServerId}
							onChange={(e) => setSelectedServerId(e.target.value)}
							className="w-full px-3 py-2 border rounded theme-bg-primary theme-text-primary"
						>
							<option value="">All Servers</option>
							{servers.map((s) => (
								<option key={getServerId(s)} value={getServerId(s)}>
									{s.hostname} • {s.protocol} • {s.drive_model}
								</option>
							))}
						</select>
					</div>

					{configOptions.length > 0 && (
						<div>
							<label className="block text-sm font-medium theme-text-primary mb-2">Test Configuration</label>
							<select
								value={selectedConfig}
								onChange={(e) => setSelectedConfig(e.target.value)}
								className="w-full px-3 py-2 border rounded theme-bg-primary theme-text-primary"
							>
								<option value="">All Test Runs</option>
								{configOptions.map((c) => {
									const [pattern, bs, qd] = c.split("|");
									return (
										<option key={c} value={c}>
											{pattern} / {bs} / qd{qd}
										</option>
									);
								})}
							</select>
						</div>
					)}

					<div>
						<label className="block text-sm font-medium theme-text-primary mb-2">Metric</label>
						<select
							value={metric}
							onChange={(e) => setMetric(e.target.value)}
							className="w-full px-3 py-2 border rounded theme-bg-primary theme-text-primary"
						>
							{getTimeSeriesMetricTypes().map((m) => (
								<option key={m.value} value={m.value}>
									{m.label}
								</option>
							))}
						</select>
					</div>

					<div>
						<label className="block text-sm font-medium theme-text-primary mb-2">Time Range</label>
						<select
							value={days}
							onChange={(e) => setDays(parseInt(e.target.value, 10))}
							className="w-full px-3 py-2 border rounded theme-bg-primary theme-text-primary"
						>
							{[7, 30, 90, 365].map((d) => (
								<option key={d} value={d}>
									Last {d} days
								</option>
							))}
						</select>
					</div>

					<Button onClick={load} disabled={loading} className="w-full">
						{loading ? "Loading..." : "Refresh Data"}
					</Button>
				</div>

				{error && (
					<div className="mt-4">
						<ErrorDisplay error={error} onRetry={load} showRetry />
					</div>
				)}
			</div>

			{/* Main chart area */}
			<div className="flex-1 flex flex-col">
				<DashboardHeader />
				<div className="flex-1 p-4 flex flex-col">
					<Card className="flex-1 p-2">
						<div className="h-full w-full" style={{ minHeight: '600px' }}>
							{loading ? (
								<Loading />
							) : (
								<Line data={chartData} options={chartOptions} />
							)}
						</div>
					</Card>
				</div>
			</div>
		</div>
	);
}