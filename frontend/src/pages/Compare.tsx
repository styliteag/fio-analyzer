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
import { fetchFilters } from "../services/api/testRuns";
import { fetchPerformanceData } from "../services/api/performance";
import { fetchTimeSeriesAll } from "../services/api/timeSeries";
import type { PerformanceData, FilterOptions } from "../types";
import Loading from "../components/ui/Loading";
import ErrorDisplay from "../components/ui/ErrorDisplay";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { DashboardHeader } from "../components/layout";
import Select from "react-select";

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
	const [selectedMetrics, setSelectedMetrics] = useState<MetricType[]>(["iops"]);
	const [xParam, setXParam] = useState<ParamKey>("block_size");
	const [chartKey, setChartKey] = useState(0);
	const [selectedDriveTypes, setSelectedDriveTypes] = useState<string[]>([]);
	const [selectedDriveModels, setSelectedDriveModels] = useState<string[]>([]);
	const [selectedProtocols, setSelectedProtocols] = useState<string[]>([]);
	const [selectedPatterns, setSelectedPatterns] = useState<string[]>([]);
	const [selectedBlockSizes, setSelectedBlockSizes] = useState<(string|number)[]>([]);
	const [selectedSyncs, setSelectedSyncs] = useState<number[]>([]);
	const [selectedQueueDepths, setSelectedQueueDepths] = useState<number[]>([]);
	const [selectedDirects, setSelectedDirects] = useState<number[]>([]);
	const [selectedNumJobs, setSelectedNumJobs] = useState<number[]>([]);
	const [selectedTestSizes, setSelectedTestSizes] = useState<string[]>([]);
	const [selectedDurations, setSelectedDurations] = useState<number[]>([]);

	// Data state
	const [perfData, setPerfData] = useState<PerformanceData[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [filters, setFilters] = useState<FilterOptions | null>(null);

	// Fetch hostnames once
	useEffect(() => {
		const loadHosts = async () => {
			const res = await fetchFilters();
			if (res.data) setHostOptions(res.data.hostnames);
		};
		loadHosts();
	}, []);

	// Fetch filter options for drive type/model/protocol
	useEffect(() => {
		const loadFilters = async () => {
			const res = await fetchFilters();
			if (res.data) setFilters(res.data);
		};
		loadFilters();
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
			// Get all historical data for comparison
			const runsRes = await fetchTimeSeriesAll({
				hostnames: selectedHosts,
				drive_types: selectedDriveTypes,
				drive_models: selectedDriveModels,
				protocols: selectedProtocols,
				patterns: selectedPatterns,
				block_sizes: selectedBlockSizes,
				syncs: selectedSyncs,
				queue_depths: selectedQueueDepths,
				directs: selectedDirects,
				num_jobs: selectedNumJobs,
				test_sizes: selectedTestSizes,
				durations: selectedDurations,
			});
			const runIds = (runsRes || []).map((r: any) => r.id);
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
	}, [selectedHosts, selectedDriveTypes, selectedDriveModels, selectedProtocols, selectedPatterns, selectedBlockSizes, selectedSyncs, selectedQueueDepths, selectedDirects, selectedNumJobs, selectedTestSizes, selectedDurations]);

	// Build chart data
	const chartData = useMemo(() => {
		if (perfData.length === 0) return null;
		// Collect categories (unique parameter values)
		const categoriesSet = new Set<string>();
		perfData.forEach((run) => {
			categoriesSet.add(String((run as any)[xParam]));
		});
		const categories = Array.from(categoriesSet).sort();
		// Build datasets: one for each host+metric
		const palette = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#6366f1", "#f472b6", "#f87171"];
		const datasets: any[] = [];
		perfData.forEach((run, idx) => {
			selectedMetrics.forEach((metric, mIdx) => {
				const color = palette[(idx * selectedMetrics.length + mIdx) % palette.length];
				const label = [
					run.hostname,
					run.read_write_pattern,
					run.block_size,
					`qd${run.queue_depth}`,
					run.protocol,
					run.drive_model,
					(run as any).test_size || '',
					(run as any).duration ? `${(run as any).duration}s` : undefined,
				].filter(Boolean).join(" | ");
				datasets.push({
					label: `${label} (${metric})`,
					data: categories.map((c) => {
						// Only show value for the matching X param
						if (String((run as any)[xParam]) === c) {
							return run.metrics[metric] ? run.metrics[metric].value : null;
						}
						return null;
					}),
					backgroundColor: color,
				});
			});
		});
		return { labels: categories, datasets };
	}, [perfData, xParam, selectedMetrics]);

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
					title: { display: true, text: selectedMetrics.length === 1 ? selectedMetrics[0].toUpperCase() : "Metric Value" },
					beginAtZero: false,
					type: 'linear' as const,
					position: 'left' as const,
				},
			},
		};
		return options;
	}, [xParam, selectedMetrics]);

	return (
		<div className="h-screen theme-bg-secondary flex">
			{/* Sidebar with controls */}
			<div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-6 overflow-y-auto">
				<h2 className="text-xl font-bold theme-text-primary mb-6">Compare Hosts</h2>
				<div className="space-y-4">
					<div>
						<label className="block text-sm font-medium theme-text-primary mb-2">Hostnames</label>
						<Select
							isMulti
							options={hostOptions.map(h => ({ value: h, label: h }))}
							value={hostOptions.filter(h => selectedHosts.includes(h)).map(h => ({ value: h, label: h }))}
							onChange={opts => setSelectedHosts(opts.map(o => o.value))}
							classNamePrefix="react-select"
							className="w-full text-sm"
							styles={{
								control: (base) => ({ ...base, backgroundColor: 'var(--tw-bg-opacity,1) #fff', borderColor: '#e5e7eb', minHeight: 44 }),
								menu: (base) => ({ ...base, zIndex: 50 }),
								multiValue: (base) => ({ ...base, backgroundColor: '#e0e7ef' }),
								option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? '#f3f4f6' : undefined, color: '#111827' }),
							}}
							placeholder="Select hosts..."
						/>
					</div>
					<div>
						<label className="block text-sm font-medium theme-text-primary mb-2">Metrics</label>
						<select
							multiple
							value={selectedMetrics}
							onChange={(e) => {
								const opts = Array.from(e.target.selectedOptions).map((o) => o.value as MetricType);
								setSelectedMetrics(opts as MetricType[]);
							}}
							className="w-full px-3 py-2 border rounded theme-bg-primary theme-text-primary text-sm h-32"
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
					<div>
						<label className="block text-sm font-medium theme-text-primary mb-2">Drive Type</label>
						<Select
							isMulti
							options={filters?.drive_types.map(dt => ({ value: dt, label: dt })) || []}
							value={selectedDriveTypes.map(dt => ({ value: dt, label: dt }))}
							onChange={opts => setSelectedDriveTypes(opts.map(o => o.value))}
							classNamePrefix="react-select"
							className="w-full text-sm"
							styles={{
								control: (base) => ({ ...base, backgroundColor: 'var(--tw-bg-opacity,1) #fff', borderColor: '#e5e7eb', minHeight: 44 }),
								menu: (base) => ({ ...base, zIndex: 50 }),
								multiValue: (base) => ({ ...base, backgroundColor: '#e0e7ef' }),
								option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? '#f3f4f6' : undefined, color: '#111827' }),
							}}
							placeholder="Select drive types..."
						/>
					</div>
					<div>
						<label className="block text-sm font-medium theme-text-primary mb-2">Drive Model</label>
						<Select
							isMulti
							options={filters?.drive_models.map(dm => ({ value: dm, label: dm })) || []}
							value={selectedDriveModels.map(dm => ({ value: dm, label: dm }))}
							onChange={opts => setSelectedDriveModels(opts.map(o => o.value))}
							classNamePrefix="react-select"
							className="w-full text-sm"
							styles={{
								control: (base) => ({ ...base, backgroundColor: 'var(--tw-bg-opacity,1) #fff', borderColor: '#e5e7eb', minHeight: 44 }),
								menu: (base) => ({ ...base, zIndex: 50 }),
								multiValue: (base) => ({ ...base, backgroundColor: '#e0e7ef' }),
								option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? '#f3f4f6' : undefined, color: '#111827' }),
							}}
							placeholder="Select drive models..."
						/>
					</div>
					<div>
						<label className="block text-sm font-medium theme-text-primary mb-2">Protocol</label>
						<Select
							isMulti
							options={filters?.protocols.map(p => ({ value: p, label: p })) || []}
							value={selectedProtocols.map(p => ({ value: p, label: p }))}
							onChange={opts => setSelectedProtocols(opts.map(o => o.value))}
							classNamePrefix="react-select"
							className="w-full text-sm"
							styles={{
								control: (base) => ({ ...base, backgroundColor: 'var(--tw-bg-opacity,1) #fff', borderColor: '#e5e7eb', minHeight: 44 }),
								menu: (base) => ({ ...base, zIndex: 50 }),
								multiValue: (base) => ({ ...base, backgroundColor: '#e0e7ef' }),
								option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? '#f3f4f6' : undefined, color: '#111827' }),
							}}
							placeholder="Select protocols..."
						/>
					</div>
					<div>
						<label className="block text-sm font-medium theme-text-primary mb-2">Pattern</label>
						<Select
							isMulti
							options={filters?.patterns.map(p => ({ value: p, label: p })) || []}
							value={selectedPatterns.map(p => ({ value: p, label: p }))}
							onChange={opts => setSelectedPatterns(opts.map(o => o.value))}
							classNamePrefix="react-select"
							className="w-full text-sm"
							styles={{
								control: (base) => ({ ...base, backgroundColor: 'var(--tw-bg-opacity,1) #fff', borderColor: '#e5e7eb', minHeight: 44 }),
								menu: (base) => ({ ...base, zIndex: 50 }),
								multiValue: (base) => ({ ...base, backgroundColor: '#e0e7ef' }),
								option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? '#f3f4f6' : undefined, color: '#111827' }),
							}}
							placeholder="Select patterns..."
						/>
					</div>
					<div>
						<label className="block text-sm font-medium theme-text-primary mb-2">Block Size</label>
						<Select
							isMulti
							options={filters?.block_sizes.map(b => ({ value: String(b), label: String(b) })) || []}
							value={selectedBlockSizes.map(b => ({ value: String(b), label: String(b) }))}
							onChange={opts => setSelectedBlockSizes(opts.map(o => o.value))}
							classNamePrefix="react-select"
							className="w-full text-sm"
							styles={{
								control: (base) => ({ ...base, backgroundColor: 'var(--tw-bg-opacity,1) #fff', borderColor: '#e5e7eb', minHeight: 44 }),
								menu: (base) => ({ ...base, zIndex: 50 }),
								multiValue: (base) => ({ ...base, backgroundColor: '#e0e7ef' }),
								option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? '#f3f4f6' : undefined, color: '#111827' }),
							}}
							placeholder="Select block sizes..."
						/>
					</div>
					<div>
						<label className="block text-sm font-medium theme-text-primary mb-2">Sync</label>
						<Select
							isMulti
							options={filters?.syncs.map(s => ({ value: String(s), label: String(s) })) || []}
							value={selectedSyncs.map(s => ({ value: String(s), label: String(s) }))}
							onChange={opts => setSelectedSyncs(opts.map(o => Number(o.value)))}
							classNamePrefix="react-select"
							className="w-full text-sm"
							styles={{
								control: (base) => ({ ...base, backgroundColor: 'var(--tw-bg-opacity,1) #fff', borderColor: '#e5e7eb', minHeight: 44 }),
								menu: (base) => ({ ...base, zIndex: 50 }),
								multiValue: (base) => ({ ...base, backgroundColor: '#e0e7ef' }),
								option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? '#f3f4f6' : undefined, color: '#111827' }),
							}}
							placeholder="Select sync values..."
						/>
					</div>
					<div>
						<label className="block text-sm font-medium theme-text-primary mb-2">Queue Depth</label>
						<Select
							isMulti
							options={filters?.queue_depths.map(qd => ({ value: String(qd), label: String(qd) })) || []}
							value={selectedQueueDepths.map(qd => ({ value: String(qd), label: String(qd) }))}
							onChange={opts => setSelectedQueueDepths(opts.map(o => Number(o.value)))}
							classNamePrefix="react-select"
							className="w-full text-sm"
							styles={{
								control: (base) => ({ ...base, backgroundColor: 'var(--tw-bg-opacity,1) #fff', borderColor: '#e5e7eb', minHeight: 44 }),
								menu: (base) => ({ ...base, zIndex: 50 }),
								multiValue: (base) => ({ ...base, backgroundColor: '#e0e7ef' }),
								option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? '#f3f4f6' : undefined, color: '#111827' }),
							}}
							placeholder="Select queue depths..."
						/>
					</div>
					<div>
						<label className="block text-sm font-medium theme-text-primary mb-2">Direct</label>
						<Select
							isMulti
							options={filters?.directs.map(d => ({ value: String(d), label: String(d) })) || []}
							value={selectedDirects.map(d => ({ value: String(d), label: String(d) }))}
							onChange={opts => setSelectedDirects(opts.map(o => Number(o.value)))}
							classNamePrefix="react-select"
							className="w-full text-sm"
							styles={{
								control: (base) => ({ ...base, backgroundColor: 'var(--tw-bg-opacity,1) #fff', borderColor: '#e5e7eb', minHeight: 44 }),
								menu: (base) => ({ ...base, zIndex: 50 }),
								multiValue: (base) => ({ ...base, backgroundColor: '#e0e7ef' }),
								option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? '#f3f4f6' : undefined, color: '#111827' }),
							}}
							placeholder="Select direct values..."
						/>
					</div>
					<div>
						<label className="block text-sm font-medium theme-text-primary mb-2">Num Jobs</label>
						<Select
							isMulti
							options={filters?.num_jobs.map(n => ({ value: String(n), label: String(n) })) || []}
							value={selectedNumJobs.map(n => ({ value: String(n), label: String(n) }))}
							onChange={opts => setSelectedNumJobs(opts.map(o => Number(o.value)))}
							classNamePrefix="react-select"
							className="w-full text-sm"
							styles={{
								control: (base) => ({ ...base, backgroundColor: 'var(--tw-bg-opacity,1) #fff', borderColor: '#e5e7eb', minHeight: 44 }),
								menu: (base) => ({ ...base, zIndex: 50 }),
								multiValue: (base) => ({ ...base, backgroundColor: '#e0e7ef' }),
								option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? '#f3f4f6' : undefined, color: '#111827' }),
							}}
							placeholder="Select num jobs..."
						/>
					</div>
					<div>
						<label className="block text-sm font-medium theme-text-primary mb-2">Test Size</label>
						<Select
							isMulti
							options={filters?.test_sizes.map(ts => ({ value: ts, label: ts })) || []}
							value={selectedTestSizes.map(ts => ({ value: ts, label: ts }))}
							onChange={opts => setSelectedTestSizes(opts.map(o => o.value))}
							classNamePrefix="react-select"
							className="w-full text-sm"
							styles={{
								control: (base) => ({ ...base, backgroundColor: 'var(--tw-bg-opacity,1) #fff', borderColor: '#e5e7eb', minHeight: 44 }),
								menu: (base) => ({ ...base, zIndex: 50 }),
								multiValue: (base) => ({ ...base, backgroundColor: '#e0e7ef' }),
								option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? '#f3f4f6' : undefined, color: '#111827' }),
							}}
							placeholder="Select test sizes..."
						/>
					</div>
					<div>
						<label className="block text-sm font-medium theme-text-primary mb-2">Duration</label>
						<Select
							isMulti
							options={filters?.durations.map(d => ({ value: String(d), label: String(d) })) || []}
							value={selectedDurations.map(d => ({ value: String(d), label: String(d) }))}
							onChange={opts => setSelectedDurations(opts.map(o => Number(o.value)))}
							classNamePrefix="react-select"
							className="w-full text-sm"
							styles={{
								control: (base) => ({ ...base, backgroundColor: 'var(--tw-bg-opacity,1) #fff', borderColor: '#e5e7eb', minHeight: 44 }),
								menu: (base) => ({ ...base, zIndex: 50 }),
								multiValue: (base) => ({ ...base, backgroundColor: '#e0e7ef' }),
								option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? '#f3f4f6' : undefined, color: '#111827' }),
							}}
							placeholder="Select durations..."
						/>
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