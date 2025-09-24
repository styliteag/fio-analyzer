// Component prop interfaces for Vue components
export interface MetricCardProps {
  title: string
  value: string | number
  unit?: string
  icon?: string
  trend?: 'up' | 'down' | 'stable'
  color?: 'blue' | 'green' | 'yellow' | 'red'
}

export interface FilterSectionProps {
  title: string
  options: string[] | number[]
  selected: (string | number)[]
  multiSelect: boolean
  onSelectionChange: (selected: (string | number)[]) => void
}

export interface ChartContainerProps {
  title: string
  type: 'line' | 'bar' | 'scatter' | 'radar' | 'parallel'
  data: ChartDataPoint[]
  config: DataModelChartConfig
  loading?: boolean
  error?: string
}

// Chart data models
export interface ChartDataPoint {
  x: number | string
  y: number
  label?: string
  metadata?: Partial<import('./testRun').TestRun>
}

export interface HeatmapCell {
  x: string // host or configuration
  y: string // pattern or block size
  value: number
  color: string
  tooltip: string
  metadata: Partial<import('./testRun').TestRun>
}

export interface ScatterPoint extends ChartDataPoint {
  zone: 'high_performance' | 'balanced' | 'high_latency' | 'low_performance'
  size?: number
  color?: string
}

// Import visualization config types
import type { DataModelChartConfig } from './visualization'