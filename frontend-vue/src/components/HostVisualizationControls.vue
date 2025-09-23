<template>
  <div class="host-visualization-controls">
    <!-- Visualization Type Selector -->
    <div class="viz-selector mb-4">
      <h4 class="text-sm font-medium theme-text-primary mb-3">Visualization Type</h4>
      <div class="grid grid-cols-2 md:grid-cols-5 gap-2">
        <button
          v-for="vizType in visualizationTypes"
          :key="vizType.id"
          :class="[
            'viz-btn',
            activeVisualization === vizType.id ? 'active' : ''
          ]"
          @click="selectVisualization(vizType.id)"
        >
          <component :is="vizType.icon" class="w-4 h-4 mb-1" />
          <span class="text-xs">{{ vizType.label }}</span>
        </button>
      </div>
    </div>

    <!-- Visualization-Specific Controls -->
    <div class="viz-controls">
      <!-- Performance Graphs Controls -->
      <div v-if="activeVisualization === 'graphs'" class="control-section">
        <h5 class="control-title">Chart Type</h5>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="chartType in graphChartTypes"
            :key="chartType.id"
            :class="[
              'chart-type-btn',
              selectedGraphChart === chartType.id ? 'active' : ''
            ]"
            @click="selectedGraphChart = chartType.id"
          >
            {{ chartType.label }}
          </button>
        </div>
      </div>

      <!-- Heatmap Controls -->
      <div v-if="activeVisualization === 'heatmap'" class="control-section">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h5 class="control-title">Primary Metric</h5>
            <select
              v-model="heatmapMetric"
              class="control-select"
            >
              <option value="iops">IOPS</option>
              <option value="bandwidth">Bandwidth</option>
              <option value="responsiveness">Responsiveness</option>
            </select>
          </div>
          <div>
            <h5 class="control-title">Color Scale</h5>
            <select
              v-model="heatmapColorScale"
              class="control-select"
            >
              <option value="linear">Linear</option>
              <option value="logarithmic">Logarithmic</option>
            </select>
          </div>
        </div>
        <div class="mt-3">
          <label class="flex items-center">
            <input
              v-model="heatmapShowValues"
              type="checkbox"
              class="control-checkbox"
            >
            <span class="ml-2 text-sm theme-text-primary">Show Values</span>
          </label>
        </div>
      </div>

      <!-- Radar Controls -->
      <div v-if="activeVisualization === 'radar'" class="control-section">
        <h5 class="control-title">Metrics to Compare</h5>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
          <label
            v-for="metric in radarMetrics"
            :key="metric.id"
            class="flex items-center"
          >
            <input
              v-model="selectedRadarMetrics"
              :value="metric.id"
              type="checkbox"
              class="control-checkbox"
            >
            <span class="ml-2 text-xs theme-text-primary">{{ metric.label }}</span>
          </label>
        </div>
      </div>

      <!-- Scatter Controls -->
      <div v-if="activeVisualization === 'scatter'" class="control-section">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h5 class="control-title">X-Axis</h5>
            <select
              v-model="scatterXAxis"
              class="control-select"
            >
              <option value="iops">IOPS</option>
              <option value="bandwidth">Bandwidth</option>
              <option value="avg_latency">Avg Latency</option>
              <option value="block_size">Block Size</option>
              <option value="queue_depth">Queue Depth</option>
            </select>
          </div>
          <div>
            <h5 class="control-title">Y-Axis</h5>
            <select
              v-model="scatterYAxis"
              class="control-select"
            >
              <option value="iops">IOPS</option>
              <option value="bandwidth">Bandwidth</option>
              <option value="avg_latency">Avg Latency</option>
              <option value="block_size">Block Size</option>
              <option value="queue_depth">Queue Depth</option>
            </select>
          </div>
        </div>
        <div class="mt-3 flex items-center gap-4">
          <label class="flex items-center">
            <input
              v-model="scatterShowRegression"
              type="checkbox"
              class="control-checkbox"
            >
            <span class="ml-2 text-sm theme-text-primary">Show Regression</span>
          </label>
          <span class="text-xs theme-text-secondary">
            Correlation: {{ scatterCorrelation.toFixed(3) }}
          </span>
        </div>
      </div>

      <!-- Parallel Coordinates Controls -->
      <div v-if="activeVisualization === 'parallel'" class="control-section">
        <h5 class="control-title">Dimensions ({{ selectedParallelDimensions.length }}/6)</h5>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
          <label
            v-for="dimension in parallelDimensions"
            :key="dimension.id"
            class="flex items-center"
          >
            <input
              v-model="selectedParallelDimensions"
              :value="dimension.id"
              type="checkbox"
              class="control-checkbox"
              :disabled="selectedParallelDimensions.length >= 6 && !selectedParallelDimensions.includes(dimension.id)"
            >
            <span class="ml-2 text-xs theme-text-primary">{{ dimension.label }}</span>
          </label>
        </div>
        <div class="mt-3">
          <label class="flex items-center">
            <input
              v-model="parallelBrushMode"
              type="checkbox"
              class="control-checkbox"
            >
            <span class="ml-2 text-sm theme-text-primary">Brush Mode</span>
          </label>
        </div>
      </div>
    </div>

    <!-- Export Controls -->
    <div class="export-controls mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
      <div class="flex gap-2">
        <button class="export-btn">
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
          Export PNG
        </button>
        <button class="export-btn">
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
          Export CSV
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { BarChart3, Activity, Target, TrendingUp, GitBranch } from 'lucide-vue-next'
import type { PerformanceData } from '@/types/performance'
import type { FilterState } from '@/types/filters'

