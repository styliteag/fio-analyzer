<template>
  <div class="performance-scatter-plot">
    <!-- Header -->
    <div class="mb-6">
      <h4 class="text-xl font-bold theme-text-primary mb-2">
        Performance Scatter Plot
      </h4>
      <p class="text-sm theme-text-secondary mb-4">
        Correlation analysis between performance metrics across {{ dataPoints.length }} data points.
      </p>
    </div>

    <!-- Controls -->
    <div class="controls mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
      <!-- X-Axis Metric -->
      <div class="axis-selector">
        <label class="block text-sm font-medium mb-2 theme-text-primary">X-Axis</label>
        <select
          v-model="xAxisMetric"
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          @change="updateChart"
        >
          <option value="iops">IOPS</option>
          <option value="bandwidth">Bandwidth</option>
          <option value="avg_latency">Avg Latency</option>
          <option value="block_size">Block Size</option>
          <option value="queue_depth">Queue Depth</option>
        </select>
      </div>

      <!-- Y-Axis Metric -->
      <div class="axis-selector">
        <label class="block text-sm font-medium mb-2 theme-text-primary">Y-Axis</label>
        <select
          v-model="yAxisMetric"
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          @change="updateChart"
        >
          <option value="iops">IOPS</option>
          <option value="bandwidth">Bandwidth</option>
          <option value="avg_latency">Avg Latency</option>
          <option value="block_size">Block Size</option>
          <option value="queue_depth">Queue Depth</option>
        </select>
      </div>

      <!-- Color By -->
      <div class="color-selector">
        <label class="block text-sm font-medium mb-2 theme-text-primary">Color By</label>
        <select
          v-model="colorBy"
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          @change="updateChart"
        >
          <option value="read_write_pattern">IO Pattern</option>
          <option value="protocol">Protocol</option>
          <option value="drive_type">Drive Type</option>
          <option value="hostname">Host</option>
        </select>
      </div>
    </div>

    <!-- Chart Container -->
    <div class="chart-container bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <div class="chart-wrapper" :style="{ height: height + 'px' }">
        <canvas ref="chartCanvas"></canvas>
      </div>
    </div>

    <!-- Statistics -->
    <div class="stats mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="stat-card">
        <div class="text-lg font-semibold theme-text-primary">{{ dataPoints.length }}</div>
        <div class="text-xs theme-text-secondary">Data Points</div>
      </div>
      <div class="stat-card">
        <div class="text-lg font-semibold theme-text-primary">{{ correlation.toFixed(3) }}</div>
        <div class="text-xs theme-text-secondary">Correlation</div>
      </div>
      <div class="stat-card">
        <div class="text-lg font-semibold theme-text-primary">{{ uniqueGroups }}</div>
        <div class="text-xs theme-text-secondary">Groups</div>
      </div>
      <div class="stat-card">
        <div class="text-lg font-semibold theme-text-primary">{{ trendDirection }}</div>
        <div class="text-xs theme-text-secondary">Trend</div>
      </div>
    </div>

    <!-- Regression Line Toggle -->
    <div class="regression-toggle mt-4 flex items-center">
      <input
        id="show-regression"
        v-model="showRegression"
        type="checkbox"
        class="mr-2"
        @change="updateChart"
      >
      <label for="show-regression" class="text-sm font-medium theme-text-primary">Show Regression Line</label>
    </div>

    <!-- Correlation Analysis -->
    <div class="correlation-analysis mt-4 p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
      <h5 class="text-sm font-semibold theme-text-primary mb-2">Correlation Analysis</h5>
      <div class="text-xs theme-text-secondary space-y-1">
        <p><strong>X-Axis:</strong> {{ getMetricLabel(xAxisMetric) }}</p>
        <p><strong>Y-Axis:</strong> {{ getMetricLabel(yAxisMetric) }}</p>
        <p><strong>Correlation:</strong> {{ getCorrelationDescription(correlation) }}</p>
        <p v-if="correlation !== 0"><strong>Trend:</strong> {{ trendDirection === 'positive' ? 'Higher values on X-axis tend to have higher values on Y-axis' : 'Higher values on X-axis tend to have lower values on Y-axis' }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { Chart as ChartJS, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js'
import { Scatter } from 'chart.js'
import { useTheme } from '@/contexts/ThemeContext'
import { generateColorPalette } from '@/utils/chartProcessing'
import type { PerformanceData } from '@/types/performance'
import type { FilterState } from '@/types/filters'

// Register Chart.js components
ChartJS.register(LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

interface Props {
  performanceData: PerformanceData[]
  filters: FilterState
  height?: number
}

const props = withDefaults(defineProps<Props>(), {
  height: 400
})

const { actualTheme } = useTheme()
const chartCanvas = ref<HTMLCanvasElement>()
const chartInstance = ref<any>(null)

// State
const xAxisMetric = ref<'iops' | 'bandwidth' | 'avg_latency' | 'block_size' | 'queue_depth'>('iops')
const yAxisMetric = ref<'iops' | 'bandwidth' | 'avg_latency' | 'block_size' | 'queue_depth'>('bandwidth')
const colorBy = ref<'read_write_pattern' | 'protocol' | 'drive_type' | 'hostname'>('read_write_pattern')
const showRegression = ref(false)

// Computed
const dataPoints = computed(() => {
  return props.performanceData.filter(item => {
    const xValue = getMetricValue(item, xAxisMetric.value)
    const yValue = getMetricValue(item, yAxisMetric.value)
    return xValue !== null && yValue !== null
  })
})

const correlation = computed(() => {
  if (dataPoints.value.length < 2) return 0

  const xValues = dataPoints.value.map(item => getMetricValue(item, xAxisMetric.value) as number)
  const yValues = dataPoints.value.map(item => getMetricValue(item, yAxisMetric.value) as number)

  return calculateCorrelation(xValues, yValues)
})

const uniqueGroups = computed(() => {
  const groups = new Set(dataPoints.value.map(item => getGroupValue(item, colorBy.value)))
  return groups.size
})

const trendDirection = computed(() => {
  return correlation.value > 0 ? 'positive' : correlation.value < 0 ? 'negative' : 'none'
})

// Methods
const getMetricValue = (item: PerformanceData, metric: string): number | null => {
  switch (metric) {
    case 'iops': return item.iops
    case 'bandwidth': return item.bandwidth
    case 'avg_latency': return item.avg_latency
    case 'block_size': return typeof item.block_size === 'number' ? item.block_size : parseBlockSize(item.block_size)
    case 'queue_depth': return item.queue_depth
    default: return null
  }
}

const parseBlockSize = (blockSize: string | number): number => {
  if (typeof blockSize === 'number') return blockSize
  const match = blockSize.match(/(\d+)/)
  return match ? parseInt(match[1], 10) : 0
}

const getGroupValue = (item: PerformanceData, groupBy: string): string => {
  switch (groupBy) {
    case 'read_write_pattern': return item.read_write_pattern || 'unknown'
    case 'protocol': return item.protocol || 'unknown'
    case 'drive_type': return item.drive_type || 'unknown'
    case 'hostname': return item.hostname || 'unknown'
    default: return 'unknown'
  }
}

const calculateCorrelation = (x: number[], y: number[]): number => {
  const n = x.length
  const sumX = x.reduce((a, b) => a + b, 0)
  const sumY = y.reduce((a, b) => a + b, 0)
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0)
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0)
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0)

  const numerator = n * sumXY - sumX * sumY
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))

  return denominator === 0 ? 0 : numerator / denominator
}

