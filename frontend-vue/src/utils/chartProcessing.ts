import type { TestRun, ChartDataPoint, HeatmapCell, ScatterPoint } from '@/types'

// Performance optimizations for large datasets
const PERFORMANCE_THRESHOLDS = {
  LARGE_DATASET: 1000,
  AGGREGATION_SAMPLE: 500,
  CELL_LIMIT: 2000
}

// Heatmap data processing with performance optimizations
export function processHeatmapData(
  testRuns: TestRun[],
  metric: 'iops' | 'bandwidth' | 'responsiveness' = 'iops',
  options: { maxCells?: number; sampleSize?: number } = {}
): HeatmapCell[] {
  if (!testRuns || testRuns.length === 0) return []

  // Performance optimization: Sample large datasets
  const sampleSize = options.sampleSize || PERFORMANCE_THRESHOLDS.AGGREGATION_SAMPLE
  const processedRuns = testRuns.length > PERFORMANCE_THRESHOLDS.LARGE_DATASET
    ? stratifiedSample(testRuns, sampleSize)
    : testRuns

  // Use processedRuns for grouping instead of original testRuns
  const runsToProcess = processedRuns

  // Group data by host and configuration (optimized)
  const groupedData = new Map<string, TestRun[]>()

  runsToProcess.forEach(run => {
    // Create a unique key for each host-pattern-blocksize combination
    const key = `${run.hostname}|${run.read_write_pattern}|${run.block_size}`
    if (!groupedData.has(key)) {
      groupedData.set(key, [])
    }
    groupedData.get(key)!.push(run)
  })

  // Calculate relative color scale
  const colorScale = calculateRelativeColorScale(runsToProcess, metric)

  // Convert to heatmap cells
  const cells: HeatmapCell[] = []

  groupedData.forEach((runs, key) => {
    const [hostname, pattern, blockSize] = key.split('|')

    // Aggregate metrics for this group (take average)
    const avgValue = runs.reduce((sum, run) => {
      let value: number
      switch (metric) {
        case 'iops':
          value = run.iops
          break
        case 'bandwidth':
          value = run.bandwidth
          break
        case 'responsiveness':
          value = run.avg_latency > 0 ? 1000 / run.avg_latency : 0 // ops/ms
          break
        default:
          value = run.iops
      }
      return sum + value
    }, 0) / runs.length

    // Calculate color based on relative scale
    const color = getColorForValue(avgValue, colorScale)

    // Create tooltip with detailed information
    const tooltip = createHeatmapTooltip(runs[0], avgValue, metric, runs.length)

    cells.push({
      x: hostname,
      y: `${blockSize}-${pattern}`,
      value: avgValue,
      color,
      tooltip,
      metadata: runs[0], // Use first run as representative
    })
  })

  return cells
}

// Scatter plot data processing
export function processScatterData(
  testRuns: TestRun[],
  xMetric: 'avg_latency' | 'bandwidth' = 'avg_latency',
  yMetric: 'iops' | 'bandwidth' = 'iops'
): ScatterPoint[] {
  if (!testRuns || testRuns.length === 0) return []

  return testRuns.map(run => {
    let x: number
    let y: number

    // Get X value
    switch (xMetric) {
      case 'avg_latency':
        x = run.avg_latency
        break
      case 'bandwidth':
        x = run.bandwidth
        break
      default:
        x = run.avg_latency
    }

    // Get Y value
    switch (yMetric) {
      case 'iops':
        y = run.iops
        break
      case 'bandwidth':
        y = run.bandwidth
        break
      default:
        y = run.iops
    }

    // Determine performance zone
    const zone = getPerformanceZone(run.iops, run.avg_latency)

    return {
      x,
      y,
      zone,
      color: getZoneColor(zone),
      label: `${run.hostname} - ${run.block_size}`,
      metadata: run,
    }
  })
}

// Line chart data processing
export function processLineChartData(
  testRuns: TestRun[],
  xAxis: string = 'block_size',
  yAxis: string = 'iops',
  groupBy?: string
): ChartDataPoint[] {
  if (!testRuns || testRuns.length === 0) return []

  if (groupBy) {
    // Grouped data for multiple lines
    const grouped = new Map<string, ChartDataPoint[]>()

    testRuns.forEach(run => {
      const groupKey = (run as unknown as Record<string, unknown>)[groupBy] as string || 'unknown'
      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, [])
      }

      const point = createChartPoint(run, xAxis, yAxis)
      grouped.get(groupKey)!.push(point)
    })

    // Flatten grouped data with group labels
    const result: ChartDataPoint[] = []
    grouped.forEach((points, groupKey) => {
      points.forEach(point => {
        result.push({
          ...point,
          label: `${groupKey}: ${point.label}`,
        })
      })
    })

    return result
  } else {
    // Single series
    return testRuns.map(run => createChartPoint(run, xAxis, yAxis))
  }
}

