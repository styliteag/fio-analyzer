<template>
  <div class="latency-analysis-chart">
    <div class="chart-container" :style="{ height: height + 'px' }">
      <canvas ref="chartCanvas"></canvas>
    </div>

    <!-- Chart Stats -->
    <div class="chart-stats mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="stat-card">
        <div class="text-lg font-semibold">{{ (minLatency * 1000).toFixed(2) }}ns</div>
        <div class="text-sm text-gray-600 dark:text-gray-400">Min Latency</div>
      </div>
      <div class="stat-card">
        <div class="text-lg font-semibold">{{ (avgLatency * 1000).toFixed(2) }}ns</div>
        <div class="text-sm text-gray-600 dark:text-gray-400">Avg Latency</div>
      </div>
      <div class="stat-card">
        <div class="text-lg font-semibold">{{ latencyRange.toFixed(2) }}x</div>
        <div class="text-sm text-gray-600 dark:text-gray-400">Latency Range</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js'
import { useTheme } from '@/contexts/ThemeContext'
import { processLatencyAnalysisData } from '@/utils/chartProcessing'

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

interface Props {
  data: Array<{
    blockSize: string
    latency: number | null
    p95Latency: number | null
    p99Latency: number | null
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
const minLatency = computed(() => {
  const latencies = props.data.map(d => d.latency).filter(l => l !== null) as number[]
  return latencies.length > 0 ? Math.min(...latencies) : 0
})

const avgLatency = computed(() => {
  const latencies = props.data.map(d => d.latency).filter(l => l !== null) as number[]
  return latencies.length > 0 ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length : 0
})

const latencyRange = computed(() => {
  const latencies = props.data.map(d => d.latency).filter(l => l !== null) as number[]
  if (latencies.length < 2) return 1
  const min = Math.min(...latencies)
  const max = Math.max(...latencies)
  return min > 0 ? max / min : 1
})

// Methods
const updateChart = () => {
  if (!chartInstance.value || !props.data.length) return

  const chartData = processLatencyAnalysisData(props.data, actualTheme.value)
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
        text: 'Latency Analysis by Block Size',
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
            return value !== null ? `${context.dataset.label}: ${(value * 1000).toFixed(2)}ns` : `${context.dataset.label}: No data`
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
          text: 'Latency (ms)',
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
          },
          callback: (value: any) => `${value}ms`
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
      const chartData = processLatencyAnalysisData(props.data, actualTheme.value)
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
.latency-analysis-chart {
  @apply w-full;
}

.stat-card {
  @apply bg-gray-50 dark:bg-gray-800 p-4 rounded-lg text-center;
}
</style>
