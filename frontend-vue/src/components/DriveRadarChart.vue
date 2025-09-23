<template>
  <div class="drive-radar-chart">
    <!-- Header -->
    <div class="mb-6">
      <h4 class="text-xl font-bold theme-text-primary mb-2">
        Drive Performance Radar
      </h4>
      <p class="text-sm theme-text-secondary mb-4">
        Multi-dimensional comparison of drive performance across key metrics.
      </p>
    </div>

    <!-- Chart Container -->
    <div class="chart-container bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <div class="chart-wrapper" :style="{ height: height + 'px' }">
        <canvas ref="chartCanvas"></canvas>
      </div>
    </div>

    <!-- Drive Selection -->
    <div class="drive-selection mt-6">
      <label class="block text-sm font-medium mb-2 theme-text-primary">Compare Drives</label>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="drive in availableDrives"
          :key="drive.hostname + '-' + drive.driveModel"
          :class="[
            'px-3 py-1 rounded-full text-sm transition-colors',
            selectedDrives.some(d => d.hostname === drive.hostname && d.driveModel === drive.driveModel)
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          ]"
          @click="toggleDrive(drive)"
        >
          {{ drive.hostname }} - {{ drive.driveModel }}
        </button>
      </div>
    </div>

    <!-- Metric Selection -->
    <div class="metric-selection mt-4">
      <label class="block text-sm font-medium mb-2 theme-text-primary">Metrics to Display</label>
      <div class="flex flex-wrap gap-2">
        <label
          v-for="metric in availableMetrics"
          :key="metric.key"
          class="flex items-center"
        >
          <input
            v-model="selectedMetrics"
            :value="metric.key"
            type="checkbox"
            class="mr-2"
          >
          <span class="text-sm theme-text-primary">{{ metric.label }}</span>
        </label>
      </div>
    </div>

    <!-- Statistics -->
    <div class="stats mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="stat-card">
        <div class="text-lg font-semibold theme-text-primary">{{ selectedDrives.length }}</div>
        <div class="text-xs theme-text-secondary">Selected Drives</div>
      </div>
      <div class="stat-card">
        <div class="text-lg font-semibold theme-text-primary">{{ selectedMetrics.length }}</div>
        <div class="text-xs theme-text-secondary">Active Metrics</div>
      </div>
      <div class="stat-card">
        <div class="text-lg font-semibold theme-text-primary">{{ maxValue.toFixed(1) }}</div>
        <div class="text-xs theme-text-secondary">Scale Max</div>
      </div>
      <div class="stat-card">
        <div class="text-lg font-semibold theme-text-primary">{{ totalConfigurations }}</div>
        <div class="text-xs theme-text-secondary">Total Configs</div>
      </div>
    </div>

    <!-- Instructions -->
    <div class="instructions mt-4 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
      <h5 class="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">How to Read</h5>
      <ul class="text-xs text-blue-700 dark:text-blue-300 space-y-1">
        <li>• Each drive is represented by a colored shape</li>
        <li>• Distance from center indicates performance level</li>
        <li>• Regular polygons suggest balanced performance</li>
        <li>• Irregular shapes highlight performance strengths/weaknesses</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Title, Tooltip, Legend } from 'chart.js'
import { useTheme } from '@/contexts/ThemeContext'
import { generateColorPalette } from '@/utils/chartProcessing'
import type { DriveAnalysis } from '@/types/performance'

// Register Chart.js components
ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Title, Tooltip, Legend)

interface Props {
  drives: DriveAnalysis[]
  height?: number
}

const props = withDefaults(defineProps<Props>(), {
  height: 400
})

const { actualTheme } = useTheme()
const chartCanvas = ref<HTMLCanvasElement>()
const chartInstance = ref<ChartJS<'radar'> | null>(null)

// State
const selectedDrives = ref<DriveAnalysis[]>([])
const selectedMetrics = ref<string[]>(['iops', 'avg_latency', 'bandwidth'])

// Computed
const availableDrives = computed(() => {
  return props.drives.slice(0, 8) // Limit to 8 drives for readability
})

const availableMetrics = computed(() => [
  { key: 'iops', label: 'IOPS' },
  { key: 'avg_latency', label: 'Avg Latency' },
  { key: 'bandwidth', label: 'Bandwidth' },
  { key: 'p95_latency', label: '95th % Latency' },
  { key: 'p99_latency', label: '99th % Latency' }
])

const totalConfigurations = computed(() => {
  return selectedDrives.value.reduce((sum, drive) => sum + drive.configurations.length, 0)
})

const maxValue = computed(() => {
  if (selectedDrives.value.length === 0 || selectedMetrics.value.length === 0) return 100

  let max = 0
  selectedDrives.value.forEach(drive => {
    selectedMetrics.value.forEach(metric => {
      const avgValue = getDriveMetricAverage(drive, metric)
      if (avgValue > max) max = avgValue
    })
  })
  return max
})

