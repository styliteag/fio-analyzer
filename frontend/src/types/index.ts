export interface TestRun {
	id: number;
	timestamp: string;
	drive_model: string;
	drive_type: string;
	test_name: string;
	block_size: number;
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
