/**
 * Component Interface Contracts for Performance Graphs Visualization
 *
 * This file defines the contractual interfaces that all components
 * must implement to ensure consistent integration and type safety.
 */

import { DriveAnalysis } from '../../../frontend/src/services/api/hostAnalysis';

// =============================================================================
// MAIN COMPONENT CONTRACTS
// =============================================================================

export interface PerformanceGraphsContract {
  /**
   * Main container component for performance graphs visualization
   */
  drives: DriveAnalysis[];
}

export interface ChartComponentContract<TData = any> {
  /**
   * Base contract that all chart components must implement
   */
  data: TData;
  options: ChartOptionsContract;
  loading?: boolean;
  error?: string | null;
  onDataPointClick?: (dataPoint: any) => void;
  onLegendClick?: (legendItem: any) => void;
}

export interface IOPSComparisonChartContract extends ChartComponentContract {
  /**
   * IOPS comparison line chart component
   */
  data: IOPSChartData;
  selectedPatterns: PatternType[];
  onPatternToggle: (pattern: PatternType) => void;
}

export interface LatencyAnalysisChartContract extends ChartComponentContract {
  /**
   * Latency analysis multi-axis chart component
   */
  data: LatencyChartData;
  showPercentiles: boolean;
  onMetricToggle: (metric: LatencyMetricType) => void;
}

export interface BandwidthTrendsChartContract extends ChartComponentContract {
  /**
   * Bandwidth trends area chart component
   */
  data: BandwidthChartData;
  stackingMode: 'none' | 'normal' | 'percent';
  onStackingChange: (mode: 'none' | 'normal' | 'percent') => void;
}

export interface ResponsivenessChartContract extends ChartComponentContract {
  /**
   * Responsiveness horizontal bar chart component
   */
  data: ResponsivenessChartData;
  sortBy: 'hostname' | 'value';
  sortOrder: 'asc' | 'desc';
  onSortChange: (sortBy: 'hostname' | 'value', order: 'asc' | 'desc') => void;
}

// =============================================================================
// CONTROL COMPONENTS CONTRACTS
// =============================================================================

export interface ChartControlsContract {
  /**
   * Chart type selection and configuration controls
   */
  activeChart: ChartType;
  availableCharts: ChartConfig[];
  onChartChange: (chart: ChartType) => void;
  disabled?: boolean;
}

export interface FilterControlsContract {
  /**
   * Data filtering and selection controls
   */
  filters: ChartFilters;
  availableFilters: AvailableFilters;
  onFilterChange: (filters: Partial<ChartFilters>) => void;
  onReset: () => void;
}

export interface ExportControlsContract {
  /**
   * Chart and data export functionality
   */
  chartRef: React.RefObject<any>;
  chartData: any;
  filename: string;
  onExport: (format: 'png' | 'csv', options?: ExportOptions) => Promise<void>;
  isExporting: boolean;
  exportError: string | null;
}

// =============================================================================
// DATA CONTRACTS
// =============================================================================

export interface ChartOptionsContract {
  /**
   * Chart.js configuration options contract
   */
  responsive: boolean;
  maintainAspectRatio: boolean;
  plugins: {
    title: TitlePluginContract;
    legend: LegendPluginContract;
    tooltip: TooltipPluginContract;
  };
  scales: ScalesContract;
  animation: AnimationContract;
  interaction: InteractionContract;
}

export interface TitlePluginContract {
  display: boolean;
  text: string;
  font?: {
    size: number;
    family: string;
    weight: 'normal' | 'bold';
  };
  color?: string;
}

export interface LegendPluginContract {
  display: boolean;
  position: 'top' | 'bottom' | 'left' | 'right';
  onClick?: (event: any, legendItem: any) => void;
  labels?: {
    usePointStyle: boolean;
    padding: number;
    color: string;
  };
}

export interface TooltipPluginContract {
  enabled: boolean;
  mode: 'index' | 'dataset' | 'point' | 'nearest' | 'x' | 'y';
  intersect: boolean;
  backgroundColor: string;
  titleColor: string;
  bodyColor: string;
  borderColor: string;
  borderWidth: number;
  callbacks: {
    title: (context: any[]) => string;
    label: (context: any) => string;
    footer?: (context: any[]) => string;
  };
}

export interface ScalesContract {
  x: AxisContract;
  y: AxisContract;
  y1?: AxisContract;
}

