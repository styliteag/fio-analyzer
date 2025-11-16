/**
 * Type definitions for Performance Graphs visualization components
 */

import type { DriveAnalysis } from '../../../services/api/hostAnalysis';

// Main component props
export interface PerformanceGraphsProps {
  drives: DriveAnalysis[];
}

// Chart type definitions
export type ChartType = 'iops-comparison' | 'latency-analysis' | 'bandwidth-trends' | 'responsiveness';
export type PatternType = 'random_read' | 'random_write' | 'sequential_read' | 'sequential_write';
export type MetricType = 'iops' | 'avg_latency' | 'p70_latency' | 'p90_latency' | 'p95_latency' | 'p99_latency' | 'bandwidth' | 'responsiveness';

// Chart configuration
export interface ChartConfig {
  type: ChartType;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  supportedMetrics: MetricType[];
  defaultMetrics: MetricType[];
}

// Chart data structures
export interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor: string | string[];
  borderColor: string | string[];
  borderWidth: number;
  tension?: number;
  fill?: boolean;
  pointRadius?: number;
  pointHoverRadius?: number;
  borderDash?: number[];
  yAxisID?: string;
}

export interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

// Data processing types
export interface DataPoint {
  hostname: string;
  driveModel: string;
  driveType: string;
  protocol: string;
  blockSize: string;
  pattern: PatternType;
  iops: number;
  avgLatency: number | null;
  p70Latency: number | null;
  p90Latency: number | null;
  p95Latency: number | null;
  p99Latency: number | null;
  bandwidth: number | null;
  responsiveness: number | null;
  queueDepth: number;
  timestamp: string;
}

export interface SeriesDefinition {
  id: string;
  hostname: string;
  driveModel: string;
  protocol: string;
  driveType: string;
  label: string;
  color: string;
  data: DataPoint[];
}

export interface AggregatedData {
  blockSizes: string[];
  patterns: PatternType[];
  hosts: string[];
  series: SeriesDefinition[];
  maxValues: Record<MetricType, number>;
}

// Filtering types
export interface ChartFilters {
  selectedPatterns: PatternType[];
  selectedHosts: string[];
  selectedMetrics: MetricType[];
  selectedBlockSizes: string[];
}

// Error handling
export interface ChartError {
  type: 'data' | 'rendering' | 'export' | 'configuration';
  message: string;
  details?: any;
  timestamp: string;
}

// Theme integration
export interface ChartTheme {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  gridColor: string;
  tooltipBackground: string;
  tooltipBorder: string;
  tooltipText: string;
}

export interface ColorPalette {
  primary: string[];
  secondary: string[];
  accent: string[];
}

export interface ThemeConfig {
  isDark: boolean;
  theme: ChartTheme;
  colors: ColorPalette;
}

// Validation types
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}