interface Props {
  performanceData: PerformanceData[]
  filters: FilterState
  activeVisualization?: 'graphs' | 'heatmap' | 'radar' | 'scatter' | 'parallel'
}

const props = withDefaults(defineProps<Props>(), {
  activeVisualization: 'graphs'
})

const emit = defineEmits<{
  'update:activeVisualization': [type: string]
  'update:visualizationConfig': [config: Record<string, unknown>]
}>()

// Reactive state
const activeVisualization = ref(props.activeVisualization)

// Performance Graphs state
const selectedGraphChart = ref<'iops-comparison' | 'latency-analysis' | 'bandwidth-trends' | 'responsiveness'>('iops-comparison')

// Heatmap state
const heatmapMetric = ref<'iops' | 'bandwidth' | 'responsiveness'>('iops')
const heatmapColorScale = ref<'linear' | 'logarithmic'>('linear')
const heatmapShowValues = ref(false)

// Radar state
const selectedRadarMetrics = ref<string[]>(['iops', 'avg_latency', 'bandwidth'])

// Scatter state
const scatterXAxis = ref<'iops' | 'bandwidth' | 'avg_latency' | 'block_size' | 'queue_depth'>('iops')
const scatterYAxis = ref<'iops' | 'bandwidth' | 'avg_latency' | 'block_size' | 'queue_depth'>('bandwidth')
const scatterShowRegression = ref(false)

// Parallel coordinates state
const selectedParallelDimensions = ref<string[]>(['iops', 'avg_latency', 'bandwidth', 'block_size', 'queue_depth'])
const parallelBrushMode = ref(false)

// Visualization types
const visualizationTypes = [
  { id: 'graphs', label: 'Graphs', icon: BarChart3 },
  { id: 'heatmap', label: 'Heatmap', icon: Activity },
  { id: 'radar', label: 'Radar', icon: Target },
  { id: 'scatter', label: 'Scatter', icon: TrendingUp },
  { id: 'parallel', label: 'Parallel', icon: GitBranch }
]

const graphChartTypes = [
  { id: 'iops-comparison', label: 'IOPS Comparison' },
  { id: 'latency-analysis', label: 'Latency Analysis' },
  { id: 'bandwidth-trends', label: 'Bandwidth Trends' },
  { id: 'responsiveness', label: 'Responsiveness' }
]

const radarMetrics = [
  { id: 'iops', label: 'IOPS' },
  { id: 'avg_latency', label: 'Avg Latency' },
  { id: 'bandwidth', label: 'Bandwidth' },
  { id: 'p95_latency', label: '95th % Latency' },
  { id: 'p99_latency', label: '99th % Latency' }
]

