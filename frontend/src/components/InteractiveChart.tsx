import {
	BarElement,
	CategoryScale,
	Chart as ChartJS,
	Legend,
	LinearScale,
	LineElement,
	PointElement,
	TimeScale,
	Title,
	Tooltip,
} from "chart.js";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { Bar, Line } from "react-chartjs-2";
import "chartjs-adapter-date-fns";
import {
	ArrowUpDown,
	BarChart3,
	Download,
	Eye,
	EyeOff,
	Filter,
	Layers,
	Maximize,
	Minimize,
} from "lucide-react";
import { useThemeColors } from "../hooks/useThemeColors";
import type { ChartTemplate, PerformanceData } from "../types";

ChartJS.register(
	CategoryScale,
	LinearScale,
	BarElement,
	LineElement,
	PointElement,
	Title,
	Tooltip,
	Legend,
	TimeScale,
);

interface InteractiveChartProps {
	template: ChartTemplate;
	data: PerformanceData[];
	isMaximized?: boolean;
	onToggleMaximize?: () => void;
}

const InteractiveChart: React.FC<InteractiveChartProps> = ({
	template,
	data,
	isMaximized,
	onToggleMaximize,
}) => {
	const chartRef = useRef<any>(null);
	const [visibleSeries, setVisibleSeries] = useState<Set<string>>(new Set());
	const [chartData, setChartData] = useState<any>(null);
	const themeColors = useThemeColors();

	// Interactive controls for all chart templates
	const [sortBy, setSortBy] = useState<
		| "name"
		| "iops"
		| "latency"
		| "throughput"
		| "blocksize"
		| "drivemodel"
		| "protocol"
		| "hostname"
		| "queuedepth"
	>("name");
	const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
	const [groupBy, setGroupBy] = useState<
		| "none"
		| "drive"
		| "test"
		| "blocksize"
		| "protocol"
		| "hostname"
		| "queuedepth"
	>("none");

	useEffect(() => {
		if (data.length > 0) {
			const processedData = processDataForTemplate(template, data);
			setChartData(processedData);

			// Initialize all series as visible
			const allSeries = new Set(
				processedData.datasets.map((d: any) => d.label),
			);
			setVisibleSeries(allSeries);
		}
	}, [template, data, processDataForTemplate]);

	// Common sorting and grouping logic for all templates
	const applySortingAndGrouping = (data: PerformanceData[]) => {
		// Apply sorting
		const sortedData = [...data];
		sortedData.sort((a, b) => {
			let aValue: any, bValue: any;

			switch (sortBy) {
				case "name":
					aValue = `${a.test_name}_${a.drive_model}_${a.block_size}`;
					bValue = `${b.test_name}_${b.drive_model}_${b.block_size}`;
					break;
				case "iops":
					aValue = getMetricValue(a.metrics, "iops");
					bValue = getMetricValue(b.metrics, "iops");
					break;
				case "latency":
					aValue = getMetricValue(a.metrics, "avg_latency");
					bValue = getMetricValue(b.metrics, "avg_latency");
					break;
				case "throughput":
					aValue =
						getMetricValue(a.metrics, "throughput") ||
						getMetricValue(a.metrics, "bandwidth");
					bValue =
						getMetricValue(b.metrics, "throughput") ||
						getMetricValue(b.metrics, "bandwidth");
					break;
				case "blocksize":
					aValue = a.block_size;
					bValue = b.block_size;
					break;
				case "drivemodel":
					aValue = a.drive_model;
					bValue = b.drive_model;
					break;
				case "protocol":
					aValue = a.protocol || "";
					bValue = b.protocol || "";
					break;
				case "hostname":
					aValue = a.hostname || "";
					bValue = b.hostname || "";
					break;
				case "queuedepth":
					aValue = a.queue_depth || 0;
					bValue = b.queue_depth || 0;
					break;
				default:
					aValue = a.test_name;
					bValue = b.test_name;
			}

			const comparison =
				typeof aValue === "string"
					? aValue.localeCompare(bValue)
					: aValue - bValue;
			return sortOrder === "asc" ? comparison : -comparison;
		});

		return sortedData;
	};

	const processDataForTemplate = (
		template: ChartTemplate,
		data: PerformanceData[],
	) => {
		const colors = [
			"#3B82F6",
			"#EF4444",
			"#10B981",
			"#F59E0B",
			"#8B5CF6",
			"#06B6D4",
			"#F97316",
			"#84CC16",
			"#EC4899",
			"#6B7280",
		];

		const options = { sortBy, sortOrder, groupBy };

		switch (template.id) {
			case "performance-overview":
				return processPerformanceOverview(data, colors, options);

			case "block-size-impact":
				return processBlockSizeImpact(data, colors, options);

			case "read-write-comparison":
				return processReadWriteComparison(data, colors, options);

			case "iops-latency-dual":
				return processIOPSLatencyDual(data, colors, options);

			default:
				return processDefaultChart(data, colors, options);
		}
	};

	const getMetricValue = (
		metrics: any,
		metricName: string,
		operation?: string,
	): number => {
		// Handle flat structure (e.g., metrics.iops.value)
		if (
			metrics[metricName]?.value !== undefined &&
			metrics[metricName].value !== null
		) {
			return metrics[metricName].value;
		}

		// Handle operation-specific structure (e.g., metrics.read.iops.value or metrics.write.iops.value)
		if (
			operation &&
			metrics[operation]?.[metricName]?.value !== undefined &&
			metrics[operation][metricName].value !== null
		) {
			return metrics[operation][metricName].value;
		}

		// Try to find the metric in any operation (combined first, then read/write)
		for (const op of ["combined", "read", "write"]) {
			if (
				metrics[op]?.[metricName]?.value !== undefined &&
				metrics[op][metricName].value !== null
			) {
				return metrics[op][metricName].value;
			}
		}

		return 0;
	};

	const processDefaultChart = (
		data: PerformanceData[],
		colors: string[],
		options?: {
			sortBy:
				| "name"
				| "iops"
				| "latency"
				| "throughput"
				| "blocksize"
				| "drivemodel"
				| "protocol"
				| "hostname"
				| "queuedepth";
			sortOrder: "asc" | "desc";
			groupBy:
				| "none"
				| "drive"
				| "test"
				| "blocksize"
				| "protocol"
				| "hostname"
				| "queuedepth";
		},
	) => {
		const sortedData = applySortingAndGrouping(data);

		// Apply grouping
		if (options?.groupBy && options.groupBy !== "none") {
			return processGroupedData(sortedData, colors, options.groupBy);
		}

		// Simple default chart showing IOPS by hostname, model, protocol, pattern, block size, and queue depth
		const labels = sortedData.map(
			(item) =>
				`${item.hostname || "N/A"}\n${item.drive_model}\n${item.protocol || "N/A"}\n${item.read_write_pattern}\n${item.block_size}KB\nQD${item.queue_depth || "N/A"}`,
		);
		const iopsValues = sortedData.map((item) =>
			getMetricValue(item.metrics, "iops"),
		);

		const datasets = [
			{
				label: "IOPS",
				data: iopsValues,
				backgroundColor: colors[0],
				borderColor: colors[0],
				borderWidth: 1,
			},
		];

		return { labels, datasets };
	};

	const processPerformanceOverview = (
		data: PerformanceData[],
		colors: string[],
		options?: {
			sortBy:
				| "name"
				| "iops"
				| "latency"
				| "throughput"
				| "blocksize"
				| "drivemodel"
				| "protocol"
				| "hostname"
				| "queuedepth";
			sortOrder: "asc" | "desc";
			groupBy:
				| "none"
				| "drive"
				| "test"
				| "blocksize"
				| "protocol"
				| "hostname"
				| "queuedepth";
		},
	) => {
		const sortedData = applySortingAndGrouping(data);

		// Apply grouping
		if (options?.groupBy && options.groupBy !== "none") {
			return processGroupedData(sortedData, colors, options.groupBy);
		}

		// Default ungrouped view
		const labels = sortedData.map(
			(item) =>
				`${item.hostname || "N/A"}\n${item.drive_model}\n${item.protocol || "N/A"}\n${item.read_write_pattern}\n${item.block_size}KB\nQD${item.queue_depth ?? "N/A"}`,
		);

		const datasets = [
			{
				label: "IOPS",
				data: sortedData.map((item) => getMetricValue(item.metrics, "iops")),
				backgroundColor: colors[0],
				borderColor: colors[0],
				borderWidth: 1,
				yAxisID: "y",
			},
			{
				label: "Avg Latency (ms)",
				data: sortedData.map((item) =>
					getMetricValue(item.metrics, "avg_latency"),
				),
				backgroundColor: colors[1],
				borderColor: colors[1],
				borderWidth: 1,
				yAxisID: "y1",
			},
			{
				label: "Throughput (MB/s)",
				data: sortedData.map(
					(item) =>
						getMetricValue(item.metrics, "throughput") ||
						getMetricValue(item.metrics, "bandwidth"),
				),
				backgroundColor: colors[2],
				borderColor: colors[2],
				borderWidth: 1,
				yAxisID: "y2",
			},
		];

		return { labels, datasets };
	};

	const processGroupedData = (
		data: PerformanceData[],
		colors: string[],
		groupBy: string,
	) => {
		// Group data based on groupBy parameter
		const groups = new Map<string, PerformanceData[]>();

		data.forEach((item) => {
			let key: string;
			switch (groupBy) {
				case "drive":
					key = item.drive_model;
					break;
				case "test":
					key = item.test_name;
					break;
				case "blocksize":
					key = `${item.block_size}KB`;
					break;
				case "protocol":
					key = item.protocol || "Unknown Protocol";
					break;
				case "hostname":
					key = item.hostname || "Unknown Host";
					break;
				case "queuedepth":
					key = `QD${item.queue_depth || "N/A"}`;
					break;
				default:
					key = "default";
			}

			if (!groups.has(key)) {
				groups.set(key, []);
			}
			groups.get(key)?.push(item);
		});

		// Create labels and datasets for grouped data
		const groupKeys = Array.from(groups.keys());
		const labels = groupKeys;

		// Grouped view - show average values for each metric per group
		const datasets = [
			{
				label: "Avg IOPS",
				data: groupKeys.map((key) => {
					const groupData = groups.get(key)!;
					return (
						groupData.reduce(
							(sum, item) => sum + getMetricValue(item.metrics, "iops"),
							0,
						) / groupData.length
					);
				}),
				backgroundColor: colors[0],
				borderColor: colors[0],
				borderWidth: 1,
				yAxisID: "y",
			},
			{
				label: "Avg Latency (ms)",
				data: groupKeys.map((key) => {
					const groupData = groups.get(key)!;
					return (
						groupData.reduce(
							(sum, item) => sum + getMetricValue(item.metrics, "avg_latency"),
							0,
						) / groupData.length
					);
				}),
				backgroundColor: colors[1],
				borderColor: colors[1],
				borderWidth: 1,
				yAxisID: "y1",
			},
			{
				label: "Avg Throughput (MB/s)",
				data: groupKeys.map((key) => {
					const groupData = groups.get(key)!;
					return (
						groupData.reduce(
							(sum, item) =>
								sum +
								(getMetricValue(item.metrics, "throughput") ||
									getMetricValue(item.metrics, "bandwidth")),
							0,
						) / groupData.length
					);
				}),
				backgroundColor: colors[2],
				borderColor: colors[2],
				borderWidth: 1,
				yAxisID: "y2",
			},
		];

		return { labels, datasets };
	};

	const processBlockSizeImpact = (
		data: PerformanceData[],
		colors: string[],
		options?: {
			sortBy:
				| "name"
				| "iops"
				| "latency"
				| "throughput"
				| "blocksize"
				| "drivemodel"
				| "protocol"
				| "hostname"
				| "queuedepth";
			sortOrder: "asc" | "desc";
			groupBy:
				| "none"
				| "drive"
				| "test"
				| "blocksize"
				| "protocol"
				| "hostname"
				| "queuedepth";
		},
	) => {
		const sortedData = applySortingAndGrouping(data);

		// Apply grouping if requested
		if (options?.groupBy && options.groupBy !== "none") {
			return processGroupedData(sortedData, colors, options.groupBy);
		}

		// Group by drive model and show performance across block sizes
		const groupedData = new Map<
			string,
			Map<number, { iops: number; throughput: number }>
		>();

		sortedData.forEach((item) => {
			const driveKey = item.drive_model;
			const blockSize = item.block_size;

			if (!groupedData.has(driveKey)) {
				groupedData.set(driveKey, new Map());
			}

			const iopsValue = getMetricValue(item.metrics, "iops");
			const throughputValue =
				getMetricValue(item.metrics, "throughput") ||
				getMetricValue(item.metrics, "bandwidth");

			groupedData
				.get(driveKey)
				?.set(blockSize, { iops: iopsValue, throughput: throughputValue });
		});

		const blockSizes = Array.from(
			new Set(sortedData.map((item) => item.block_size)),
		).sort((a, b) => a - b);
		const drives = Array.from(groupedData.keys());

		const datasets = drives.map((drive, index) => ({
			label: drive,
			data: blockSizes.map(
				(size) => groupedData.get(drive)?.get(size)?.iops || 0,
			),
			borderColor: colors[index % colors.length],
			backgroundColor: `${colors[index % colors.length]}20`,
			tension: 0.1,
		}));

		return {
			labels: blockSizes.map((size) => `${size}KB`),
			datasets,
		};
	};

	const processReadWriteComparison = (
		data: PerformanceData[],
		colors: string[],
		options?: {
			sortBy:
				| "name"
				| "iops"
				| "latency"
				| "throughput"
				| "blocksize"
				| "drivemodel"
				| "protocol"
				| "hostname"
				| "queuedepth";
			sortOrder: "asc" | "desc";
			groupBy:
				| "none"
				| "drive"
				| "test"
				| "blocksize"
				| "protocol"
				| "hostname"
				| "queuedepth";
		},
	) => {
		const sortedData = applySortingAndGrouping(data);

		// Apply grouping if requested
		if (options?.groupBy && options.groupBy !== "none") {
			return processGroupedData(sortedData, colors, options.groupBy);
		}

		// Compare read vs write operations side by side
		const groupedData = new Map<string, { read: number; write: number }>();

		sortedData.forEach((item) => {
			const testKey = `${item.hostname || "N/A"}\n${item.drive_model}\n${item.protocol || "N/A"}\n${item.read_write_pattern}\n${item.block_size}KB\nQD${item.queue_depth || "N/A"}`;

			const readIOPS = getMetricValue(item.metrics, "iops", "read");
			const writeIOPS = getMetricValue(item.metrics, "iops", "write");

			// If no operation-specific data, infer from pattern
			let inferredRead = readIOPS;
			let inferredWrite = writeIOPS;

			if (readIOPS === 0 && writeIOPS === 0) {
				const totalIOPS = getMetricValue(item.metrics, "iops");
				if (item.read_write_pattern.includes("read")) {
					inferredRead = totalIOPS;
				} else if (item.read_write_pattern.includes("write")) {
					inferredWrite = totalIOPS;
				} else {
					// Mixed workload - split evenly
					inferredRead = totalIOPS * 0.5;
					inferredWrite = totalIOPS * 0.5;
				}
			}

			groupedData.set(testKey, { read: inferredRead, write: inferredWrite });
		});

		const labels = Array.from(groupedData.keys());
		const datasets = [
			{
				label: "Read IOPS",
				data: labels.map((label) => groupedData.get(label)?.read || 0),
				backgroundColor: colors[0],
				borderColor: colors[0],
				borderWidth: 1,
			},
			{
				label: "Write IOPS",
				data: labels.map((label) => groupedData.get(label)?.write || 0),
				backgroundColor: colors[1],
				borderColor: colors[1],
				borderWidth: 1,
			},
		];

		return { labels, datasets };
	};

	const processIOPSLatencyDual = (
		data: PerformanceData[],
		colors: string[],
		options?: {
			sortBy:
				| "name"
				| "iops"
				| "latency"
				| "throughput"
				| "blocksize"
				| "drivemodel"
				| "protocol"
				| "hostname"
				| "queuedepth";
			sortOrder: "asc" | "desc";
			groupBy:
				| "none"
				| "drive"
				| "test"
				| "blocksize"
				| "protocol"
				| "hostname"
				| "queuedepth";
		},
	) => {
		const sortedData = applySortingAndGrouping(data);

		// Apply grouping if requested
		if (options?.groupBy && options.groupBy !== "none") {
			return processGroupedData(sortedData, colors, options.groupBy);
		}

		// Dual-axis chart with IOPS and Latency
		const labels = sortedData.map(
			(item) =>
				`${item.hostname || "N/A"}\n${item.drive_model}\n${item.protocol || "N/A"}\n${item.read_write_pattern}\n${item.block_size}KB\nQD${item.queue_depth || "N/A"}`,
		);

		const datasets = [
			{
				label: "IOPS",
				data: sortedData.map((item) => getMetricValue(item.metrics, "iops")),
				backgroundColor: colors[0],
				borderColor: colors[0],
				borderWidth: 1,
				yAxisID: "y",
			},
			{
				label: "Avg Latency (ms)",
				data: sortedData.map((item) =>
					getMetricValue(item.metrics, "avg_latency"),
				),
				backgroundColor: `${colors[1]}80`, // Semi-transparent
				borderColor: colors[1],
				borderWidth: 2,
				yAxisID: "y1",
			},
		];

		return { labels, datasets };
	};

	const getScalesForTemplate = (template: ChartTemplate, themeColors: any) => {
		const baseXAxis = {
			display: true,
			title: {
				display: true,
				text: template.xAxis.replace(/_/g, " ").toUpperCase(),
				color: themeColors.chart.text,
			},
			ticks: {
				color: themeColors.chart.axis,
			},
			grid: {
				color: themeColors.chart.grid,
			},
		};

		const baseYAxis = {
			display: true,
			title: {
				display: true,
				text: "IOPS",
				color: themeColors.chart.text,
			},
			ticks: {
				color: themeColors.chart.axis,
			},
			grid: {
				color: themeColors.chart.grid,
			},
		};

		// Multi-axis charts
		if (template.id === "performance-overview") {
			return {
				x: baseXAxis,
				y: { ...baseYAxis, title: { ...baseYAxis.title, text: "IOPS" } },
				y1: {
					...baseYAxis,
					position: "right" as const,
					title: { ...baseYAxis.title, text: "Latency (ms)" },
					grid: { drawOnChartArea: false },
				},
				y2: {
					...baseYAxis,
					display: false, // Hide third axis to avoid clutter
				},
			};
		}

		if (template.id === "iops-latency-dual") {
			return {
				x: baseXAxis,
				y: { ...baseYAxis, title: { ...baseYAxis.title, text: "IOPS" } },
				y1: {
					...baseYAxis,
					position: "right" as const,
					title: { ...baseYAxis.title, text: "Latency (ms)" },
					grid: { drawOnChartArea: false },
				},
			};
		}

		// Single axis charts
		return {
			x: baseXAxis,
			y: {
				...baseYAxis,
				title: {
					...baseYAxis.title,
					text: template.yAxis.replace(/_/g, " ").toUpperCase(),
				},
			},
		};
	};

	const toggleSeriesVisibility = (seriesLabel: string) => {
		const newVisibleSeries = new Set(visibleSeries);
		if (newVisibleSeries.has(seriesLabel)) {
			newVisibleSeries.delete(seriesLabel);
		} else {
			newVisibleSeries.add(seriesLabel);
		}
		setVisibleSeries(newVisibleSeries);

		if (chartRef.current) {
			const chart = chartRef.current;
			const datasetIndex = chart.data.datasets.findIndex(
				(d: any) => d.label === seriesLabel,
			);
			if (datasetIndex !== -1) {
				chart.setDatasetVisibility(
					datasetIndex,
					newVisibleSeries.has(seriesLabel),
				);
				chart.update();
			}
		}
	};

	const exportChart = (format: "png" | "csv") => {
		if (!chartRef.current) return;

		if (format === "png") {
			const canvas = chartRef.current.canvas;
			const url = canvas.toDataURL("image/png");
			const link = document.createElement("a");
			link.download = `${template.name.toLowerCase().replace(/\s+/g, "-")}-chart.png`;
			link.href = url;
			link.click();
		} else if (format === "csv") {
			const csvContent = generateCSV(data);
			const blob = new Blob([csvContent], { type: "text/csv" });
			const url = URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.download = `${template.name.toLowerCase().replace(/\s+/g, "-")}-data.csv`;
			link.href = url;
			link.click();
			URL.revokeObjectURL(url);
		}
	};

	const generateCSV = (data: PerformanceData[]) => {
		const headers = [
			"Drive Model",
			"Drive Type",
			"Test Name",
			"Block Size",
			"Pattern",
			"Queue Depth",
			"Timestamp",
		];
		const metricHeaders = [
			"IOPS",
			"Avg Latency (ms)",
			"Throughput (MB/s)",
			"P95 Latency (ms)",
			"P99 Latency (ms)",
		];

		const csvRows = [
			[...headers, ...metricHeaders].join(","),
			...data.map((item) =>
				[
					item.drive_model,
					item.drive_type,
					item.test_name,
					item.block_size,
					item.read_write_pattern,
					item.queue_depth,
					item.timestamp,
					getMetricValue(item.metrics, "iops") || "",
					getMetricValue(item.metrics, "avg_latency") || "",
					getMetricValue(item.metrics, "throughput") ||
						getMetricValue(item.metrics, "bandwidth") ||
						"",
					getMetricValue(item.metrics, "p95_latency") || "",
					getMetricValue(item.metrics, "p99_latency") || "",
				].join(","),
			),
		];

		return csvRows.join("\n");
	};

	const chartOptions = {
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			legend: {
				position: "top" as const,
				onClick: (_e: any, legendItem: any) => {
					toggleSeriesVisibility(legendItem.text);
				},
				labels: {
					color: themeColors.chart.text,
				},
			},
			title: {
				display: true,
				text: template.name,
				font: {
					size: 16,
					weight: "bold" as "bold",
				},
				color: themeColors.chart.text,
			},
			tooltip: {
				mode: "index" as const,
				intersect: false,
				backgroundColor: themeColors.chart.tooltipBg,
				titleColor: themeColors.text.primary,
				bodyColor: themeColors.text.secondary,
				borderColor: themeColors.chart.tooltipBorder,
				borderWidth: 1,
				callbacks: {
					afterLabel: (context: any) => {
						const dataIndex = context.dataIndex;
						const item = data[dataIndex];
						if (item) {
							return [
								`Drive: ${item.drive_model}`,
								`Pattern: ${item.read_write_pattern}`,
								`Block Size: ${item.block_size}KB`,
								`Queue Depth: ${item.queue_depth}`,
							];
						}
						return [];
					},
				},
			},
		},
		scales: getScalesForTemplate(template, themeColors),
		interaction: {
			mode: "nearest" as const,
			axis: "x" as const,
			intersect: false,
		},
	};

	if (!chartData || data.length === 0) {
		return (
			<div
				className={`theme-card rounded-lg shadow-md p-6 border ${isMaximized ? "fixed inset-0 z-50 bg-white dark:bg-gray-900" : ""}`}
			>
				<div className="text-center py-12">
					<div className="theme-text-tertiary mb-4">
						<BarChart3 size={48} className="mx-auto" />
					</div>
					<p className="theme-text-secondary">
						Select test runs to view performance data
					</p>
				</div>
			</div>
		);
	}

	const ChartComponent = template.chartType === "line" ? Line : Bar;

	return (
		<div
			className={`theme-card rounded-lg shadow-md p-6 border ${isMaximized ? "fixed inset-0 z-50 bg-white dark:bg-gray-900 overflow-auto" : ""}`}
		>
			<div className="flex justify-between items-center mb-4">
				<h2 className="text-xl font-semibold theme-text-primary">
					{template.name}
				</h2>

				<div className="flex space-x-2">
					{onToggleMaximize && (
						<button
							onClick={onToggleMaximize}
							className="flex items-center px-3 py-2 theme-btn-secondary rounded transition-colors"
							title={isMaximized ? "Exit fullscreen" : "Enter fullscreen"}
						>
							{isMaximized ? <Minimize size={16} /> : <Maximize size={16} />}
						</button>
					)}
					<button
						onClick={() => exportChart("png")}
						className="flex items-center px-3 py-2 theme-btn-primary rounded transition-colors"
					>
						<Download size={16} className="mr-1" />
						PNG
					</button>
					<button
						onClick={() => exportChart("csv")}
						className="flex items-center px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
					>
						<Download size={16} className="mr-1" />
						CSV
					</button>
				</div>
			</div>

			{/* Interactive Controls for All Chart Templates */}
			{
				<div className="mb-4 p-4 theme-bg-secondary rounded-lg border theme-border-primary">
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						{/* Reset Controls */}
						<div>
							<label className="block text-sm font-medium theme-text-secondary mb-2">
								<Filter size={14} className="inline mr-1" />
								Reset
							</label>
							<button
								onClick={() => {
									setSortBy("name");
									setSortOrder("asc");
									setGroupBy("none");
								}}
								className="w-full px-3 py-1 text-sm theme-btn-secondary rounded transition-colors"
							>
								Reset All
							</button>
						</div>

						{/* Sort Controls */}
						<div>
							<label className="block text-sm font-medium theme-text-secondary mb-2">
								<ArrowUpDown size={14} className="inline mr-1" />
								Sort By
							</label>
							<div className="flex space-x-2">
								<select
									value={sortBy}
									onChange={(e) => setSortBy(e.target.value as any)}
									className="flex-1 px-3 py-1 text-sm border theme-border-primary rounded theme-bg-card theme-text-primary"
								>
									<option value="name">Name</option>
									<option value="iops">IOPS</option>
									<option value="latency">Latency</option>
									<option value="throughput">Throughput</option>
									<option value="blocksize">Block Size</option>
									<option value="drivemodel">Drive Model</option>
									<option value="protocol">Protocol</option>
									<option value="hostname">Hostname</option>
									<option value="queuedepth">Queue Depth</option>
								</select>
								<button
									onClick={() =>
										setSortOrder(sortOrder === "asc" ? "desc" : "asc")
									}
									className="px-3 py-1 text-sm theme-btn-secondary rounded transition-colors"
									title={`Sort ${sortOrder === "asc" ? "Descending" : "Ascending"}`}
								>
									{sortOrder === "asc" ? "↑" : "↓"}
								</button>
							</div>
						</div>

						{/* Group Controls */}
						<div>
							<label className="block text-sm font-medium theme-text-secondary mb-2">
								<Layers size={14} className="inline mr-1" />
								Group By
							</label>
							<select
								value={groupBy}
								onChange={(e) => setGroupBy(e.target.value as any)}
								className="w-full px-3 py-1 text-sm border theme-border-primary rounded theme-bg-card theme-text-primary"
							>
								<option value="none">No Grouping</option>
								<option value="drive">Drive Model</option>
								<option value="test">Test Type</option>
								<option value="blocksize">Block Size</option>
								<option value="protocol">Protocol</option>
								<option value="hostname">Hostname</option>
								<option value="queuedepth">Queue Depth</option>
							</select>
						</div>
					</div>
				</div>
			}

			{/* Series Toggle Controls */}
			{chartData.datasets.length > 1 && (
				<div className="mb-4">
					<div className="flex flex-wrap gap-2">
						{chartData.datasets.map((dataset: any) => (
							<button
								key={dataset.label}
								onClick={() => toggleSeriesVisibility(dataset.label)}
								className={`flex items-center px-3 py-1 rounded text-sm transition-colors border ${
									visibleSeries.has(dataset.label)
										? "theme-bg-accent theme-text-accent theme-border-accent"
										: "theme-bg-tertiary theme-text-secondary theme-border-primary"
								}`}
							>
								{visibleSeries.has(dataset.label) ? (
									<Eye size={14} className="mr-1" />
								) : (
									<EyeOff size={14} className="mr-1" />
								)}
								{dataset.label}
							</button>
						))}
					</div>
				</div>
			)}

			<div className={isMaximized ? "h-[calc(100vh-280px)]" : "h-[600px]"}>
				<ChartComponent
					ref={chartRef}
					data={chartData}
					options={chartOptions}
				/>
			</div>

			{/* Chart Statistics */}
			<div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
				<div className="theme-bg-secondary p-3 rounded border theme-border-primary">
					<div className="font-medium theme-text-secondary">Data Points</div>
					<div className="text-lg font-semibold theme-text-primary">
						{data.length}
					</div>
				</div>
				<div className="theme-bg-secondary p-3 rounded border theme-border-primary">
					<div className="font-medium theme-text-secondary">Series</div>
					<div className="text-lg font-semibold theme-text-primary">
						{chartData.datasets.length}
					</div>
				</div>
				<div className="theme-bg-secondary p-3 rounded border theme-border-primary">
					<div className="font-medium theme-text-secondary">Visible</div>
					<div className="text-lg font-semibold theme-text-primary">
						{visibleSeries.size}
					</div>
				</div>
				<div className="theme-bg-secondary p-3 rounded border theme-border-primary">
					<div className="font-medium theme-text-secondary">Chart Type</div>
					<div className="text-lg font-semibold capitalize theme-text-primary">
						{template.chartType}
					</div>
				</div>
			</div>
		</div>
	);
};

export default InteractiveChart;
