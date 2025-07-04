import { Maximize2, Minimize2, Activity, TrendingUp, Clock, Server } from "lucide-react";
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
import type { ServerInfo } from "../types";
import {
	fetchTimeSeriesServers,
	fetchTimeSeriesHistory,
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

interface ServerGroup {
	id: string;
	hostname: string;
	protocol: string;
	driveModels: string[];
	totalTests: number;
	lastTestTime: string;
	firstTestTime: string;
}

const TimeSeriesChart: React.FC<TimeSeriesChartProps> = ({
	isMaximized,
	onToggleMaximize,
}) => {
	const [serverGroups, setServerGroups] = useState<ServerGroup[]>([]);
	const [selectedServerIds, setSelectedServerIds] = useState<string[]>([]);
	const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d">("7d");
	const [enabledMetrics, setEnabledMetrics] = useState<{
		iops: boolean;
		latency: boolean;
		bandwidth: boolean;
	}>({
		iops: true,
		latency: true,
		bandwidth: false,
	});
	const [chartData, setChartData] = useState<{ [serverId: string]: any[] }>({});
	const [loading, setLoading] = useState(false);

	// Load and group servers on component mount
	useEffect(() => {
		const loadServers = async () => {
			try {
				const serversData = await fetchTimeSeriesServers();

				// Group servers by hostname + protocol
				const groups = new Map<string, ServerGroup>();
				
				serversData.forEach((server: ServerInfo) => {
					const groupId = `${server.hostname}::${server.protocol}`;
					
					if (groups.has(groupId)) {
						const group = groups.get(groupId)!;
						group.driveModels.push(server.drive_model);
						group.totalTests += server.test_count;
						// Update time ranges
						if (new Date(server.last_test_time) > new Date(group.lastTestTime)) {
							group.lastTestTime = server.last_test_time;
						}
						if (new Date(server.first_test_time) < new Date(group.firstTestTime)) {
							group.firstTestTime = server.first_test_time;
						}
					} else {
						groups.set(groupId, {
							id: groupId,
							hostname: server.hostname,
							protocol: server.protocol,
							driveModels: [server.drive_model],
							totalTests: server.test_count,
							lastTestTime: server.last_test_time,
							firstTestTime: server.first_test_time,
						});
					}
				});

				const groupsArray = Array.from(groups.values());
				setServerGroups(groupsArray);
				
				// Auto-select first server group
				if (groupsArray.length > 0) {
					setSelectedServerIds([groupsArray[0].id]);
				}
			} catch (error) {
				console.error("Failed to fetch servers:", error);
			}
		};
		loadServers();
	}, []);

	// Load time-series data when selections change
	useEffect(() => {
		if (selectedServerIds.length === 0) return;

		const loadTimeSeriesData = async () => {
			setLoading(true);
			try {
				const days = timeRange === "24h" ? undefined : timeRange === "7d" ? 7 : 30;
				const hours = timeRange === "24h" ? 24 : undefined;

				const newChartData: { [serverId: string]: any[] } = {};

				for (const serverId of selectedServerIds) {
					const group = serverGroups.find(g => g.id === serverId);
					if (!group) continue;

					const historyData = await fetchTimeSeriesHistory(
						group.hostname,
						group.protocol,
						days,
						hours,
					);
					
					newChartData[serverId] = historyData;
				}

				setChartData(newChartData);
			} catch (error) {
				console.error("Failed to fetch time-series data:", error);
			} finally {
				setLoading(false);
			}
		};

		loadTimeSeriesData();
	}, [selectedServerIds, timeRange, serverGroups]);

	// Process chart data for Chart.js
	const processedChartData = useMemo(() => {
		if (Object.keys(chartData).length === 0) return null;

		const datasets: any[] = [];
		const serverColors = [
			"#3B82F6", // blue
			"#10B981", // emerald  
			"#F59E0B", // amber
			"#EF4444", // red
			"#8B5CF6", // violet
			"#EC4899", // pink
		];

		let colorIndex = 0;

		Object.entries(chartData).forEach(([serverId, data]) => {
			const group = serverGroups.find(g => g.id === serverId);
			if (!group || !data.length) return;

			const baseColor = serverColors[colorIndex % serverColors.length];
			colorIndex++;

			// Process each enabled metric
			if (enabledMetrics.iops) {
				const iopsData = data
					.filter((point: any) => point.metric_type === "iops")
					.map((point: any) => ({
						x: point.timestamp,
						y: point.value,
					}));

				if (iopsData.length > 0) {
					datasets.push({
						label: `${group.hostname} (${group.protocol}) - IOPS`,
						data: iopsData,
						borderColor: baseColor,
						backgroundColor: baseColor + "20",
						tension: 0.1,
						fill: false,
						yAxisID: "y",
						pointRadius: 2,
						pointHoverRadius: 6,
					});
				}
			}

			if (enabledMetrics.latency) {
				const latencyData = data
					.filter((point: any) => point.metric_type === "avg_latency")
					.map((point: any) => ({
						x: point.timestamp,
						y: point.value,
					}));

				if (latencyData.length > 0) {
					datasets.push({
						label: `${group.hostname} (${group.protocol}) - Latency`,
						data: latencyData,
						borderColor: baseColor,
						backgroundColor: baseColor + "40",
						borderDash: [5, 5],
						tension: 0.1,
						fill: false,
						yAxisID: "y1",
						pointRadius: 2,
						pointHoverRadius: 6,
					});
				}
			}

			if (enabledMetrics.bandwidth) {
				const bandwidthData = data
					.filter((point: any) => point.metric_type === "bandwidth")
					.map((point: any) => ({
						x: point.timestamp,
						y: point.value,
					}));

				if (bandwidthData.length > 0) {
					datasets.push({
						label: `${group.hostname} (${group.protocol}) - Bandwidth`,
						data: bandwidthData,
						borderColor: baseColor,
						backgroundColor: baseColor + "60",
						borderDash: [2, 2],
						tension: 0.1,
						fill: false,
						yAxisID: "y2",
						pointRadius: 2,
						pointHoverRadius: 6,
					});
				}
			}
		});

		return datasets.length > 0 ? { datasets } : null;
	}, [chartData, enabledMetrics, serverGroups]);

	const chartOptions = {
		responsive: true,
		maintainAspectRatio: false,
		interaction: {
			mode: "index" as const,
			intersect: false,
		},
		plugins: {
			legend: {
				position: "bottom" as const,
				labels: {
					usePointStyle: true,
					padding: 20,
				},
			},
			title: {
				display: true,
				text: `Performance Monitoring - ${timeRange.toUpperCase()}`,
				font: {
					size: 16,
					weight: "bold" as const,
				},
			},
			tooltip: {
				backgroundColor: "rgba(0, 0, 0, 0.8)",
				titleColor: "white",
				bodyColor: "white",
				borderColor: "rgba(255, 255, 255, 0.2)",
				borderWidth: 1,
			},
		},
		scales: {
			x: {
				type: "time" as const,
				time: {
					displayFormats: {
						hour: "MMM d, HH:mm",
						day: "MMM d",
						week: "MMM d",
					},
				},
				title: {
					display: true,
					text: "Time",
				},
				grid: {
					display: true,
					color: "rgba(0, 0, 0, 0.1)",
				},
			},
			y: {
				type: "linear" as const,
				display: enabledMetrics.iops,
				position: "left" as const,
				title: {
					display: true,
					text: "IOPS",
					color: "#3B82F6",
				},
				grid: {
					display: true,
					color: "rgba(59, 130, 246, 0.1)",
				},
			},
			y1: {
				type: "linear" as const,
				display: enabledMetrics.latency,
				position: "right" as const,
				title: {
					display: true,
					text: "Latency (ms)",
					color: "#10B981",
				},
				grid: {
					display: false,
				},
			},
			y2: {
				type: "linear" as const,
				display: enabledMetrics.bandwidth,
				position: "right" as const,
				title: {
					display: true,
					text: "Bandwidth (MB/s)",
					color: "#F59E0B",
				},
				grid: {
					display: false,
				},
			},
		},
	};

	const handleServerToggle = (serverId: string) => {
		setSelectedServerIds(prev => 
			prev.includes(serverId)
				? prev.filter(id => id !== serverId)
				: [...prev, serverId]
		);
	};

	const handleMetricToggle = (metric: keyof typeof enabledMetrics) => {
		setEnabledMetrics(prev => ({
			...prev,
			[metric]: !prev[metric],
		}));
	};

	const getServerStats = (serverId: string) => {
		const data = chartData[serverId] || [];
		if (data.length === 0) return null;

		const iopsData = data.filter((p: any) => p.metric_type === "iops");
		const latencyData = data.filter((p: any) => p.metric_type === "avg_latency");
		
		const avgIops = iopsData.length > 0 
			? Math.round(iopsData.reduce((sum: number, p: any) => sum + p.value, 0) / iopsData.length)
			: 0;
		
		const avgLatency = latencyData.length > 0 
			? (latencyData.reduce((sum: number, p: any) => sum + p.value, 0) / latencyData.length).toFixed(2)
			: "0";

		return { avgIops, avgLatency, totalPoints: data.length };
	};

	const formatTimeAgo = (timestamp: string) => {
		const diff = Date.now() - new Date(timestamp).getTime();
		const hours = Math.floor(diff / (1000 * 60 * 60));
		const days = Math.floor(hours / 24);
		
		if (days > 0) return `${days}d ago`;
		if (hours > 0) return `${hours}h ago`;
		return "< 1h ago";
	};

	return (
		<div
			className={`theme-card rounded-lg shadow-md border ${
				isMaximized ? "fixed inset-4 z-50" : "h-auto"
			}`}
		>
			{/* Header Controls */}
			<div className="p-4 border-b theme-border-primary">
				<div className="flex items-center justify-between mb-4">
					<div className="flex items-center">
						<Activity className="h-6 w-6 theme-text-accent mr-3" />
						<h3 className="text-xl font-semibold theme-text-primary">
							Performance Monitoring
						</h3>
					</div>
					<button
						onClick={onToggleMaximize}
						className="p-2 rounded-md theme-text-secondary hover:theme-text-primary hover:theme-bg-tertiary transition-colors"
						title={isMaximized ? "Minimize" : "Maximize"}
					>
						{isMaximized ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
					</button>
				</div>

				{/* Control Row */}
				<div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
					{/* Server Selection */}
					<div className="space-y-2">
						<label className="text-sm font-medium theme-text-secondary flex items-center">
							<Server className="h-4 w-4 mr-1" />
							Servers
						</label>
						<div className="space-y-1 max-h-32 overflow-y-auto">
							{serverGroups.map((group) => (
								<label key={group.id} className="flex items-center text-sm">
									<input
										type="checkbox"
										checked={selectedServerIds.includes(group.id)}
										onChange={() => handleServerToggle(group.id)}
										className="mr-2"
									/>
									<span className="theme-text-primary">
										{group.hostname} ({group.protocol})
									</span>
									<span className="text-xs theme-text-secondary ml-2">
										{group.driveModels.length} drive{group.driveModels.length !== 1 ? 's' : ''}
									</span>
								</label>
							))}
						</div>
					</div>

					{/* Time Range */}
					<div className="space-y-2">
						<label className="text-sm font-medium theme-text-secondary flex items-center">
							<Clock className="h-4 w-4 mr-1" />
							Time Range
						</label>
						<div className="flex space-x-2">
							{(["24h", "7d", "30d"] as const).map((range) => (
								<button
									key={range}
									onClick={() => setTimeRange(range)}
									className={`px-3 py-1 rounded text-sm transition-colors ${
										timeRange === range
											? "theme-btn-primary"
											: "theme-bg-secondary theme-text-secondary hover:theme-bg-tertiary"
									}`}
								>
									{range}
								</button>
							))}
						</div>
					</div>

					{/* Metrics Selection */}
					<div className="space-y-2">
						<label className="text-sm font-medium theme-text-secondary flex items-center">
							<TrendingUp className="h-4 w-4 mr-1" />
							Metrics
						</label>
						<div className="space-y-1">
							{Object.entries(enabledMetrics).map(([metric, enabled]) => (
								<label key={metric} className="flex items-center text-sm">
									<input
										type="checkbox"
										checked={enabled}
										onChange={() => handleMetricToggle(metric as keyof typeof enabledMetrics)}
										className="mr-2"
									/>
									<span className="theme-text-primary capitalize">
										{metric === "iops" ? "IOPS" : metric}
									</span>
								</label>
							))}
						</div>
					</div>
				</div>
			</div>

			{/* Chart Area */}
			<div className={`p-4 ${isMaximized ? "h-full" : "h-96"} relative`}>
				{loading && (
					<div className="absolute inset-0 flex items-center justify-center theme-bg-card bg-opacity-75 z-10">
						<div className="flex items-center">
							<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
							<span className="theme-text-secondary">Loading performance data...</span>
						</div>
					</div>
				)}

				{selectedServerIds.length === 0 ? (
					<div className="h-full flex items-center justify-center">
						<div className="text-center">
							<Server className="h-16 w-16 theme-text-secondary mx-auto mb-4" />
							<h4 className="text-lg font-medium theme-text-primary mb-2">
								Select Servers to Monitor
							</h4>
							<p className="theme-text-secondary">
								Choose one or more servers to view their performance trends over time
							</p>
						</div>
					</div>
				) : !processedChartData ? (
					<div className="h-full flex items-center justify-center">
						<div className="text-center">
							<TrendingUp className="h-16 w-16 theme-text-secondary mx-auto mb-4" />
							<h4 className="text-lg font-medium theme-text-primary mb-2">
								No Data Available
							</h4>
							<p className="theme-text-secondary">
								No performance data found for the selected time range
							</p>
						</div>
					</div>
				) : (
					<div className="h-full">
						<Line data={processedChartData} options={chartOptions} />
					</div>
				)}
			</div>

			{/* Server Statistics */}
			{selectedServerIds.length > 0 && (
				<div className="p-4 border-t theme-border-primary">
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{selectedServerIds.map((serverId) => {
							const group = serverGroups.find(g => g.id === serverId);
							const stats = getServerStats(serverId);
							
							if (!group) return null;

							return (
								<div key={serverId} className="theme-bg-secondary p-4 rounded-lg">
									<div className="flex items-center justify-between mb-2">
										<h5 className="font-medium theme-text-primary">
											{group.hostname}
										</h5>
										<span className="text-xs theme-text-secondary">
											{group.protocol}
										</span>
									</div>
									<div className="grid grid-cols-2 gap-2 text-sm">
										<div>
											<span className="theme-text-secondary">Tests:</span>
											<span className="theme-text-primary ml-1">
												{group.totalTests}
											</span>
										</div>
										<div>
											<span className="theme-text-secondary">Last:</span>
											<span className="theme-text-primary ml-1">
												{formatTimeAgo(group.lastTestTime)}
											</span>
										</div>
										{stats && (
											<>
												<div>
													<span className="theme-text-secondary">Avg IOPS:</span>
													<span className="theme-text-primary ml-1">
														{stats.avgIops.toLocaleString()}
													</span>
												</div>
												<div>
													<span className="theme-text-secondary">Avg Latency:</span>
													<span className="theme-text-primary ml-1">
														{stats.avgLatency}ms
													</span>
												</div>
											</>
										)}
									</div>
								</div>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
};

export default TimeSeriesChart;