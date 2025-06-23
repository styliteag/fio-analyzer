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
}

export interface PerformanceMetric {
  value: number;
  unit: string;
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