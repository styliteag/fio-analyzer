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
import { DashboardHeader } from "../components/layout";
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
	const [selectedConfigs, setSelectedConfigs] = useState<string[]>([]);
	const [selectedMetrics, setSelectedMetrics] = useState<string[]>(["iops"]);
	const [days, setDays] = useState(30);
	const [data, setData] = useState<TimeSeriesDataPoint[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);


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

		const opts: any = { days };
		if (selectedMetrics.length === 1) {
			opts.metricType = selectedMetrics[0];
		}
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
		if (selectedConfigs.length > 0) {
			// Do not filter by config on API level; we'll filter client-side to support multi-select
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
			// Reset selectedConfigs only if invalid selections exist to avoid unnecessary re-renders
			setSelectedConfigs((prev) => {
				const filtered = prev.filter((cfg) => unique.has(cfg));
				return filtered.length === prev.length ? prev : filtered;
			});
		}
		setLoading(false);
	}, [selectedMetrics, days, selectedServerId, selectedConfigs.length]);

	// Reload when dependencies change
	useEffect(() => {
		load();
	}, [load]);

	// Build chart.js dataset structure
	const chartData = useMemo(() => {
		// DEBUG: Log raw data from API
		console.log("🐛 [History] Raw API data sample:", data.slice(0, 3));
		console.log("🐛 [History] Total data points:", data.length);
		
		// DEBUG: Log browser timezone and locale info
		console.log("🐛 [History] Browser timezone:", Intl.DateTimeFormat().resolvedOptions().timeZone);
		console.log("🐛 [History] Browser locale:", navigator.language);
		console.log("🐛 [History] Current time:", new Date());
		console.log("🐛 [History] Timezone offset minutes:", new Date().getTimezoneOffset());
		
		if (data.length > 0) {
			console.log("🐛 [History] First timestamp raw:", data[0].timestamp);
			console.log("🐛 [History] Last timestamp raw:", data[data.length - 1].timestamp);
			console.log("🐛 [History] First timestamp as Date:", new Date(data[0].timestamp));
			console.log("🐛 [History] Last timestamp as Date:", new Date(data[data.length - 1].timestamp));
			
			// Test different date parsing approaches
			const firstTs = data[0].timestamp;
			console.log("🐛 [History] Testing different date parsing for:", firstTs);
			console.log("🐛 [History] new Date(timestamp):", new Date(firstTs));
			console.log("🐛 [History] Date.parse(timestamp):", new Date(Date.parse(firstTs)));
			console.log("🐛 [History] Raw Date.parse() result:", Date.parse(firstTs));
		}

		let filtered = selectedConfigs.length > 0
			? data.filter((d) => selectedConfigs.includes(`${d.read_write_pattern}|${d.block_size}|${d.queue_depth}`))
			: data;
		if (selectedMetrics.length > 0) {
			// Backend returns actual metric values, not metric_type field
			// We need to transform the data to include metric_type for each selected metric
			const transformedData: any[] = [];
			filtered.forEach((d) => {
				selectedMetrics.forEach((metric) => {
					const value = d[metric as keyof typeof d];
					if (value !== null && value !== undefined) {
						transformedData.push({
							...d,
							metric_type: metric,
							value: value
						});
					}
				});
			});
			filtered = transformedData;
		}

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
			const key = `${d.read_write_pattern}/${d.block_size}/qd${d.queue_depth}-${d.metric_type}`;
			if (!map[key]) {
				map[key] = {
					label: key,
					data: [],
					color: palette[colorIdx % palette.length],
				};
				colorIdx += 1;
			}
			// DEBUG: Log what we're pushing to chart data
			const chartPoint = { x: d.timestamp, y: d.value };
			console.log("🐛 [History] Adding chart point:", chartPoint, "Date parsed:", new Date(d.timestamp));
			map[key].data.push(chartPoint);
		});
		
		const datasets = Object.values(map).map((ds) => ({
			label: ds.label,
			data: ds.data,
			borderColor: ds.color,
			backgroundColor: ds.color,
			fill: false,
			tension: 0.3,
			pointRadius: 1,
			pointHoverRadius: 3,
		}));

		// DEBUG: Log final datasets
		console.log("🐛 [History] Final chart datasets:", datasets);
		console.log("🐛 [History] First dataset sample points:", datasets[0]?.data?.slice(0, 3));
		
		return { datasets };
	}, [data, selectedConfigs, selectedMetrics]);

	const chartOptions = useMemo(() => {
		const timeUnit: "day" | "week" = days <= 7 ? "day" : "week";
		
		// DEBUG: Log Chart.js configuration
		console.log("🐛 [History] Chart options time unit:", timeUnit);
		console.log("🐛 [History] Chart options days:", days);
		
		return {
			responsive: true,
			maintainAspectRatio: false,
			scales: {
				x: {
					type: "time" as const,
					time: { 
						unit: timeUnit,
						displayFormats: {
							hour: 'HH:mm',
							day: 'MM/dd',
							week: 'MM/dd',
							month: 'MM/yyyy',
						},
						tooltipFormat: 'yyyy-MM-dd HH:mm:ss',
					},
					title: { display: true, text: "Time" },
					// DEBUG: Add parser setting to see if it helps
					parser: false, // Let Chart.js auto-detect the format
				},
				y: {
					beginAtZero: false,
					title: { display: true, text: selectedMetrics.join(", ").toUpperCase() },
				},
			},
			plugins: {
				legend: { display: true, position: "bottom" as const },
				tooltip: {
					mode: 'index' as const,
					intersect: false,
					callbacks: {
						title: (context: any) => {
							if (context.length > 0) {
								// DEBUG: Log what context[0].parsed.x contains
								console.log("🐛 [History] Tooltip context[0].parsed.x:", context[0].parsed.x);
								console.log("🐛 [History] Tooltip context[0].parsed.x type:", typeof context[0].parsed.x);
								
								const date = new Date(context[0].parsed.x);
								console.log("🐛 [History] Tooltip Date object:", date);
								console.log("🐛 [History] Tooltip Date.getTime():", date.getTime());
								console.log("🐛 [History] Tooltip Date.toISOString():", date.toISOString());
								
								const formatted = date.toLocaleString('en-US', {
									year: 'numeric',
									month: '2-digit',
									day: '2-digit',
									hour: '2-digit',
									minute: '2-digit',
									second: '2-digit',
									hour12: false
								});
								console.log("🐛 [History] Tooltip formatted date:", formatted);
								return formatted;
							}
							return '';
						},
						label: (context: any) => {
							const value = context.parsed.y;
							const label = context.dataset.label || '';
							return `${label}: ${value.toLocaleString()}`;
						},
					},
				},
			},
		} as const;
	}, [days, selectedMetrics]);

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

					<div>
						<label className="block text-sm font-medium theme-text-primary mb-2">Test Configurations</label>
						<select
							multiple
							value={selectedConfigs}
							onChange={(e) => {
								const selections = Array.from(e.target.selectedOptions).map((o) => o.value);
								setSelectedConfigs(selections);
							}}
							className="w-full px-3 py-2 border rounded theme-bg-primary theme-text-primary h-32"
						>
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

					<div>
						<label className="block text-sm font-medium theme-text-primary mb-2">Metrics</label>
						<select
							multiple
							value={selectedMetrics}
							onChange={(e) => {
								const selections = Array.from(e.target.selectedOptions).map((o) => o.value);
								setSelectedMetrics(selections);
							}}
							className="w-full px-3 py-2 border rounded theme-bg-primary theme-text-primary h-32"
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