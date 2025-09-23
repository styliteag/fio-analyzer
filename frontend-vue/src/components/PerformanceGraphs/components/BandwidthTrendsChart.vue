<template>
  <div class="bandwidth-trends-chart">
    <div class="chart-container" :style="{ height: height + 'px' }">
      <canvas ref="chartCanvas"></canvas>
    </div>

    <!-- Chart Stats -->
    <div class="chart-stats mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="stat-card">
        <div class="text-lg font-semibold">{{ maxBandwidth.toFixed(1) }} MB/s</div>
        <div class="text-sm text-gray-600 dark:text-gray-400">Max Bandwidth</div>
      </div>
      <div class="stat-card">
        <div class="text-lg font-semibold">{{ avgBandwidth.toFixed(1) }} MB/s</div>
        <div class="text-sm text-gray-600 dark:text-gray-400">Avg Bandwidth</div>
      </div>
      <div class="stat-card">
        <div class="text-lg font-semibold">{{ bandwidthEfficiency.toFixed(1) }}%</div>
        <div class="text-sm text-gray-600 dark:text-gray-400">Efficiency</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js'
import { useTheme } from '@/contexts/ThemeContext'
import { processBandwidthTrendsData } from '@/utils/chartProcessing'

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

interface Props {
  data: Array<{
    blockSize: string
    bandwidth: number | null
  }>
  height?: number
}

const props = withDefaults(defineProps<Props>(), {
  height: 400
})

const { actualTheme } = useTheme()
const chartCanvas = ref<HTMLCanvasElement>()
const chartInstance = ref<ChartJS<'line'> | null>(null)

// Computed properties
const maxBandwidth = computed(() => {
  const bandwidths = props.data.map(d => d.bandwidth).filter(b => b !== null) as number[]
  return bandwidths.length > 0 ? Math.max(...bandwidths) : 0
})

const avgBandwidth = computed(() => {
  const bandwidths = props.data.map(d => d.bandwidth).filter(b => b !== null) as number[]
  return bandwidths.length > 0 ? bandwidths.reduce((sum, b) => sum + b, 0) / bandwidths.length : 0
})

const bandwidthEfficiency = computed(() => {
  if (props.data.length === 0) return 0
  const validData = props.data.filter(d => d.bandwidth !== null)
  return (validData.length / props.data.length) * 100
})

// Methods
const updateChart = () => {
  if (!chartInstance.value || !props.data.length) return

  const chartData = processBandwidthTrendsData(props.data, actualTheme.value)
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
        text: 'Bandwidth Trends by Block Size',
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
          label: (context: { dataset: { label: string }; parsed: { y: number | null } }) => {
            const value = context.parsed.y
            return value !== null ? `${context.dataset.label}: ${value.toFixed(1)} MB/s` : `${context.dataset.label}: No data`
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
          text: 'Bandwidth (MB/s)',
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
      const chartData = processBandwidthTrendsData(props.data, actualTheme.value)
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
.bandwidth-trends-chart {
  @apply w-full;
}

.stat-card {
  @apply bg-gray-50 dark:bg-gray-800 p-4 rounded-lg text-center;
}
</style>
