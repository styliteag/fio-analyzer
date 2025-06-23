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
  block_size: number;
  read_write_pattern: string;
  timestamp: string;
  queue_depth: number;
  metrics: Record<string, PerformanceMetric>;
}

export interface FilterOptions {
  drive_types: string[];
  drive_models: string[];
  patterns: string[];
  block_sizes: number[];
}

export interface ChartTemplate {
  id: string;
  name: string;
  description: string;
  chartType: 'bar' | 'line' | 'scatter';
  xAxis: string;
  yAxis: string;
  groupBy?: string;
  metrics: string[];
}

export interface LatencyPercentile {
  id: number;
  test_run_id: number;
  operation_type: string;
  percentile: number;
  latency_ns: number;
}