import { Maximize2, Minimize2, Server, Clock, TrendingUp } from "lucide-react";
import React, { useState, useEffect, useMemo } from "react";
import {
	Chart as ChartJS,
	CategoryScale,
	LinearScale,
	PointElement,
	LineElement,
	Title,
	Tooltip,
	Legend,
	TimeScale,
} from "chart.js";
import { Line } from "react-chartjs-2";
import "chartjs-adapter-date-fns";
import type { ServerInfo, TimeSeriesDataPoint, TrendDataPoint } from "../types";
import {
	fetchTimeSeriesServers,
	fetchTimeSeriesHistory,
	fetchTimeSeriesTrends,
} from "../utils/api";

// Register ChartJS components
ChartJS.register(
	CategoryScale,
	LinearScale,
	PointElement,
	LineElement,
	Title,
	Tooltip,
	Legend,
	TimeScale,
);

interface TimeSeriesChartProps {
	isMaximized: boolean;
	onToggleMaximize: () => void;
}

const TimeSeriesChart: React.FC<TimeSeriesChartProps> = ({
	isMaximized,
	onToggleMaximize,
}) => {
	const [servers, setServers] = useState<ServerInfo[]>([]);
	const [selectedServer, setSelectedServer] = useState<ServerInfo | null>(null);
	const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d">("24h");
	const [metricType, setMetricType] = useState<"iops" | "avg_latency" | "bandwidth">("iops");
	const [chartData, setChartData] = useState<TimeSeriesDataPoint[]>([]);
	const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
	const [loading, setLoading] = useState(false);
	const [showTrends, setShowTrends] = useState(true);

	// Load servers on component mount
	useEffect(() => {
		const loadServers = async () => {
			try {
				const serversData = await fetchTimeSeriesServers();
				setServers(serversData);
				if (serversData.length > 0) {
					setSelectedServer(serversData[0]);
				}
			} catch (error) {
				console.error("Failed to fetch servers:", error);
			}
		};
		loadServers();
	}, []);

	// Load time-series data when server or settings change
	useEffect(() => {
		console.log('useEffect triggered:', { 
			selectedServer: selectedServer?.hostname, 
			timeRange, 
			metricType, 
			showTrends 
		});
		
		if (!selectedServer) {
			console.log('No server selected, skipping data fetch');
			return;
		}

		const loadTimeSeriesData = async () => {
			setLoading(true);
			try {
				const days = timeRange === "24h" ? undefined : timeRange === "7d" ? 7 : 30;
				const hours = timeRange === "24h" ? 24 : undefined;

				// Fetch history data
				const historyData = await fetchTimeSeriesHistory(
					selectedServer.hostname,
					selectedServer.protocol,
					days,
					hours,
				);
				console.log('Fetched history data:', {
					server: selectedServer.hostname,
					protocol: selectedServer.protocol,
					dataLength: historyData.length,
					sampleData: historyData[0]
				});
				setChartData(historyData);

				// Fetch trends if enabled
				if (showTrends) {
					const trendsData = await fetchTimeSeriesTrends(
						selectedServer.hostname,
						selectedServer.protocol,
						metricType,
						days,
						hours,
					);
					setTrendData(trendsData);
				}
			} catch (error) {
				console.error("Failed to fetch time-series data:", error);
			} finally {
				setLoading(false);
			}
		};

		loadTimeSeriesData();
	}, [selectedServer, timeRange, metricType, showTrends]);

	// Process chart data for Chart.js
	const processedChartData = useMemo(() => {
		if (!chartData.length) return null;

		// Filter data by selected metric
		const filteredData = chartData.filter((point: any) => {
			// Filter by the selected metric type
			return point.metric_type === metricType && point.value !== undefined;
		});

		console.log(`TimeSeriesChart Debug:`, {
			totalData: chartData.length,
			filteredData: filteredData.length,
			metricType,
			selectedServer: selectedServer?.hostname,
			sampleData: chartData[0]
		});

		// Group by test configuration for different series
		const seriesMap = new Map<string, any[]>();
		
		filteredData.forEach((point: any) => {
			const seriesKey = `${point.read_write_pattern} ${point.block_size} QD${point.queue_depth}`;
			if (!seriesMap.has(seriesKey)) {
				seriesMap.set(seriesKey, []);
			}
			seriesMap.get(seriesKey)!.push(point);
		});

		const datasets = Array.from(seriesMap.entries()).map(([seriesName, points], index) => {
			const colors = [
				"rgb(59, 130, 246)", // blue
				"rgb(16, 185, 129)", // emerald
				"rgb(245, 158, 11)", // amber
				"rgb(239, 68, 68)",  // red
				"rgb(139, 92, 246)", // violet
				"rgb(236, 72, 153)", // pink
			];
			
			const color = colors[index % colors.length];
			
			const chartData = points.map((point) => ({
				x: point.timestamp,
				y: point.value,
			}));
			
			console.log(`Series "${seriesName}":`, {
				pointCount: points.length,
				samplePoint: points[0],
				chartData: chartData.slice(0, 2) // First 2 data points
			});
			
			return {
				label: seriesName,
				data: chartData,
				borderColor: color,
				backgroundColor: color + "20",
				tension: 0.1,
				fill: false,
			};
		});

		console.log('Final datasets:', {
			seriesCount: datasets.length,
			seriesNames: datasets.map(d => d.label)
		});

		// Add trend line if available
		if (showTrends && trendData.length > 0) {
			const trendFilteredData = trendData.filter((point: any) => point.moving_avg !== undefined);
			if (trendFilteredData.length > 0) {
				datasets.push({
					label: "Moving Average",
					data: trendFilteredData.map((point: any) => ({
						x: point.timestamp,
						y: point.moving_avg,
					})),
					borderColor: "rgb(107, 114, 128)",
					backgroundColor: "transparent",
					borderDash: [5, 5] as number[],
					tension: 0.1,
					fill: false,
				} as any);
			}
		}

		if (datasets.length === 0) {
			console.log('No datasets created, returning null');
			return null;
		}

		return {
			datasets,
		};
	}, [chartData, trendData, showTrends]);

	const chartOptions = {
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			legend: {
				position: "bottom" as const,
			},
			title: {
				display: true,
				text: `${selectedServer?.hostname || "Server"} - ${metricType.toUpperCase()} Over Time (${timeRange})`,
			},
		},
		scales: {
			x: {
				type: "time" as const,
				time: {
					displayFormats: {
						hour: "MMM d, HH:mm",
						day: "MMM d",
					},
				},
				title: {
					display: true,
					text: "Time",
				},
			},
			y: {
				title: {
					display: true,
					text: metricType === "iops" ? "IOPS" : 
						   metricType === "avg_latency" ? "Latency (ms)" : 
						   "Bandwidth (MB/s)",
				},
			},
		},
	};

	const getTimeRangeHours = () => {
		return timeRange === "24h" ? 24 : timeRange === "7d" ? 168 : 720;
	};

	return (
		<div
			className={`theme-card rounded-lg shadow-md border ${
				isMaximized ? "fixed inset-4 z-50" : "h-96"
			}`}
		>
			{/* Header */}
			<div className="flex items-center justify-between p-4 border-b theme-border-primary">
				<div className="flex items-center space-x-4">
					<div className="flex items-center">
						<Clock className="h-5 w-5 theme-text-accent mr-2" />
						<h3 className="text-lg font-semibold theme-text-primary">
							Time Series Analysis
						</h3>
					</div>

					{/* Server Selection */}
					<select
						value={selectedServer ? `${selectedServer.hostname}-${selectedServer.protocol}-${selectedServer.drive_model}` : ""}
						onChange={(e) => {
							console.log('Server selection changed:', e.target.value);
							const parts = e.target.value.split('-');
							const drive_model = parts.slice(2).join('-'); // Handle drive models with dashes
							const hostname = parts[0];
							const protocol = parts[1];
							console.log('Parsed selection:', { hostname, protocol, drive_model });
							const server = servers.find((s) => 
								s.hostname === hostname && 
								s.protocol === protocol && 
								s.drive_model === drive_model
							);
							console.log('Found server:', server);
							setSelectedServer(server || null);
						}}
						className="px-3 py-1 rounded border theme-border-primary theme-bg-card theme-text-primary text-sm"
					>
						<option value="">Select Server</option>
						{servers.map((server, index) => (
							<option 
								key={`${server.hostname}-${server.protocol}-${server.drive_model}-${index}`} 
								value={`${server.hostname}-${server.protocol}-${server.drive_model}`}
							>
								{server.hostname} ({server.protocol}) - {server.drive_model}
							</option>
						))}
					</select>

					{/* Time Range */}
					<select
						value={timeRange}
						onChange={(e) => setTimeRange(e.target.value as "24h" | "7d" | "30d")}
						className="px-3 py-1 rounded border theme-border-primary theme-bg-card theme-text-primary text-sm"
					>
						<option value="24h">Last 24 Hours</option>
						<option value="7d">Last 7 Days</option>
						<option value="30d">Last 30 Days</option>
					</select>

					{/* Metric Type */}
					<select
						value={metricType}
						onChange={(e) => setMetricType(e.target.value as "iops" | "avg_latency" | "bandwidth")}
						className="px-3 py-1 rounded border theme-border-primary theme-bg-card theme-text-primary text-sm"
					>
						<option value="iops">IOPS</option>
						<option value="avg_latency">Latency</option>
						<option value="bandwidth">Bandwidth</option>
					</select>

					{/* Trends Toggle */}
					<label className="flex items-center text-sm theme-text-secondary">
						<input
							type="checkbox"
							checked={showTrends}
							onChange={(e) => setShowTrends(e.target.checked)}
							className="mr-2"
						/>
						Show Trends
					</label>
				</div>

				<button
					onClick={onToggleMaximize}
					className="p-2 rounded-md theme-text-secondary hover:theme-text-primary hover:theme-bg-tertiary transition-colors"
					title={isMaximized ? "Minimize" : "Maximize"}
				>
					{isMaximized ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
				</button>
			</div>

			{/* Chart Content */}
			<div className={`p-4 ${isMaximized ? "h-full" : "h-80"} relative`}>
				{loading && (
					<div className="absolute inset-0 flex items-center justify-center theme-bg-card bg-opacity-75 z-10">
						<div className="flex items-center">
							<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
							<span className="theme-text-secondary">Loading time-series data...</span>
						</div>
					</div>
				)}

				{!selectedServer ? (
					<div className="h-full flex items-center justify-center">
						<div className="text-center">
							<Server className="h-12 w-12 theme-text-secondary mx-auto mb-4" />
							<p className="theme-text-secondary">Select a server to view time-series data</p>
						</div>
					</div>
				) : !processedChartData || processedChartData.datasets.length === 0 ? (
					<div className="h-full flex items-center justify-center">
						<div className="text-center">
							<TrendingUp className="h-12 w-12 theme-text-secondary mx-auto mb-4" />
							<p className="theme-text-secondary">
								No time-series data available for the selected server and time range
							</p>
							<p className="text-sm theme-text-secondary mt-2">
								Data coverage: {getTimeRangeHours()} hours
							</p>
						</div>
					</div>
				) : (
					<div className="h-full">
						<Line data={processedChartData} options={chartOptions} />
					</div>
				)}

				{/* Server Stats */}
				{selectedServer && (
					<div className="mt-4 grid grid-cols-3 gap-4 text-sm">
						<div className="theme-bg-secondary p-3 rounded">
							<div className="theme-text-secondary">Total Tests</div>
							<div className="text-lg font-semibold theme-text-primary">
								{selectedServer.test_count}
							</div>
						</div>
						<div className="theme-bg-secondary p-3 rounded">
							<div className="theme-text-secondary">First Test</div>
							<div className="text-lg font-semibold theme-text-primary">
								{new Date(selectedServer.first_test_time).toLocaleDateString()}
							</div>
						</div>
						<div className="theme-bg-secondary p-3 rounded">
							<div className="theme-text-secondary">Last Test</div>
							<div className="text-lg font-semibold theme-text-primary">
								{new Date(selectedServer.last_test_time).toLocaleDateString()}
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
};

export default TimeSeriesChart;