export interface AxisContract {
  display: boolean;
  type?: 'linear' | 'logarithmic' | 'category' | 'time';
  position?: 'left' | 'right' | 'top' | 'bottom';
  title: {
    display: boolean;
    text: string;
    color?: string;
  };
  grid: {
    display: boolean;
    color: string;
    drawOnChartArea?: boolean;
  };
  ticks?: {
    color: string;
    callback?: (value: any) => string;
  };
  beginAtZero?: boolean;
  min?: number;
  max?: number;
}

export interface AnimationContract {
  duration: number;
  easing: 'linear' | 'easeInQuad' | 'easeOutQuad' | 'easeInOutQuad';
  onComplete?: () => void;
}

export interface InteractionContract {
  mode: 'index' | 'dataset' | 'point' | 'nearest' | 'x' | 'y';
  intersect: boolean;
}

// =============================================================================
// HOOK CONTRACTS
// =============================================================================

export interface UseChartDataContract {
  /**
   * Data processing and management hook contract
   */
  drives: DriveAnalysis[];
  filters: ChartFilters;
  return: {
    processedData: ProcessedChartData;
    aggregatedData: AggregatedData;
    loading: boolean;
    error: ChartError | null;
    refetch: () => void;
    invalidateCache: () => void;
  };
}

export interface UseChartThemeContract {
  /**
   * Theme management and chart styling hook contract
   */
  chartType: ChartType;
  return: {
    theme: ThemeConfig;
    chartOptions: ChartOptionsContract;
    getSeriesColor: (index: number) => string;
    getChartConfig: (chartType: ChartType) => ChartConfig;
  };
}

export interface UseChartExportContract {
  /**
   * Chart export functionality hook contract
   */
  chartRef: React.RefObject<any>;
  chartData: any;
  return: {
    exportChart: (format: 'png' | 'csv', options?: ExportOptions) => Promise<void>;
    exportData: (format: 'csv', options?: ExportOptions) => Promise<void>;
    isExporting: boolean;
    exportError: string | null;
  };
}

// =============================================================================
// UTILITY CONTRACTS
// =============================================================================

export interface DataTransformContract {
  /**
   * Data transformation utility functions contract
   */
  transformDriveAnalysis: (drives: DriveAnalysis[], filters: ChartFilters) => ProcessedChartData;
  aggregateData: (drives: DriveAnalysis[]) => AggregatedData;
  calculateResponsiveness: (latency: number | null) => number | null;
  normalizeBlockSizes: (blockSizes: string[]) => string[];
  validateDataIntegrity: (drives: DriveAnalysis[]) => ValidationResult;
}

export interface ChartConfigContract {
  /**
   * Chart configuration generation contract
   */
  generateChartOptions: (
    chartType: ChartType,
    theme: ThemeConfig,
    customOptions?: Partial<ChartOptionsContract>
  ) => ChartOptionsContract;

  getColorPalette: (theme: ThemeConfig, seriesCount: number) => string[];

  createDataset: (
    data: number[],
    label: string,
    colorIndex: number,
    theme: ThemeConfig
  ) => ChartDataset;
}

export interface ValidationContract {
  /**
   * Data validation and error handling contract
   */
  validateProps: (props: any, componentName: string) => ValidationResult;
  validateChartData: (data: any, chartType: ChartType) => ValidationResult;
  handleError: (error: Error, context: string) => ChartError;
  logPerformanceMetrics: (operation: string, duration: number) => void;
}

// =============================================================================
// TYPE DEFINITIONS (Referenced in contracts)
// =============================================================================

export type ChartType = 'iops-comparison' | 'latency-analysis' | 'bandwidth-trends' | 'responsiveness';
export type PatternType = 'random_read' | 'random_write' | 'sequential_read' | 'sequential_write';
export type MetricType = 'iops' | 'avg_latency' | 'p95_latency' | 'p99_latency' | 'bandwidth' | 'responsiveness';
export type LatencyMetricType = 'avg_latency' | 'p95_latency' | 'p99_latency';

// Chart data interfaces (referenced from data-model.md)
export interface IOPSChartData {
  labels: string[];
  datasets: ChartDataset[];
}

export interface LatencyChartData {
  labels: string[];
  avgLatencyDatasets: ChartDataset[];
  percentileDatasets: ChartDataset[];
}

export interface BandwidthChartData {
  labels: string[];
  datasets: ChartDataset[];
}

export interface ResponsivenessChartData {
  labels: string[];
  datasets: ChartDataset[];
}

// Additional referenced types would be imported from data-model.md
// This ensures single source of truth for data structures