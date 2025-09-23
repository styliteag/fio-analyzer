<template>
  <div class="responsiveness-chart">
    <div class="chart-container" :style="{ height: height + 'px' }">
      <canvas ref="chartCanvas"></canvas>
    </div>

    <!-- Chart Stats -->
    <div class="chart-stats mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="stat-card">
        <div class="text-lg font-semibold">{{ maxResponsiveness.toFixed(1) }}</div>
        <div class="text-sm text-gray-600 dark:text-gray-400">Max Responsiveness</div>
      </div>
      <div class="stat-card">
        <div class="text-lg font-semibold">{{ avgResponsiveness.toFixed(1) }}</div>
        <div class="text-sm text-gray-600 dark:text-gray-400">Avg Responsiveness</div>
      </div>
      <div class="stat-card">
        <div class="text-lg font-semibold">{{ responsivenessRange.toFixed(1) }}x</div>
        <div class="text-sm text-gray-600 dark:text-gray-400">Performance Range</div>
      </div>
    </div>

    <!-- Info Box -->
    <div class="info-box mt-4 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
      <p class="text-sm text-blue-800 dark:text-blue-200">
        <strong>Responsiveness</strong> = 1000 ÷ Latency (operations per millisecond).
        Higher values indicate better performance.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js'
import { useTheme } from '@/contexts/ThemeContext'
import { processResponsivenessData } from '@/utils/chartProcessing'

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

interface Props {
  data: Array<{
    blockSize: string
    responsiveness: number | null
  }>
  height?: number
}

const props = withDefaults(defineProps<Props>(), {
  height: 400
})

const { actualTheme } = useTheme()
const chartCanvas = ref<HTMLCanvasElement>()
const chartInstance = ref<any>(null)

// Computed properties
const maxResponsiveness = computed(() => {
  const values = props.data.map(d => d.responsiveness).filter(r => r !== null) as number[]
  return values.length > 0 ? Math.max(...values) : 0
})

const avgResponsiveness = computed(() => {
  const values = props.data.map(d => d.responsiveness).filter(r => r !== null) as number[]
  return values.length > 0 ? values.reduce((sum, r) => sum + r, 0) / values.length : 0
})

const responsivenessRange = computed(() => {
  const values = props.data.map(d => d.responsiveness).filter(r => r !== null) as number[]
  if (values.length < 2) return 1
  const min = Math.min(...values)
  const max = Math.max(...values)
  return min > 0 ? max / min : 1
})

// Methods
const updateChart = () => {
  if (!chartInstance.value || !props.data.length) return

  const chartData = processResponsivenessData(props.data, actualTheme.value)
  const chartOptions = createChartOptions()

  chartInstance.value.data = chartData
  chartInstance.value.options = chartOptions
  chartInstance.value.update()
}

const createChartOptions = () => {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: 'Storage Responsiveness by Block Size',
        color: actualTheme.value === 'light' ? '#1F2937' : '#F9FAFB',
        font: {
          size: 16,
          weight: 'bold'
        }
      },
      legend: {
        display: true,
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
            const value = context.parsed.y
            return value !== null ? `${context.dataset.label}: ${value.toFixed(2)} ops/ms` : `${context.dataset.label}: No data`
          }
        }
      }
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Block Size',
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
          text: 'Responsiveness (ops/ms)',
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
  if (chartCanvas.value && props.data.length > 0) {
    const ctx = chartCanvas.value.getContext('2d')
    if (ctx) {
      const chartData = processResponsivenessData(props.data, actualTheme.value)
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

// Watch for data changes
watch(() => props.data, updateChart, { deep: true })
watch(actualTheme, updateChart)
</script>

<style scoped>
.responsiveness-chart {
  @apply w-full;
}

.stat-card {
  @apply bg-gray-50 dark:bg-gray-800 p-4 rounded-lg text-center;
}

.info-box {
  @apply text-sm;
}
</style>
