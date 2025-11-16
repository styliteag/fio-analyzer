/**
 * Chart.js and visualization type definitions
 * Provides proper typing for chart datasets and options
 */

import type { 
  ChartDataset, 
  ChartOptions, 
  ChartConfiguration,
  Point,
  ScatterDataPoint,
  BubbleDataPoint
} from 'chart.js';

// Base chart dataset with common properties
export interface BaseChartDataset<T = number | Point | ScatterDataPoint | BubbleDataPoint> {
  label: string;
  data: T[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
  borderWidth?: number;
  pointRadius?: number;
  pointHoverRadius?: number;
  tension?: number;
  fill?: boolean;
  borderDash?: number[];
}

// Time series specific dataset (compatible with Chart.js Point type)
export interface TimeSeriesDataset extends BaseChartDataset<Point> {
  yAxisID: string;
  data: Array<{ x: number; y: number }>; // x must be number for Chart.js time scale
}

// Line chart dataset
export interface LineChartDataset extends ChartDataset<'line', Point[]> {
  yAxisID?: string;
}

// Bar chart dataset
export interface BarChartDataset extends ChartDataset<'bar', number[]> {
  categoryPercentage?: number;
  barPercentage?: number;
}

// Scatter plot dataset
export interface ScatterChartDataset extends ChartDataset<'scatter', ScatterDataPoint[]> {
  showLine?: boolean;
}

// Radar chart dataset
export interface RadarChartDataset extends ChartDataset<'radar', number[]> {
  pointBackgroundColor?: string;
  pointBorderColor?: string;
}

// Chart data structure
export interface ChartData<T extends ChartDataset = ChartDataset> {
  labels?: string[];
  datasets: T[];
}

// Chart configuration options
export interface BaseChartOptions extends ChartOptions {
  responsive: boolean;
  maintainAspectRatio?: boolean;
}

// Time series chart options (extends Chart.js line chart options)
export interface TimeSeriesChartOptions extends ChartOptions<'line'> {}

// Chart color scheme
export interface ChartColorScheme {
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  light: string;
  dark: string;
}

// Chart theme configuration
export interface ChartTheme {
  colors: ChartColorScheme;
  gridColor: string;
  textColor: string;
  backgroundColor: string;
  borderColor: string;
}

// Performance metrics for charts
export interface PerformanceChartDataPoint {
  x: string | number;
  y: number;
  hostname?: string;
  protocol?: string;
  drive_model?: string;
  block_size?: string;
  pattern?: string;
  queue_depth?: number;
}

// Chart export options
export interface ChartExportOptions {
  format: 'png' | 'jpg' | 'svg' | 'pdf';
  quality?: number;
  width?: number;
  height?: number;
  backgroundColor?: string;
}

// Chart configuration templates
export interface ChartTemplate {
  id: string;
  name: string;
  description: string;
  chartType: 'bar' | 'line' | 'scatter' | '3d-bar' | 'time-series' | 'radar-grid';
  xAxis: string;
  yAxis: string;
  groupBy?: string;
  metrics: string[];
  options?: Partial<ChartConfiguration['options']>;
}

// 3D chart specific types
export interface ThreeDBarChartData {
  x: string;
  y: string;
  z: number;
  color?: string;
  label?: string;
}

// Radar chart specific types
export interface RadarChartData {
  hostname: string;
  protocol: string;
  pools: RadarPoolData[];
}

export interface RadarPoolData {
  poolName: string;
  metrics: RadarMetrics;
  color: string;
}

export interface RadarMetrics {
  iops: number;
  latency: number;
  bandwidth: number;
  p70_latency: number;
  p90_latency: number;
  p95_latency: number;
  p99_latency: number;
  consistency: number;
}

// Chart interaction types
export interface ChartInteractionEvent {
  type: 'click' | 'hover' | 'leave';
  datasetIndex?: number;
  dataIndex?: number;
  data?: unknown;
}

// Chart filter state
export interface ChartFilterState {
  metrics: string[];
  timeRange?: string;
  hostnames?: string[];
  protocols?: string[];
  driveTypes?: string[];
}

// Type guards for chart data
export const isTimeSeriesDataset = (dataset: unknown): dataset is TimeSeriesDataset => {
  return (
    typeof dataset === 'object' &&
    dataset !== null &&
    'yAxisID' in dataset &&
    'data' in dataset &&
    Array.isArray((dataset as TimeSeriesDataset).data)
  );
};

export const isPerformanceDataPoint = (point: unknown): point is PerformanceChartDataPoint => {
  return (
    typeof point === 'object' &&
    point !== null &&
    'x' in point &&
    'y' in point &&
    typeof (point as PerformanceChartDataPoint).y === 'number'
  );
};

// Chart utility types
export type ChartMetricType = 'iops' | 'latency' | 'bandwidth' | 'p95_latency' | 'p99_latency';

export type ChartAxisType = 'linear' | 'logarithmic' | 'time' | 'category';

export interface ChartAxisConfig {
  type: ChartAxisType;
  title: string;
  color?: string;
  position?: 'left' | 'right' | 'top' | 'bottom';
  display?: boolean;
}

// Chart responsive breakpoints
export interface ChartResponsiveConfig {
  breakpoints: {
    mobile: number;
    tablet: number;
    desktop: number;
  };
  options: {
    mobile: Partial<ChartOptions>;
    tablet: Partial<ChartOptions>;
    desktop: Partial<ChartOptions>;
  };
}