// Methods
const toggleDrive = (drive: DriveAnalysis) => {
  const existingIndex = selectedDrives.value.findIndex(
    d => d.hostname === drive.hostname && d.driveModel === drive.driveModel
  )

  if (existingIndex > -1) {
    selectedDrives.value.splice(existingIndex, 1)
  } else if (selectedDrives.value.length < 6) { // Limit to 6 for readability
    selectedDrives.value.push(drive)
  }

  updateChart()
}

const getDriveMetricAverage = (drive: DriveAnalysis, metric: string): number => {
  if (drive.configurations.length === 0) return 0

  const values = drive.configurations.map(config => {
    switch (metric) {
      case 'iops': return config.iops || 0
      case 'avg_latency': return config.avg_latency || 0
      case 'bandwidth': return config.bandwidth || 0
      case 'p95_latency': return config.p95_latency || 0
      case 'p99_latency': return config.p99_latency || 0
      default: return 0
    }
  }).filter(v => v > 0)

  return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0
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
  const colors = generateColorPalette(selectedDrives.value.length, actualTheme.value)

  const datasets = selectedDrives.value.map((drive, index) => {
    const data = selectedMetrics.value.map(metric => {
      const avgValue = getDriveMetricAverage(drive, metric)

      // Normalize latency metrics (lower is better, so invert)
      if (metric.includes('latency')) {
        return maxValue.value > 0 ? (maxValue.value - avgValue) / maxValue.value * 100 : 0
      }

      // For other metrics, higher is better
      return maxValue.value > 0 ? (avgValue / maxValue.value) * 100 : 0
    })

    return {
      label: `${drive.hostname} - ${drive.driveModel}`,
      data,
      borderColor: colors[index],
      backgroundColor: colors[index] + '20',
      borderWidth: 2,
      pointRadius: 4,
      pointHoverRadius: 6,
    }
  })

  return {
    labels: selectedMetrics.value.map(metric => {
      const metricInfo = availableMetrics.value.find(m => m.key === metric)
      return metricInfo?.label || metric
    }),
    datasets
  }
}

const createChartOptions = () => {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: 'Drive Performance Comparison',
        color: actualTheme.value === 'light' ? '#1F2937' : '#F9FAFB',
        font: {
          size: 16,
          weight: 'bold'
        }
      },
      legend: {
        display: selectedDrives.value.length > 1,
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
          label: (context: { dataset: { label: string }; dataIndex: number; datasetIndex: number }) => {
            const originalValue = getOriginalValue(context)
            return `${context.dataset.label}: ${originalValue}`
          }
        }
      }
    },
    scales: {
      r: {
        beginAtZero: true,
        max: 100,
        ticks: {
          color: actualTheme.value === 'light' ? '#6B7280' : '#9CA3AF',
          font: {
            size: 11
          },
          callback: (value: number | string) => `${value}%`
        },
        grid: {
          color: actualTheme.value === 'light' ? '#E5E7EB' : '#374151'
        },
        angleLines: {
          color: actualTheme.value === 'light' ? '#E5E7EB' : '#374151'
        },
        pointLabels: {
          color: actualTheme.value === 'light' ? '#374151' : '#D1D5DB',
          font: {
            size: 12,
            weight: 'bold'
          }
        }
      }
    }
  }
}

const getOriginalValue = (context: { dataset: { label: string }; dataIndex: number; datasetIndex: number }) => {
  const datasetIndex = context.datasetIndex
  const dataIndex = context.dataIndex
  const drive = selectedDrives.value[datasetIndex]
  const metric = selectedMetrics.value[dataIndex]

  if (!drive) return 'N/A'

  const avgValue = getDriveMetricAverage(drive, metric)

  if (metric.includes('latency')) {
    return `${avgValue.toFixed(3)}ms`
  } else if (metric === 'iops') {
    return avgValue.toLocaleString() + ' IOPS'
  } else if (metric === 'bandwidth') {
    return avgValue.toFixed(1) + ' MB/s'
  }

  return avgValue.toFixed(2)
}

// Lifecycle
onMounted(() => {
  if (chartCanvas.value) {
    const ctx = chartCanvas.value.getContext('2d')
    if (ctx) {
      const chartData = createChartData()
      const chartOptions = createChartOptions()

      chartInstance.value = new ChartJS(ctx, {
        type: 'radar',
        data: chartData,
        options: chartOptions
      })
    }
  }

  // Auto-select first few drives
  if (props.drives.length > 0 && selectedDrives.value.length === 0) {
    selectedDrives.value = props.drives.slice(0, Math.min(3, props.drives.length))
    updateChart()
  }
})

onUnmounted(() => {
  if (chartInstance.value) {
    chartInstance.value.destroy()
  }
})

// Watchers
watch(() => props.drives, () => {
  // Reset selection when drives change
  selectedDrives.value = props.drives.slice(0, Math.min(3, props.drives.length))
  updateChart()
})

watch(selectedMetrics, updateChart)
watch(actualTheme, updateChart)
</script>

<style scoped>
.drive-radar-chart {
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
