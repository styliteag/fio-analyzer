<template>
  <div class="iops-comparison-chart">
    <div class="chart-container" :style="{ height: height + 'px' }">
      <canvas ref="chartCanvas"></canvas>
    </div>

    <!-- Chart Controls -->
    <div class="chart-controls mt-4">
      <div class="flex flex-wrap gap-2">
        <button
          v-for="pattern in availablePatterns"
          :key="pattern"
          :class="[
            'px-3 py-1 rounded-full text-sm transition-colors',
            selectedPatterns.includes(pattern)
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          ]"
          @click="togglePattern(pattern)"
        >
          {{ pattern.replace('_', ' ').toUpperCase() }}
        </button>
      </div>
    </div>

    <!-- Chart Stats -->
    <div class="chart-stats mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="stat-card">
        <div class="text-lg font-semibold">{{ maxIOPS.toLocaleString() }}</div>
        <div class="text-sm text-gray-600 dark:text-gray-400">Max IOPS</div>
      </div>
      <div class="stat-card">
        <div class="text-lg font-semibold">{{ avgIOPS.toFixed(0) }}</div>
        <div class="text-sm text-gray-600 dark:text-gray-400">Avg IOPS</div>
      </div>
      <div class="stat-card">
        <div class="text-lg font-semibold">{{ blockSizes.length }}</div>
        <div class="text-sm text-gray-600 dark:text-gray-400">Block Sizes</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js'
import { useTheme } from '@/contexts/ThemeContext'
import { processIOPSComparisonData } from '@/utils/chartProcessing'

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

interface Props {
  data: Array<{
    blockSize: string
    patterns: Array<{
      pattern: string
      iops: number | null
    }>
  }>
  height?: number
}

const props = defineProps<Props>()

const { actualTheme } = useTheme()
const chartCanvas = ref<HTMLCanvasElement>()
const chartInstance = ref<ChartJS<'line'> | null>(null)
const selectedPatterns = ref<string[]>(['random_read', 'random_write', 'sequential_read', 'sequential_write'])

// Computed properties
const availablePatterns = computed(() => {
  const patterns = new Set<string>()
  props.data.forEach(blockData => {
    blockData.patterns.forEach(p => patterns.add(p.pattern))
  })
  return Array.from(patterns).sort()
})

const blockSizes = computed(() => {
  return [...new Set(props.data.map(d => d.blockSize))]
})

const maxIOPS = computed(() => {
  let max = 0
  props.data.forEach(blockData => {
    blockData.patterns.forEach(pattern => {
      if (selectedPatterns.value.includes(pattern.pattern) && pattern.iops && pattern.iops > max) {
        max = pattern.iops
      }
    })
  })
  return max
})

const avgIOPS = computed(() => {
  const values: number[] = []
  props.data.forEach(blockData => {
    blockData.patterns.forEach(pattern => {
      if (selectedPatterns.value.includes(pattern.pattern) && pattern.iops) {
        values.push(pattern.iops)
      }
    })
  })
  return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0
})

// Methods
const togglePattern = (pattern: string) => {
  const index = selectedPatterns.value.indexOf(pattern)
  if (index > -1) {
    selectedPatterns.value.splice(index, 1)
  } else {
    selectedPatterns.value.push(pattern)
  }
  updateChart()
}

const updateChart = () => {
  if (!chartInstance.value || !props.data.length) return

  // Filter data based on selected patterns
  const filteredData = props.data.map(blockData => ({
    ...blockData,
    patterns: blockData.patterns.filter(p => selectedPatterns.value.includes(p.pattern))
  }))

  const chartData = processIOPSComparisonData(filteredData, actualTheme.value)
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
        text: 'IOPS Comparison by Block Size',
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
            return value !== null ? `${context.dataset.label}: ${value.toLocaleString()} IOPS` : `${context.dataset.label}: No data`
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
          text: 'IOPS',
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
      const chartData = processIOPSComparisonData(props.data, actualTheme.value)
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
.iops-comparison-chart {
  @apply w-full;
}

.chart-container {
  @apply w-full;
}

.stat-card {
  @apply bg-gray-50 dark:bg-gray-800 p-4 rounded-lg text-center;
}
</style>