const getMetricLabel = (metric: string): string => {
  const labels: Record<string, string> = {
    iops: 'IOPS',
    bandwidth: 'Bandwidth (MB/s)',
    avg_latency: 'Average Latency (ms)',
    block_size: 'Block Size (KB)',
    queue_depth: 'Queue Depth'
  }
  return labels[metric] || metric
}

const getCorrelationDescription = (corr: number): string => {
  const absCorr = Math.abs(corr)
  let strength = 'no'
  if (absCorr >= 0.8) strength = 'strong'
  else if (absCorr >= 0.6) strength = 'moderate'
  else if (absCorr >= 0.3) strength = 'weak'

  const direction = corr > 0 ? 'positive' : corr < 0 ? 'negative' : 'no'
  return `${strength} ${direction} correlation (${corr.toFixed(3)})`
}

const updateChart = () => {
  if (!chartInstance.value) return

  const chartData = createChartData()
  const chartOptions = createChartOptions()

  chartInstance.value.data = chartData
  chartInstance.value.options = chartOptions
  chartInstance.value.update()
}

const createChartData = () => {
  const groupColors = generateColorPalette(uniqueGroups.value, actualTheme.value)
  const colorMap = new Map<string, string>()

  // Assign colors to groups
  const groups = [...new Set(dataPoints.value.map(item => getGroupValue(item, colorBy.value)))]
  groups.forEach((group, index) => {
    colorMap.set(group, groupColors[index % groupColors.length])
  })

  const datasets = groups.map(group => {
    const groupData = dataPoints.value.filter(item => getGroupValue(item, colorBy.value) === group)
    const data = groupData.map(item => ({
      x: getMetricValue(item, xAxisMetric.value),
      y: getMetricValue(item, yAxisMetric.value)
    }))

    return {
      label: group.replace('_', ' ').toUpperCase(),
      data,
      backgroundColor: colorMap.get(group) + '80',
      borderColor: colorMap.get(group),
      borderWidth: 1,
      pointRadius: 4,
      pointHoverRadius: 6,
    }
  })

  // Add regression line if enabled
  if (showRegression.value && correlation.value !== 0) {
    const regressionData = calculateRegressionLine()
    if (regressionData) {
      datasets.push({
        label: 'Regression Line',
        data: regressionData,
        backgroundColor: 'transparent',
        borderColor: '#EF4444',
        borderWidth: 2,
        pointRadius: 0,
        showLine: true,
        fill: false,
      })
    }
  }

  return {
    datasets
  }
}