// Calculate relative color scale for heatmap
export function calculateRelativeColorScale(
  testRuns: TestRun[],
  metric: 'iops' | 'bandwidth' | 'responsiveness' = 'iops'
): { min: number; max: number; colors: string[] } {
  if (!testRuns || testRuns.length === 0) {
    return { min: 0, max: 0, colors: [] }
  }

  // Extract metric values
  const values = testRuns.map(run => {
    switch (metric) {
      case 'iops':
        return run.iops
      case 'bandwidth':
        return run.bandwidth
      case 'responsiveness':
        return run.avg_latency > 0 ? 1000 / run.avg_latency : 0
      default:
        return run.iops
    }
  }).filter(v => v > 0)

  if (values.length === 0) {
    return { min: 0, max: 0, colors: [] }
  }

  const min = Math.min(...values)
  const max = Math.max(...values)

  // Create color gradient (green to red)
  const colors = [
    '#10b981', // green-500
    '#34d399', // green-400
    '#6ee7b7', // green-300
    '#a7f3d0', // green-200
    '#d1fae5', // green-100
    '#fef3c7', // yellow-100
    '#fde68a', // yellow-200
    '#fcd34d', // yellow-300
    '#fbbf24', // yellow-400
    '#f59e0b', // amber-500
    '#fb923c', // orange-400
    '#fdba74', // orange-300
    '#fed7aa', // orange-200
    '#ffedd5', // orange-100
    '#fecaca', // red-200
    '#fca5a5', // red-300
    '#f87171', // red-400
    '#ef4444', // red-500
  ]

  return { min, max, colors }
}

// Group data by host
export function groupByHost(testRuns: TestRun[]): Record<string, TestRun[]> {
  const grouped: Record<string, TestRun[]> = {}

  testRuns.forEach(run => {
    if (!grouped[run.hostname]) {
      grouped[run.hostname] = []
    }
    grouped[run.hostname].push(run)
  })

  return grouped
}

// Aggregate metrics
export function aggregateMetrics(
  testRuns: TestRun[],
  metrics: ('iops' | 'bandwidth' | 'avg_latency' | 'p95_latency' | 'p99_latency')[] = ['iops', 'bandwidth', 'avg_latency']
): Record<string, { avg: number; min: number; max: number; count: number }> {
  if (!testRuns || testRuns.length === 0) return {}

  const result: Record<string, { avg: number; min: number; max: number; count: number }> = {}

  metrics.forEach(metric => {
    const values = testRuns.map(run => (run as unknown as Record<string, unknown>)[metric] as number).filter(v => v !== undefined && v !== null && v > 0)

    if (values.length === 0) {
      result[metric] = { avg: 0, min: 0, max: 0, count: 0 }
    } else {
      result[metric] = {
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        count: values.length,
      }
    }
  })

  return result
}

// Filter data by selection
export function filterDataBySelection(
  testRuns: TestRun[],
  filters: Record<string, unknown>
): TestRun[] {
  if (!filters || Object.keys(filters).length === 0) return testRuns

  return testRuns.filter(run => {
    // Check each filter category
    for (const [category, values] of Object.entries(filters)) {
      if (!values || (Array.isArray(values) && values.length === 0)) continue

      const valueArray = Array.isArray(values) ? values : [values]
      const runValue = (run as unknown as Record<string, unknown>)[category]

      if (runValue === undefined || runValue === null) return false

      // Handle different category types
      switch (category) {
        case 'hostnames':
          if (!valueArray.includes(run.hostname)) return false
          break
        case 'drive_types':
          if (!valueArray.includes(run.drive_type)) return false
          break
        case 'drive_models':
          if (!valueArray.includes(run.drive_model)) return false
          break
        case 'protocols':
          if (!valueArray.includes(run.protocol)) return false
          break
        case 'block_sizes':
          if (!valueArray.includes(run.block_size)) return false
          break
        case 'patterns':
          if (!valueArray.includes(run.read_write_pattern)) return false
          break
        case 'queue_depths':
          if (!valueArray.includes(run.queue_depth)) return false
          break
        case 'num_jobs':
          if (!valueArray.includes(run.num_jobs)) return false
          break
        case 'syncs':
          if (!valueArray.includes(run.sync)) return false
          break
        case 'directs':
          if (!valueArray.includes(run.direct)) return false
          break
        case 'test_sizes':
          if (!valueArray.includes(run.test_size)) return false
          break
        case 'durations':
          if (!valueArray.includes(run.duration)) return false
          break
      }
    }

    return true
  })
}

// Helper functions
function createChartPoint(run: TestRun, xAxis: string, yAxis: string): ChartDataPoint {
  let x: number | string
  let y: number

  // Get X value
  switch (xAxis) {
    case 'block_size':
      x = run.block_size
      break
    case 'queue_depth':
      x = run.queue_depth
      break
    case 'num_jobs':
      x = run.num_jobs
      break
    case 'duration':
      x = run.duration
      break
    default:
      x = run.id
  }

  // Get Y value
  switch (yAxis) {
    case 'iops':
      y = run.iops
      break
    case 'bandwidth':
      y = run.bandwidth
      break
    case 'avg_latency':
      y = run.avg_latency
      break
    case 'p95_latency':
      y = run.p95_latency || 0
      break
    case 'p99_latency':
      y = run.p99_latency || 0
      break
    default:
      y = run.iops
  }

  return {
    x,
    y,
    label: `${run.hostname} - ${run.block_size} - ${run.read_write_pattern}`,
    metadata: run,
  }
}

