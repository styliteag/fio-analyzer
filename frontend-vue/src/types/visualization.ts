/**
 * Visualization Configuration Types
 * Based on data-model.md specifications
 */

export type ChartType = 'graphs' | 'heatmap' | 'radar' | 'scatter' | 'parallel'
export type ThemeType = 'light' | 'dark' | 'system'

export interface VisualizationConfig {
  chartType: ChartType
  theme: ThemeType
  height: number
  responsive: boolean
  animations: boolean
}

// Default visualization configuration
export const defaultVisualizationConfig: VisualizationConfig = {
  chartType: 'graphs',
  theme: 'system',
  height: 400,
  responsive: true,
  animations: true
}

// Chart-specific configuration interfaces
export interface ChartDisplayOptions {
  showLegend: boolean
  showTitle: boolean
  showGrid: boolean
  showTooltips: boolean
  colorScheme: 'default' | 'accessible' | 'colorblind'
}

// Data model VisualizationConfig interface for API contracts
export interface DataModelVisualizationConfig {
  mode: 'absolute' | 'normalized'
  colorScheme: 'default' | 'accessible' | 'high-contrast'
  showLegend: boolean
  showTooltips: boolean
  performanceZones: {
    high_performance: {
      color: string
      threshold: { iops: number; latency: number }
    }
    balanced: {
      color: string
      threshold: { iops: number; latency: number }
    }
    high_latency: {
      color: string
      threshold: { iops: number; latency: number }
    }
    low_performance: {
      color: string
      threshold: { iops: number; latency: number }
    }
  }
}

export interface DataModelHeatmapConfig extends DataModelVisualizationConfig {
  scaling: 'relative' | 'absolute'
  metrics: ('iops' | 'bandwidth' | 'responsiveness')[]
  cellSize: number
  colorRange: [string, string] // [min_color, max_color]
}

export interface DataModelChartConfig extends DataModelVisualizationConfig {
  type: 'line' | 'bar' | 'scatter' | 'radar' | 'parallel'
  xAxis: string
  yAxis: string
  groupBy?: string
  aggregation?: 'avg' | 'max' | 'min' | 'sum'
}

export interface PerformanceGraphsConfig extends VisualizationConfig {
  activeChart: 'iops-comparison' | 'latency-analysis' | 'bandwidth-trends' | 'responsiveness'
  showSeriesToggle: boolean
  normalizeMetrics: boolean
}

export interface HeatmapConfig extends VisualizationConfig {
  showValues: boolean
  colorScale: 'linear' | 'logarithmic'
  metricType: 'iops' | 'bandwidth' | 'responsiveness' | 'combined'
}

export interface RadarConfig extends VisualizationConfig {
  showAxes: boolean
  fillAreas: boolean
  maxMetrics: number
}

export interface ScatterConfig extends VisualizationConfig {
  xAxisMetric: 'iops' | 'bandwidth' | 'latency'
  yAxisMetric: 'iops' | 'bandwidth' | 'latency'
  showRegression: boolean
}

export interface ParallelCoordinatesConfig extends VisualizationConfig {
  dimensions: string[]
  brushMode: boolean
  reorderable: boolean
}

// Utility functions
export function getChartTypeLabel(type: ChartType): string {
  const labels: Record<ChartType, string> = {
    graphs: 'Performance Graphs',
    heatmap: 'Performance Heatmap',
    radar: 'Drive Radar Chart',
    scatter: 'Performance Scatter Plot',
    parallel: 'Parallel Coordinates'
  }
  return labels[type]
}

export function getThemeLabel(theme: ThemeType): string {
  const labels: Record<ThemeType, string> = {
    light: 'Light',
    dark: 'Dark',
    system: 'System'
  }
  return labels[theme]
}

export function resolveActualTheme(theme: ThemeType): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return theme
}

// Configuration validation
export function validateVisualizationConfig(config: VisualizationConfig): boolean {
  return (
    ['graphs', 'heatmap', 'radar', 'scatter', 'parallel'].includes(config.chartType) &&
    ['light', 'dark', 'system'].includes(config.theme) &&
    typeof config.height === 'number' && config.height > 0 &&
    typeof config.responsive === 'boolean' &&
    typeof config.animations === 'boolean'
  )
}

// Export configurations for different chart types
export function createDefaultConfigForType(type: ChartType): VisualizationConfig {
  const base = { ...defaultVisualizationConfig, chartType: type }
  return base
}
