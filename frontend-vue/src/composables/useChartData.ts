import type { TestRun, MetricType, ChartData, ChartDataset } from '../types/testRun'

// Color palette for datasets
const COLORS = [
  '#3b82f6', // blue-500
  '#22c55e', // green-500
  '#eab308', // yellow-500
  '#ef4444', // red-500
  '#8b5cf6', // purple-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
  '#f97316', // orange-500
  '#14b8a6', // teal-500
  '#a855f7'  // violet-500
]

export function useChartData() {
  // Get color by index
  function getColor(index: number): string {
    return COLORS[index % COLORS.length]
  }

  // Format metric value for display
  function formatMetric(value: number | null, metric: MetricType): string {
    if (value === null) return 'N/A'

    switch (metric) {
      case 'iops':
        return new Intl.NumberFormat().format(Math.round(value))
      case 'avg_latency':
      case 'p95_latency':
      case 'p99_latency':
        return `${value.toFixed(3)}ms`
      case 'bandwidth':
        return `${Math.round(value)} MB/s`
      default:
        return String(value)
    }
  }

  // Get metric display name
  function getMetricLabel(metric: MetricType): string {
    const labels: Record<MetricType, string> = {
      iops: 'IOPS',
      avg_latency: 'Avg Latency (ms)',
      bandwidth: 'Bandwidth (MB/s)',
      p95_latency: 'P95 Latency (ms)',
      p99_latency: 'P99 Latency (ms)'
    }
    return labels[metric]
  }

  // Create chart data for comparing multiple hosts with a single metric
  function createHostComparisonData(
    testRuns: TestRun[],
    metric: MetricType
  ): ChartData {
    const labels = testRuns.map((run) => run.hostname || 'Unknown')
    const data = testRuns.map((run) => run[metric] || 0)

    return {
      labels,
      datasets: [
        {
          label: getMetricLabel(metric),
          data,
          backgroundColor: getColor(0),
          borderWidth: 0
        }
      ]
    }
  }

  // Create chart data for comparing multiple metrics across hosts (grouped)
  function createMultiMetricGroupedData(
    testRuns: TestRun[],
    metrics: MetricType[]
  ): ChartData {
    const labels = testRuns.map((run) => run.hostname || 'Unknown')

    const datasets: ChartDataset[] = metrics.map((metric, index) => ({
      label: getMetricLabel(metric),
      data: testRuns.map((run) => run[metric] || 0),
      backgroundColor: getColor(index),
      borderWidth: 0
    }))

    return {
      labels,
      datasets
    }
  }

  // Create chart data for comparing multiple metrics in stacked mode
  function createMultiMetricStackedData(
    testRuns: TestRun[],
    metrics: MetricType[]
  ): ChartData {
    const labels = testRuns.map((run) => run.hostname || 'Unknown')

    const datasets: ChartDataset[] = metrics.map((metric, index) => ({
      label: getMetricLabel(metric),
      data: testRuns.map((run) => run[metric] || 0),
      backgroundColor: getColor(index),
      borderWidth: 0
    }))

    return {
      labels,
      datasets
    }
  }

  // Normalize metrics to percentage for stacked comparison
  function normalizeMetrics(testRuns: TestRun[], metrics: MetricType[]): ChartData {
    const labels = testRuns.map((run) => run.hostname || 'Unknown')

    // Calculate totals for each host
    const totals = testRuns.map((run) =>
      metrics.reduce((sum, metric) => sum + (run[metric] || 0), 0)
    )

    const datasets: ChartDataset[] = metrics.map((metric, index) => ({
      label: getMetricLabel(metric),
      data: testRuns.map((run, runIndex) => {
        const value = run[metric] || 0
        const total = totals[runIndex]
        return total > 0 ? (value / total) * 100 : 0
      }),
      backgroundColor: getColor(index),
      borderWidth: 0
    }))

    return {
      labels,
      datasets
    }
  }

  // Get test configuration label
  function getConfigLabel(testRun: TestRun): string {
    return `${testRun.read_write_pattern} ${testRun.block_size} QD${testRun.queue_depth}`
  }

  return {
    getColor,
    formatMetric,
    getMetricLabel,
    createHostComparisonData,
    createMultiMetricGroupedData,
    createMultiMetricStackedData,
    normalizeMetrics,
    getConfigLabel
  }
}