function getColorForValue(value: number, scale: { min: number; max: number; colors: string[] }): string {
  if (scale.colors.length === 0 || scale.min === scale.max) {
    return scale.colors[0] || '#64748b' // gray-500 fallback
  }

  const ratio = (value - scale.min) / (scale.max - scale.min)
  const colorIndex = Math.floor(ratio * (scale.colors.length - 1))

  return scale.colors[Math.max(0, Math.min(scale.colors.length - 1, colorIndex))]
}

function getPerformanceZone(iops: number, latency: number): 'high_performance' | 'balanced' | 'high_latency' | 'low_performance' {
  // Simple performance zone classification
  if (latency < 1 && iops > 50000) return 'high_performance'
  if (latency < 5 && iops > 10000) return 'balanced'
  if (latency > 10) return 'high_latency'
  return 'low_performance'
}

function getZoneColor(zone: string): string {
  switch (zone) {
    case 'high_performance':
      return '#10b981' // green
    case 'balanced':
      return '#f59e0b' // amber
    case 'high_latency':
      return '#ef4444' // red
    case 'low_performance':
      return '#6b7280' // gray
    default:
      return '#64748b'
  }
}

function createHeatmapTooltip(run: TestRun, avgValue: number, metric: string, count: number): string {
  const unit = getMetricUnit(metric)
  const countText = count > 1 ? ` (avg of ${count} runs)` : ''

  return `Host: ${run.hostname}
Drive: ${run.drive_model}
Pattern: ${run.read_write_pattern}
Block Size: ${run.block_size}
Queue Depth: ${run.queue_depth}
${metric.toUpperCase()}: ${avgValue.toFixed(2)} ${unit}${countText}
Latency: ${run.avg_latency.toFixed(3)} ms
Bandwidth: ${run.bandwidth.toFixed(2)} MB/s`
}

function getMetricUnit(metric: string): string {
  switch (metric) {
    case 'iops':
      return 'IOPS'
    case 'bandwidth':
      return 'MB/s'
    case 'responsiveness':
      return 'ops/ms'
    default:
      return ''
  }
}

// Performance optimization utilities
export function stratifiedSample<T extends TestRun>(data: T[], sampleSize: number): T[] {
  if (data.length <= sampleSize) return data

  // Group by hostname to maintain distribution
  const hostGroups = new Map<string, T[]>()
  data.forEach(item => {
    const host = item.hostname
    if (!hostGroups.has(host)) {
      hostGroups.set(host, [])
    }
    hostGroups.get(host)!.push(item)
  })

  // Sample proportionally from each host
  const hostsCount = hostGroups.size
  const samplesPerHost = Math.floor(sampleSize / hostsCount)
  const remainder = sampleSize % hostsCount

  const sampledData: T[] = []
  let hostsProcessed = 0

  hostGroups.forEach((hostData) => {
    const extraSample = hostsProcessed < remainder ? 1 : 0
    const hostSampleSize = Math.min(samplesPerHost + extraSample, hostData.length)

    // Random sampling within host
    for (let i = 0; i < hostSampleSize; i++) {
      const randomIndex = Math.floor(Math.random() * hostData.length)
      sampledData.push(hostData[randomIndex])
      hostData.splice(randomIndex, 1) // Remove to avoid duplicates
    }
    hostsProcessed++
  })

  return sampledData
}

// Debounced chart update for performance
export function createDebouncedChartProcessor<T extends unknown[], R>(
  processingFn: (...args: T) => R,
  delay: number = 150
): (...args: T) => Promise<R> {
  let timeoutId: NodeJS.Timeout | null = null

  return (...args: T) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    return new Promise((resolve) => {
      timeoutId = setTimeout(() => {
        resolve(processingFn(...args))
      }, delay)
    })
  }
}

// Virtualization helper for large datasets
export function virtualizeChartData<T>(
  data: T[],
  viewportStart: number,
  viewportSize: number,
  bufferSize: number = 100
): { items: T[]; startIndex: number; endIndex: number } {
  const start = Math.max(0, viewportStart - bufferSize)
  const end = Math.min(data.length, viewportStart + viewportSize + bufferSize)

  return {
    items: data.slice(start, end),
    startIndex: start,
    endIndex: end
  }
}

// Memory-efficient color calculation with caching
const colorCache = new Map<string, string>()
export function getCachedColor(value: number, scale: { min: number; max: number; colors: string[] }): string {
  const cacheKey = `${value}-${scale.min}-${scale.max}`

  if (colorCache.has(cacheKey)) {
    return colorCache.get(cacheKey)!
  }

  const color = getColorForValue(value, scale)

  // Limit cache size to prevent memory leaks
  if (colorCache.size > 1000) {
    const firstKey = colorCache.keys().next().value
    if (firstKey !== undefined) {
      colorCache.delete(firstKey)
    }
  }

  colorCache.set(cacheKey, color)
  return color
}