const parallelDimensions = [
  { id: 'iops', label: 'IOPS' },
  { id: 'avg_latency', label: 'Avg Lat' },
  { id: 'bandwidth', label: 'BW' },
  { id: 'p95_latency', label: '95% Lat' },
  { id: 'block_size', label: 'Block' },
  { id: 'queue_depth', label: 'QD' },
  { id: 'num_jobs', label: 'Jobs' }
]

// Computed properties
const scatterCorrelation = computed(() => {
  if (!props.performanceData.length) return 0

  const xValues = props.performanceData.map(item => getMetricValue(item, scatterXAxis.value)).filter(v => v !== null) as number[]
  const yValues = props.performanceData.map(item => getMetricValue(item, scatterYAxis.value)).filter(v => v !== null) as number[]

  if (xValues.length !== yValues.length || xValues.length < 2) return 0

  const n = xValues.length
  const sumX = xValues.reduce((a, b) => a + b, 0)
  const sumY = yValues.reduce((a, b) => a + b, 0)
  const sumXY = xValues.reduce((sum, xi, i) => sum + xi * yValues[i], 0)
  const sumX2 = xValues.reduce((sum, xi) => sum + xi * xi, 0)
  const sumY2 = yValues.reduce((sum, yi) => sum + yi * yi, 0)

  const numerator = n * sumXY - sumX * sumY
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))

  return denominator === 0 ? 0 : numerator / denominator
})

// Methods
const selectVisualization = (type: string) => {
  activeVisualization.value = type as 'graphs' | 'heatmap' | 'radar' | 'scatter' | 'parallel'
  emit('update:activeVisualization', type)
  emitVisualizationConfig()
}

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

const emitVisualizationConfig = () => {
  const config = {
    type: activeVisualization.value,
    // Add type-specific config based on current visualization
    ...(activeVisualization.value === 'graphs' && {
      chartType: selectedGraphChart.value
    }),
    ...(activeVisualization.value === 'heatmap' && {
      metric: heatmapMetric.value,
      colorScale: heatmapColorScale.value,
      showValues: heatmapShowValues.value
    }),
    ...(activeVisualization.value === 'radar' && {
      metrics: selectedRadarMetrics.value
    }),
    ...(activeVisualization.value === 'scatter' && {
      xAxis: scatterXAxis.value,
      yAxis: scatterYAxis.value,
      showRegression: scatterShowRegression.value
    }),
    ...(activeVisualization.value === 'parallel' && {
      dimensions: selectedParallelDimensions.value,
      brushMode: parallelBrushMode.value
    })
  }

  emit('update:visualizationConfig', config)
}

// Watchers
watch(activeVisualization, emitVisualizationConfig)
watch(selectedGraphChart, emitVisualizationConfig)
watch(heatmapMetric, emitVisualizationConfig)
watch(heatmapColorScale, emitVisualizationConfig)
watch(heatmapShowValues, emitVisualizationConfig)
watch(selectedRadarMetrics, emitVisualizationConfig, { deep: true })
watch(scatterXAxis, emitVisualizationConfig)
watch(scatterYAxis, emitVisualizationConfig)
watch(scatterShowRegression, emitVisualizationConfig)
watch(selectedParallelDimensions, emitVisualizationConfig, { deep: true })
watch(parallelBrushMode, emitVisualizationConfig)

// Watch props
watch(() => props.activeVisualization, (newVal) => {
  activeVisualization.value = newVal
})
</script>

<style scoped>
.host-visualization-controls {
  @apply w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6;
}

.theme-text-primary {
  @apply text-gray-900 dark:text-white;
}

.theme-text-secondary {
  @apply text-gray-600 dark:text-gray-300;
}

.viz-selector {
  @apply border-b border-gray-200 dark:border-gray-700 pb-4;
}

.viz-btn {
  @apply flex flex-col items-center justify-center p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors;
}

.viz-btn.active {
  @apply bg-blue-600 border-blue-600 text-white;
}

.control-section {
  @apply mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg;
}

.control-title {
  @apply text-sm font-medium theme-text-primary mb-3;
}

.chart-type-btn {
  @apply px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors;
}

.chart-type-btn.active {
  @apply bg-blue-600 border-blue-600 text-white;
}

.control-select {
  @apply w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white;
}

.control-checkbox {
  @apply w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600;
}

.export-controls {
  @apply flex justify-center;
}

.export-btn {
  @apply flex items-center px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors;
}
</style>
