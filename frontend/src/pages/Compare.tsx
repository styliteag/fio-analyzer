import { useEffect, useState, useMemo, useCallback } from "react";
import { Bar } from "react-chartjs-2";
import {
	Chart as ChartJS,
	CategoryScale,
	LinearScale,
	BarElement,
	Tooltip,
	Legend,
} from "chart.js";
import { fetchFilters, fetchTestRuns } from "../services/api/testRuns";
import { fetchPerformanceData } from "../services/api/performance";
import type { PerformanceData } from "../types";
import Loading from "../components/ui/Loading";
import ErrorDisplay from "../components/ui/ErrorDisplay";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { DashboardHeader } from "../components/layout";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const METRICS = ["iops", "bandwidth", "p95_latency", "p99_latency"] as const;
const PARAMETERS = [
	{ key: "block_size", label: "Block Size" },
	{ key: "queue_depth", label: "Queue Depth" },
	{ key: "read_write_pattern", label: "R/W Pattern" },
] as const;

type MetricType = typeof METRICS[number];
type ParamKey = typeof PARAMETERS[number]["key"];

export default function Compare() {
	// UI state
	const [hostOptions, setHostOptions] = useState<string[]>([]);
	const [selectedHosts, setSelectedHosts] = useState<string[]>([]);
	const [metric, setMetric] = useState<MetricType>("iops");
	const [xParam, setXParam] = useState<ParamKey>("block_size");
	const [chartKey, setChartKey] = useState(0);

	// Data state
	const [perfData, setPerfData] = useState<PerformanceData[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Fetch hostnames once
	useEffect(() => {
		const loadHosts = async () => {
			const res = await fetchFilters();
			if (res.data) setHostOptions(res.data.hostnames);
		};
		loadHosts();
	}, []);

	// Load latest runs for hosts and their metrics
	const loadData = useCallback(async () => {
		if (selectedHosts.length === 0) {
			setPerfData([]);
			setChartKey(prev => prev + 1);
			return;
		}
		setLoading(true);
		setError(null);
		setChartKey(prev => prev + 1);
		try {
			// latest per config only (includeHistorical false)
			const runsRes = await fetchTestRuns({ hostnames: selectedHosts });
			if (runsRes.error) throw new Error(runsRes.error);
			const runIds = (runsRes.data || []).map((r) => r.id);
			if (runIds.length === 0) {
				setPerfData([]);
				setLoading(false);
				return;
			}
			const perfRes = await fetchPerformanceData({ testRunIds: runIds });
			if (perfRes.error) throw new Error(perfRes.error);
			setPerfData(perfRes.data || []);
		} catch (e: any) {
			setError(e.message || "Failed to load data");
			setPerfData([]);
		} finally {
			setLoading(false);
		}
	}, [selectedHosts]);

	// Build chart data
	const chartData = useMemo(() => {
		if (perfData.length === 0) return null;

		// Collect categories (unique parameter values)
		const categoriesSet = new Set<string>();
		perfData.forEach((run) => {
			categoriesSet.add(String((run as any)[xParam]));
		});
		const categories = Array.from(categoriesSet).sort();

		// Map host -> { paramValue -> metricValue }
		const hostMap: Record<string, Record<string, number | null>> = {};
		selectedHosts.forEach((h) => (hostMap[h] = {}));

		perfData.forEach((run) => {
			const host = run.hostname || "unknown";
			if (!hostMap[host]) return; // ignore non-selected hosts
			const paramValue = String((run as any)[xParam]);
			const m = run.metrics[metric];
			hostMap[host][paramValue] = m ? m.value : null;
		});

		// Palette
		const palette = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];

		const datasets = selectedHosts.map((host, idx) => ({
			label: host,
			data: categories.map((c) => hostMap[host][c] ?? null),
			backgroundColor: palette[idx % palette.length],
		}));

		return { labels: categories, datasets };
	}, [perfData, selectedHosts, xParam, metric]);

	const barOptions = useMemo(() => {
		const options = {
			responsive: true,
			maintainAspectRatio: false,
			resizeDelay: 0,
			animation: {
				duration: 0,
			},
			transitions: {
				active: {
					animation: {
						duration: 0,
					},
				},
			},
			plugins: { 
				legend: { position: "bottom" as const },
			},
			scales: {
				x: { 
					title: { display: true, text: PARAMETERS.find((p) => p.key === xParam)?.label || xParam },
					ticks: { maxRotation: 0 },
				},
				y: {
					title: { display: true, text: metric.toUpperCase() },
					beginAtZero: false,
					type: 'linear' as const,
					position: 'left' as const,
				},
			},
		};
		return options;
	}, [xParam, metric]);

	return (
		<div className="h-screen theme-bg-secondary flex">
			{/* Sidebar with controls */}
			<div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-6 overflow-y-auto">
				<h2 className="text-xl font-bold theme-text-primary mb-6">Compare Hosts</h2>
				<div className="space-y-4">
					<div>
						<label className="block text-sm font-medium theme-text-primary mb-2">Hostnames</label>
						<select
							multiple
							value={selectedHosts}
							onChange={(e) => {
								const opts = Array.from(e.target.selectedOptions).map((o) => o.value);
								setSelectedHosts(opts);
							}}
							className="w-full h-40 px-3 py-2 border rounded theme-bg-primary theme-text-primary text-sm"
						>
							{hostOptions.map((h) => (
								<option key={h} value={h} className="dark:bg-gray-700 dark:text-gray-200">
									{h}
								</option>
							))}
						</select>
					</div>
					<div>
						<label className="block text-sm font-medium theme-text-primary mb-2">Metric</label>
						<select
							value={metric}
							onChange={(e) => setMetric(e.target.value as MetricType)}
							className="w-full px-3 py-2 border rounded theme-bg-primary theme-text-primary text-sm"
						>
							{METRICS.map((m) => (
								<option key={m} value={m} className="dark:bg-gray-700 dark:text-gray-200">
									{m}
								</option>
							))}
						</select>
					</div>
					<div>
						<label className="block text-sm font-medium theme-text-primary mb-2">X-Axis Parameter</label>
						<select
							value={xParam}
							onChange={(e) => setXParam(e.target.value as ParamKey)}
							className="w-full px-3 py-2 border rounded theme-bg-primary theme-text-primary text-sm"
						>
							{PARAMETERS.map((p) => (
								<option key={p.key} value={p.key} className="dark:bg-gray-700 dark:text-gray-200">
									{p.label}
								</option>
							))}
						</select>
					</div>
					<Button onClick={loadData} disabled={loading || selectedHosts.length === 0} className="w-full">
						{loading ? "Loading..." : "Load Data"}
					</Button>
				</div>
				{error && (
					<div className="mt-4">
						<ErrorDisplay error={error} onRetry={loadData} showRetry />
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
								<Loading message="Loading data..." />
							) : (
								chartData && (
									<Bar 
										key={chartKey}
										data={chartData} 
										options={barOptions} 
										width={800}
										height={600}
									/>
								)
							)}
						</div>
					</Card>
				</div>
			</div>
		</div>
	);
} 