const calculateRegressionLine = () => {
  if (dataPoints.value.length < 2) return null

  const xValues = dataPoints.value.map(item => getMetricValue(item, xAxisMetric.value) as number)
  const yValues = dataPoints.value.map(item => getMetricValue(item, yAxisMetric.value) as number)

  const n = xValues.length
  const sumX = xValues.reduce((a, b) => a + b, 0)
  const sumY = yValues.reduce((a, b) => a + b, 0)
  const sumXY = xValues.reduce((sum, xi, i) => sum + xi * yValues[i], 0)
  const sumX2 = xValues.reduce((sum, xi) => sum + xi * xi, 0)

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n

  const xMin = Math.min(...xValues)
  const xMax = Math.max(...xValues)

  return [
    { x: xMin, y: slope * xMin + intercept },
    { x: xMax, y: slope * xMax + intercept }
  ]
}

const createChartOptions = () => {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: `${getMetricLabel(xAxisMetric.value)} vs ${getMetricLabel(yAxisMetric.value)}`,
        color: actualTheme.value === 'light' ? '#1F2937' : '#F9FAFB',
        font: {
          size: 16,
          weight: 'bold'
        }
      },
      legend: {
        display: uniqueGroups.value > 1,
        position: 'top' as const,
        labels: {
          color: actualTheme.value === 'light' ? '#374151' : '#D1D5DB',
          font: {
            size: 12
          }
        }
      },
      tooltip: {
        enabled: true,
        backgroundColor: actualTheme.value === 'light' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(31, 41, 55, 0.9)',
        titleColor: actualTheme.value === 'light' ? '#1F2937' : '#F9FAFB',
        bodyColor: actualTheme.value === 'light' ? '#374151' : '#D1D5DB',
        borderColor: actualTheme.value === 'light' ? '#D1D5DB' : '#4B5563',
        borderWidth: 1,
        callbacks: {
          label: (context: any) => {
            return `${context.dataset.label}: (${context.parsed.x}, ${context.parsed.y})`
          }
        }
      }
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: getMetricLabel(xAxisMetric.value),
          color: actualTheme.value === 'light' ? '#374151' : '#D1D5DB',
          font: {
            size: 14,
            weight: 'bold'
          }
        },
        ticks: {
          color: actualTheme.value === 'light' ? '#6B7280' : '#9CA3AF',
          font: {
            size: 12
          }
        },
        grid: {
          color: actualTheme.value === 'light' ? '#E5E7EB' : '#374151'
        }
      },
      y: {
        display: true,
        title: {
          display: true,
          text: getMetricLabel(yAxisMetric.value),
          color: actualTheme.value === 'light' ? '#374151' : '#D1D5DB',
          font: {
            size: 14,
            weight: 'bold'
          }
        },
        ticks: {
          color: actualTheme.value === 'light' ? '#6B7280' : '#9CA3AF',
          font: {
            size: 12
          }
        },
        grid: {
          color: actualTheme.value === 'light' ? '#E5E7EB' : '#374151'
        }
      }
    }
  }
}

// Lifecycle
onMounted(() => {
  if (chartCanvas.value) {
    const ctx = chartCanvas.value.getContext('2d')
    if (ctx) {
      const chartData = createChartData()
      const chartOptions = createChartOptions()

      chartInstance.value = new ChartJS(ctx, {
        type: 'scatter',
        data: chartData,
        options: chartOptions
      })
    }
  }
})

onUnmounted(() => {
  if (chartInstance.value) {
    chartInstance.value.destroy()
  }
})

// Watchers
watch(() => props.performanceData, updateChart, { deep: true })
watch(actualTheme, updateChart)
</script>

<style scoped>
.performance-scatter-plot {
  @apply w-full;
}

.theme-text-primary {
  @apply text-gray-900 dark:text-white;
}

.theme-text-secondary {
  @apply text-gray-600 dark:text-gray-300;
}

.stat-card {
  @apply bg-gray-50 dark:bg-gray-800 p-4 rounded-lg text-center;
}

.chart-wrapper {
  @apply w-full;
}
</style>
