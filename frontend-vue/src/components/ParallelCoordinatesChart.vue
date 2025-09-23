<template>
  <div class="parallel-coordinates-chart">
    <!-- Header -->
    <div class="mb-6">
      <h4 class="text-xl font-bold theme-text-primary mb-2">
        Parallel Coordinates
      </h4>
      <p class="text-sm theme-text-secondary mb-4">
        Multi-dimensional analysis of performance metrics across {{ filteredData.length }} configurations.
      </p>
    </div>

    <!-- Controls -->
    <div class="controls mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
      <!-- Dimension Selection -->
      <div class="dimension-selector">
        <label class="block text-sm font-medium mb-2 theme-text-primary">Dimensions ({{ selectedDimensions.length }}/6)</label>
        <div class="max-h-32 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-md p-2">
          <label
            v-for="dimension in availableDimensions"
            :key="dimension.key"
            class="flex items-center text-sm"
          >
            <input
              v-model="selectedDimensions"
              :value="dimension.key"
              type="checkbox"
              class="mr-2"
              :disabled="selectedDimensions.length >= 6 && !selectedDimensions.includes(dimension.key)"
            >
            <span class="theme-text-primary">{{ dimension.label }}</span>
          </label>
        </div>
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

      <!-- Brush Mode -->
      <div class="brush-toggle flex items-center">
        <input
          id="brush-mode"
          v-model="brushMode"
          type="checkbox"
          class="mr-2"
          @change="updateChart"
        >
        <label for="brush-mode" class="text-sm font-medium theme-text-primary">Brush Mode</label>
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
        <div class="text-lg font-semibold theme-text-primary">{{ filteredData.length }}</div>
        <div class="text-xs theme-text-secondary">Visible Lines</div>
      </div>
      <div class="stat-card">
        <div class="text-lg font-semibold theme-text-primary">{{ selectedDimensions.length }}</div>
        <div class="text-xs theme-text-secondary">Dimensions</div>
      </div>
      <div class="stat-card">
        <div class="text-lg font-semibold theme-text-primary">{{ uniqueGroups }}</div>
        <div class="text-xs theme-text-secondary">Groups</div>
      </div>
      <div class="stat-card">
        <div class="text-lg font-semibold theme-text-primary">{{ totalDataPoints }}</div>
        <div class="text-xs theme-text-secondary">Total Points</div>
      </div>
    </div>

    <!-- Instructions -->
    <div class="instructions mt-4 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
      <h5 class="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">How to Read</h5>
      <ul class="text-xs text-blue-700 dark:text-blue-300 space-y-1">
        <li>• Each line represents one configuration</li>
        <li>• Parallel axes show different performance metrics</li>
        <li>• Line patterns reveal correlations between metrics</li>
        <li>• Color coding groups similar configurations</li>
        <li>• Use brush mode to filter and explore subsets</li>
      </ul>
    </div>

    <!-- Dimension Ranges -->
    <div class="dimension-ranges mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <div
        v-for="dimension in selectedDimensions"
        :key="dimension"
        class="dimension-info p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
      >
        <div class="text-xs font-semibold theme-text-primary mb-1">{{ getDimensionLabel(dimension) }}</div>
        <div class="text-xs theme-text-secondary">
          <div>Min: {{ getDimensionMin(dimension) }}</div>
          <div>Max: {{ getDimensionMax(dimension) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { Chart as ChartJS, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js'
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
const chartInstance = ref<ChartJS<'line'> | null>(null)

// State
const selectedDimensions = ref<string[]>(['iops', 'avg_latency', 'bandwidth', 'block_size', 'queue_depth'])
const colorBy = ref<'read_write_pattern' | 'protocol' | 'drive_type' | 'hostname'>('read_write_pattern')
const brushMode = ref(false)

// Computed
const availableDimensions = computed(() => [
  { key: 'iops', label: 'IOPS' },
  { key: 'avg_latency', label: 'Avg Latency' },
  { key: 'bandwidth', label: 'Bandwidth' },
  { key: 'p95_latency', label: '95th % Latency' },
  { key: 'block_size', label: 'Block Size' },
  { key: 'queue_depth', label: 'Queue Depth' },
  { key: 'num_jobs', label: 'Num Jobs' }
])

const filteredData = computed(() => {
  return props.performanceData.filter(item => {
    // Check if all selected dimensions have valid values
    return selectedDimensions.value.every(dimension => {
      const value = getDimensionValue(item, dimension)
      return value !== null && value !== undefined
    })
  })
})

const uniqueGroups = computed(() => {
  const groups = new Set(filteredData.value.map(item => getGroupValue(item, colorBy.value)))
  return groups.size
})

const totalDataPoints = computed(() => {
  return props.performanceData.length
})

// Methods
const getDimensionValue = (item: PerformanceData, dimension: string): number | null => {
  switch (dimension) {
    case 'iops': return item.iops
    case 'avg_latency': return item.avg_latency
    case 'bandwidth': return item.bandwidth
    case 'p95_latency': return item.p95_latency
    case 'block_size': return typeof item.block_size === 'number' ? item.block_size : parseBlockSize(item.block_size)
    case 'queue_depth': return item.queue_depth
    case 'num_jobs': return item.num_jobs
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

const getDimensionLabel = (dimension: string): string => {
  const labels: Record<string, string> = {
    iops: 'IOPS',
    avg_latency: 'Avg Lat',
    bandwidth: 'BW',
    p95_latency: '95% Lat',
    block_size: 'Block',
    queue_depth: 'QD',
    num_jobs: 'Jobs'
  }
  return labels[dimension] || dimension
}

const getDimensionMin = (dimension: string): string => {
  const values = filteredData.value.map(item => getDimensionValue(item, dimension)).filter(v => v !== null) as number[]
  if (values.length === 0) return 'N/A'

  const min = Math.min(...values)
  if (dimension.includes('latency')) {
    return `${min.toFixed(2)}ms`
  } else if (dimension === 'iops') {
    return min.toLocaleString()
  } else if (dimension === 'bandwidth') {
    return `${min.toFixed(1)}MB/s`
  }
  return min.toString()
}

const getDimensionMax = (dimension: string): string => {
  const values = filteredData.value.map(item => getDimensionValue(item, dimension)).filter(v => v !== null) as number[]
  if (values.length === 0) return 'N/A'

  const max = Math.max(...values)
  if (dimension.includes('latency')) {
    return `${max.toFixed(2)}ms`
  } else if (dimension === 'iops') {
    return max.toLocaleString()
  } else if (dimension === 'bandwidth') {
    return `${max.toFixed(1)}MB/s`
  }
  return max.toString()
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
  const groups = [...new Set(filteredData.value.map(item => getGroupValue(item, colorBy.value)))]
  groups.forEach((group, index) => {
    colorMap.set(group, groupColors[index % groupColors.length])
  })

  const datasets = groups.map(group => {
    const groupData = filteredData.value.filter(item => getGroupValue(item, colorBy.value) === group)

    // Create parallel coordinates data
    const data = groupData.map(item => {
      const point: Record<string, number> = {}
      selectedDimensions.value.forEach((dimension, index) => {
        point[`x${index}`] = getDimensionValue(item, dimension) || 0
      })
      return point
    })

    return {
      label: group.replace('_', ' ').toUpperCase(),
      data,
      borderColor: colorMap.get(group),
      backgroundColor: colorMap.get(group) + '40',
      borderWidth: 1,
      pointRadius: 2,
      pointHoverRadius: 4,
      tension: 0,
    }
  })

  return {
    datasets
  }
}

const createChartOptions = () => {
  // Create custom scales for parallel coordinates
  const scales: Record<string, unknown> = {}

  selectedDimensions.value.forEach((dimension, index) => {
    scales[`x${index}`] = {
      type: 'linear' as const,
      display: true,
      position: 'bottom' as const,
      title: {
        display: true,
        text: getDimensionLabel(dimension),
        color: actualTheme.value === 'light' ? '#374151' : '#D1D5DB',
        font: {
          size: 10,
          weight: 'bold'
        }
      },
      ticks: {
        color: actualTheme.value === 'light' ? '#6B7280' : '#9CA3AF',
        font: {
          size: 9
        },
        callback: (value: number | string) => {
          if (dimension.includes('latency')) {
            return `${Number(value).toFixed(1)}ms`
          } else if (dimension === 'iops') {
            return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toString()
          } else if (dimension === 'bandwidth') {
            return `${Number(value).toFixed(1)}`
          }
          return value.toString()
        }
      },
      grid: {
        color: actualTheme.value === 'light' ? '#E5E7EB' : '#374151'
      }
    }
  })

  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: 'Parallel Coordinates Analysis',
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
          title: (context: unknown[]) => {
            return `Configuration ${(context[0] as { dataIndex: number }).dataIndex + 1}`
          },
          label: (context: { dataset: { label: string }; parsed: { y: number } }) => {
            const dimensionIndex = parseInt(context.dataset.label.split('x')[1])
            const dimension = selectedDimensions.value[dimensionIndex]
            const value = context.parsed.y
            return `${getDimensionLabel(dimension)}: ${formatValue(value, dimension)}`
          }
        }
      }
    },
    scales,
    interaction: {
      mode: brushMode.value ? 'x' : 'nearest' as const,
      intersect: false
    }
  }
}

const formatValue = (value: number, dimension: string): string => {
  if (dimension.includes('latency')) {
    return `${value.toFixed(2)}ms`
  } else if (dimension === 'iops') {
    return value.toLocaleString()
  } else if (dimension === 'bandwidth') {
    return `${value.toFixed(1)} MB/s`
  }
  return value.toString()
}

// Lifecycle
onMounted(() => {
  if (chartCanvas.value && filteredData.value.length > 0) {
    const ctx = chartCanvas.value.getContext('2d')
    if (ctx) {
      const chartData = createChartData()
      const chartOptions = createChartOptions()

      chartInstance.value = new ChartJS(ctx, {
        type: 'line',
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
watch(selectedDimensions, updateChart)
watch(actualTheme, updateChart)
</script>

<style scoped>
.parallel-coordinates-chart {
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

.dimension-info {
  @apply text-center;
}

.chart-wrapper {
  @apply w-full;
}
</style>
