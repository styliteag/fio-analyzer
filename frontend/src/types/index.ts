export interface TestRun {
	id: number;
	timestamp: string;
	drive_model: string;
	drive_type: string;
	test_name: string;
	description?: string;
	block_size: number | string;
	read_write_pattern: string;
	queue_depth: number;
	duration: number;
	fio_version?: string;
	job_runtime?: number;
	rwmixread?: number;
	total_ios_read?: number;
	total_ios_write?: number;
	usr_cpu?: number;
	sys_cpu?: number;
	hostname?: string;
	protocol?: string;
	// Job options fields from database consolidation
	output_file?: string;
	num_jobs?: number;
	direct?: number;
	test_size?: string;
	sync?: number;
	iodepth?: number;
	// Uniqueness tracking
	is_latest?: number;
}

export interface PerformanceMetric {
	value: number;
	unit: string;
	operation_type?: string;
}

export interface PerformanceData {
	id: number;
	drive_model: string;
	drive_type: string;
	test_name: string;
	description?: string;
	block_size: string | number;
	read_write_pattern: string;
	timestamp: string;
	queue_depth: number;
	hostname?: string;
	protocol?: string;
	metrics: Record<string, PerformanceMetric>;
}

export interface FilterOptions {
	drive_types: string[];
	drive_models: string[];
	patterns: string[];
	block_sizes: (string | number)[];
	hostnames: string[];
	protocols: string[];
}

export interface ChartTemplate {
	id: string;
	name: string;
	description: string;
	chartType: "bar" | "line" | "scatter" | "3d-bar" | "time-series";
	xAxis: string;
	yAxis: string;
	groupBy?: string;
	metrics: string[];
}

// Time-series interfaces
export interface ServerInfo {
	hostname: string;
	protocol: string;
	drive_model: string;
	test_count: number;
	last_test_time: string;
	first_test_time: string;
}

export interface TimeSeriesDataPoint {
	timestamp: string;
	hostname: string;
	protocol: string;
	drive_model: string;
	block_size: string;
	read_write_pattern: string;
	queue_depth: number;
	metric_type: string;
	value: number;
	unit: string;
}

export interface TrendDataPoint {
	timestamp: string;
	block_size: string;
	read_write_pattern: string;
	queue_depth: number;
	value: number;
	unit: string;
	moving_avg: number;
	percent_change: string;
}

// Time Series Component Types
export interface TimeSeriesMetricsPoint {
	timestamp: string;
	value: number;
	metric_type: string;
}

export interface TimeSeriesServerGroup {
	id: string;
	hostname: string;
	protocol: string;
	driveModels: string[];
	totalTests: number;
	lastTestTime: string;
	firstTestTime: string;
}

export interface TimeSeriesEnabledMetrics {
	iops: boolean;
	latency: boolean;
	bandwidth: boolean;
}

export type TimeSeriesTimeRange = "24h" | "7d" | "30d";

export interface TimeSeriesChartDataset {
	label: string;
	data: Array<{ x: string; y: number }>;
	borderColor: string;
	backgroundColor: string;
	borderDash?: number[];
	tension: number;
	fill: boolean;
	yAxisID: string;
	pointRadius: number;
	pointHoverRadius: number;
}
