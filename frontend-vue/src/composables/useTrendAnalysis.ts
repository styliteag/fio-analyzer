import type { TestRun, MetricType } from '../types/testRun'
import { useChartData } from './useChartData'

export interface TrendData {
  labels: (string | number)[]
  datasets: {
    label: string
    data: number[]
    borderColor: string
    backgroundColor: string
    tension: number
  }[]
}

export function useTrendAnalysis() {
  const { getColor, getMetricLabel } = useChartData()

  // Create trend chart for block size performance
  function createBlockSizeTrend(
    testRuns: TestRun[],
    metric: MetricType,
    groupBy: 'hostname' | 'read_write_pattern' = 'hostname'
  ): TrendData {
    // Group by the dimension
    const groups = new Map<string, TestRun[]>()

    testRuns.forEach((run) => {
      const key = groupBy === 'hostname' ? (run.hostname || 'Unknown') : run.read_write_pattern
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(run)
    })

    // Extract unique block sizes (sorted)
    const blockSizes = Array.from(new Set(testRuns.map((r) => r.block_size)))
      .sort((a, b) => parseBlockSize(a) - parseBlockSize(b))

    // Create datasets
    const datasets = Array.from(groups.entries()).map(([groupName, runs], index) => {
      const data = blockSizes.map((blockSize) => {
        const matchingRuns = runs.filter((r) => r.block_size === blockSize)
        if (matchingRuns.length === 0) return 0

        // Average if multiple runs
        const sum = matchingRuns.reduce((acc, r) => acc + (r[metric] || 0), 0)
        return sum / matchingRuns.length
      })

      const color = getColor(index)

      return {
        label: groupName,
        data,
        borderColor: color,
        backgroundColor: color,
        tension: 0.3
      }
    })

    return {
      labels: blockSizes,
      datasets
    }
  }

  // Create trend chart for queue depth scaling
  function createQueueDepthTrend(
    testRuns: TestRun[],
    metric: MetricType,
    groupBy: 'hostname' | 'read_write_pattern' = 'hostname'
  ): TrendData {
    const groups = new Map<string, TestRun[]>()

    testRuns.forEach((run) => {
      const key = groupBy === 'hostname' ? (run.hostname || 'Unknown') : run.read_write_pattern
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(run)
    })

    // Extract unique queue depths (sorted)
    const queueDepths = Array.from(new Set(testRuns.map((r) => r.queue_depth)))
      .sort((a, b) => a - b)

    // Create datasets
    const datasets = Array.from(groups.entries()).map(([groupName, runs], index) => {
      const data = queueDepths.map((qd) => {
        const matchingRuns = runs.filter((r) => r.queue_depth === qd)
        if (matchingRuns.length === 0) return 0

        const sum = matchingRuns.reduce((acc, r) => acc + (r[metric] || 0), 0)
        return sum / matchingRuns.length
      })

      const color = getColor(index)

      return {
        label: groupName,
        data,
        borderColor: color,
        backgroundColor: color,
        tension: 0.3
      }
    })

    return {
      labels: queueDepths,
      datasets
    }
  }

  // Create comparison chart for patterns (bar chart data)
  function createPatternComparison(
    testRuns: TestRun[],
    metric: MetricType,
    hosts: string[]
  ): { labels: string[]; datasets: any[] } {
    // Get unique patterns
    const patterns = Array.from(new Set(testRuns.map((r) => r.read_write_pattern)))

    const datasets = hosts.map((host, index) => {
      const data = patterns.map((pattern) => {
        const matchingRuns = testRuns.filter(
          (r) => r.hostname === host && r.read_write_pattern === pattern
        )
        if (matchingRuns.length === 0) return 0

        const sum = matchingRuns.reduce((acc, r) => acc + (r[metric] || 0), 0)
        return sum / matchingRuns.length
      })

      return {
        label: host,
        data,
        backgroundColor: getColor(index)
      }
    })

    return {
      labels: patterns,
      datasets
    }
  }

  // Calculate summary statistics
  function calculateSummary(testRuns: TestRun[], metric: MetricType) {
    if (testRuns.length === 0) {
      return { avg: 0, min: 0, max: 0, count: 0 }
    }

    const values = testRuns.map((r) => r[metric] || 0).filter((v) => v > 0)
    const sum = values.reduce((acc, v) => acc + v, 0)
    const avg = sum / values.length
    const min = Math.min(...values)
    const max = Math.max(...values)

    return { avg, min, max, count: values.length }
  }

  // Find best performing configuration
  function findBestConfig(testRuns: TestRun[], metric: MetricType): TestRun | null {
    if (testRuns.length === 0) return null

    return testRuns.reduce((best, current) => {
      const bestValue = best[metric] || 0
      const currentValue = current[metric] || 0

      // For latency, lower is better
      if (metric.includes('latency')) {
        return currentValue < bestValue ? current : best
      }
      // For IOPS/bandwidth, higher is better
      return currentValue > bestValue ? current : best
    })
  }

  // Parse block size for sorting
  function parseBlockSize(size: string): number {
    const match = size.match(/^(\d+)([KM]?)$/)
    if (!match) return 0

    const num = parseInt(match[1])
    const unit = match[2]

    if (unit === 'K') return num * 1024
    if (unit === 'M') return num * 1024 * 1024
    return num
  }

  return {
    createBlockSizeTrend,
    createQueueDepthTrend,
    createPatternComparison,
    calculateSummary,
    findBestConfig
  }
}
