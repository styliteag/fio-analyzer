<template>
  <div class="space-y-4">
    <!-- Controls -->
    <div class="flex flex-wrap items-center gap-4">
      <!-- X-axis metric -->
      <div class="flex items-center space-x-2">
        <label class="text-sm font-medium text-gray-700 dark:text-white">
          X-Axis:
        </label>
        <select
          v-model="xMetric"
          class="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="avg_latency">Average Latency</option>
          <option value="p95_latency">P95 Latency</option>
          <option value="p99_latency">P99 Latency</option>
          <option value="bandwidth">Bandwidth</option>
        </select>
      </div>

      <!-- Y-axis metric -->
      <div class="flex items-center space-x-2">
        <label class="text-sm font-medium text-gray-700 dark:text-white">
          Y-Axis:
        </label>
        <select
          v-model="yMetric"
          class="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="iops">IOPS</option>
          <option value="bandwidth">Bandwidth</option>
          <option value="avg_latency">Average Latency</option>
        </select>
      </div>

      <!-- Color coding -->
      <div class="flex items-center space-x-2">
        <label class="text-sm font-medium text-gray-700 dark:text-white">
          Color by:
        </label>
        <select
          v-model="colorBy"
          class="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="performance">Performance Zone</option>
          <option value="hostname">Host</option>
          <option value="drive_type">Drive Type</option>
          <option value="block_size">Block Size</option>
        </select>
      </div>
    </div>

    <!-- Chart area -->
    <div class="relative bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
      <svg
        :width="chartWidth"
        :height="chartHeight"
        class="w-full h-full"
      >
        <!-- Background grid -->
        <defs>
          <pattern
            id="grid"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="#f3f4f6"
              stroke-width="1"
              class="dark:stroke-gray-700"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        <!-- Axes -->
        <g class="axes">
          <!-- X-axis -->
          <line
            x1="60"
            y1="320"
            x2="540"
            y2="320"
            stroke="#6b7280"
            stroke-width="2"
          />
          <text
            x="300"
            y="350"
            text-anchor="middle"
            class="text-sm fill-gray-700 dark:fill-gray-300 font-medium"
          >
            {{ xAxisLabel }}
          </text>

          <!-- Y-axis -->
          <line
            x1="60"
            y1="20"
            x2="60"
            y2="320"
            stroke="#6b7280"
            stroke-width="2"
          />
          <text
            x="20"
            y="170"
            text-anchor="middle"
            transform="rotate(-90, 20, 170)"
            class="text-sm fill-gray-700 dark:fill-gray-300 font-medium"
          >
            {{ yAxisLabel }}
          </text>
        </g>

        <!-- Data points -->
        <g class="data-points">
          <circle
            v-for="point in scatterPoints"
            :key="point.id"
            :cx="point.x"
            :cy="point.y"
            :r="point.size"
            :fill="point.color"
            :stroke="point.stroke"
            stroke-width="2"
            class="cursor-pointer hover:opacity-80 transition-opacity"
            @mouseover="showTooltip(point)"
            @mouseout="hideTooltip"
            @click="onPointClick(point)"
          />
        </g>

        <!-- Trend line (optional) -->
        <line
          v-if="showTrendLine && trendLinePoints.length > 1"
          :x1="trendLinePoints[0].x"
          :y1="trendLinePoints[0].y"
          :x2="trendLinePoints[trendLinePoints.length - 1].x"
          :y2="trendLinePoints[trendLinePoints.length - 1].y"
          stroke="#ef4444"
          stroke-width="2"
          stroke-dasharray="5,5"
          opacity="0.7"
        />

        <!-- Correlation coefficient -->
        <text
          v-if="correlation !== null"
          x="520"
          y="30"
          text-anchor="end"
          class="text-sm fill-gray-600 dark:fill-gray-400"
        >
          r = {{ correlation.toFixed(3) }}
        </text>
      </svg>

      <!-- Tooltip -->
      <div
        v-if="tooltip.visible"
        class="absolute z-10 bg-gray-900 text-white px-3 py-2 rounded-md text-sm shadow-lg pointer-events-none max-w-xs"
        :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
      >
        <div class="font-medium">{{ tooltip.title }}</div>
        <div class="text-xs text-gray-300 mt-1">
          <div>{{ xAxisLabel }}: {{ formatValue(tooltip.data.xValue, xMetric) }}</div>
          <div>{{ yAxisLabel }}: {{ formatValue(tooltip.data.yValue, yMetric) }}</div>
          <div v-if="tooltip.data.hostname">Host: {{ tooltip.data.hostname }}</div>
          <div v-if="tooltip.data.drive_model">Drive: {{ tooltip.data.drive_model }}</div>
          <div v-if="tooltip.data.block_size">Block Size: {{ tooltip.data.block_size }}</div>
        </div>
      </div>

      <!-- Legend -->
      <div
        v-if="showLegend"
        class="absolute top-4 right-4 bg-white dark:bg-gray-800 p-3 rounded-md shadow-lg border border-gray-200 dark:border-gray-700"
      >
        <div class="text-sm font-medium text-gray-900 dark:text-white mb-2">
          Legend
        </div>
        <div class="space-y-1">
          <div
            v-for="legendItem in legendItems"
            :key="legendItem.label"
            class="flex items-center space-x-2"
          >
            <div
              class="w-3 h-3 rounded-full"
              :style="{ backgroundColor: legendItem.color }"
            />
            <span class="text-xs text-gray-700 dark:text-gray-300">
              {{ legendItem.label }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Statistics -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
      <div class="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
        <div class="text-gray-600 dark:text-gray-400">Data Points</div>
        <div class="text-lg font-semibold text-gray-900 dark:text-white">{{ scatterPoints.length }}</div>
      </div>

      <div class="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
        <div class="text-gray-600 dark:text-gray-400">Correlation</div>
        <div class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ correlation !== null ? correlation.toFixed(3) : 'N/A' }}
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
        <div class="text-gray-600 dark:text-gray-400">X Range</div>
        <div class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ formatRange(xRange, xMetric) }}
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
        <div class="text-gray-600 dark:text-gray-400">Y Range</div>
        <div class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ formatRange(yRange, yMetric) }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useTestRunsStore } from '@/stores/testRuns'
import { processScatterData } from '@/utils/chartProcessing'
import { formatIOPS, formatLatency, formatBandwidth } from '@/utils/formatters'

interface ScatterPoint {
  id: string
  x: number
  y: number
  size: number
  color: string
  stroke: string
  data: any
}

interface Tooltip {
  visible: boolean
  x: number
  y: number
  title: string
  data: any
}

const props = defineProps<{
  data?: any[]
  showTrendLine?: boolean
  showLegend?: boolean
}>()

const testRunsStore = useTestRunsStore()

const xMetric = ref<'avg_latency' | 'p95_latency' | 'p99_latency' | 'bandwidth'>('avg_latency')
const yMetric = ref<'iops' | 'bandwidth' | 'avg_latency'>('iops')
const colorBy = ref<'performance' | 'hostname' | 'drive_type' | 'block_size'>('performance')
const tooltip = ref<Tooltip>({
  visible: false,
  x: 0,
  y: 0,
  title: '',
  data: null,
})

const chartWidth = 600
const chartHeight = 400
const margin = { top: 20, right: 60, bottom: 60, left: 60 }

// Computed properties
const testRuns = computed(() => props.data || testRunsStore.state.data)

const scatterData = computed(() => {
  if (!testRuns.value || testRuns.value.length === 0) return []

  return processScatterData(testRuns.value, xMetric.value, yMetric.value)
})

const xValues = computed(() => scatterData.value.map(d => d.x))
const yValues = computed(() => scatterData.value.map(d => d.y))

const xRange = computed(() => {
  if (xValues.value.length === 0) return { min: 0, max: 0 }
  return {
    min: Math.min(...xValues.value),
    max: Math.max(...xValues.value),
  }
})

const yRange = computed(() => {
  if (yValues.value.length === 0) return { min: 0, max: 0 }
  return {
    min: Math.min(...yValues.value),
    max: Math.max(...yValues.value),
  }
})

const correlation = computed(() => {
  if (xValues.value.length < 2) return null

  const x = xValues.value
  const y = yValues.value
  const n = x.length

  const sumX = x.reduce((a, b) => a + b, 0)
  const sumY = y.reduce((a, b) => a + b, 0)
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0)
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0)
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0)

  const numerator = n * sumXY - sumX * sumY
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))

  return denominator === 0 ? null : numerator / denominator
})

const scatterPoints = computed((): ScatterPoint[] => {
  return scatterData.value.map((point, index) => {
    // Scale coordinates to fit chart
    const xScale = (chartWidth - margin.left - margin.right) / (xRange.value.max - xRange.value.min || 1)
    const yScale = (chartHeight - margin.top - margin.bottom) / (yRange.value.max - yRange.value.min || 1)

    const x = margin.left + (point.x - xRange.value.min) * xScale
    const y = chartHeight - margin.bottom - (point.y - yRange.value.min) * yScale

    return {
      id: `point-${index}`,
      x: isNaN(x) ? margin.left : x,
      y: isNaN(y) ? chartHeight - margin.bottom : y,
      size: 6,
      color: getPointColor(point, index),
      stroke: '#ffffff',
      data: point,
    }
  })
})

const trendLinePoints = computed(() => {
  if (!props.showTrendLine || scatterPoints.value.length < 2) return []

  // Simple linear regression for trend line
  const points = scatterPoints.value
  const n = points.length
  const sumX = points.reduce((sum, p) => sum + p.x, 0)
  const sumY = points.reduce((sum, p) => sum + p.y, 0)
  const sumXY = points.reduce((sum, p) => sum + p.x * p.y, 0)
  const sumX2 = points.reduce((sum, p) => sum + p.x * p.x, 0)

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n

  const x1 = Math.min(...points.map(p => p.x))
  const x2 = Math.max(...points.map(p => p.x))
  const y1 = slope * x1 + intercept
  const y2 = slope * x2 + intercept

  return [
    { x: x1, y: y1 },
    { x: x2, y: y2 },
  ]
})

const legendItems = computed(() => {
  const items = []

  switch (colorBy.value) {
    case 'performance':
      items.push(
        { label: 'High Performance', color: '#10b981' },
        { label: 'Balanced', color: '#f59e0b' },
        { label: 'High Latency', color: '#ef4444' },
        { label: 'Low Performance', color: '#6b7280' }
      )
      break
    case 'hostname':
      // Generate colors for unique hostnames
      const hostnames = [...new Set(testRuns.value.map(r => r.hostname))]
      hostnames.forEach((host, index) => {
        items.push({
          label: host,
          color: `hsl(${index * 360 / hostnames.length}, 70%, 50%)`,
        })
      })
      break
    // Add cases for other colorBy options...
  }

  return items
})

const xAxisLabel = computed(() => {
  switch (xMetric.value) {
    case 'avg_latency': return 'Average Latency (ms)'
    case 'p95_latency': return 'P95 Latency (ms)'
    case 'p99_latency': return 'P99 Latency (ms)'
    case 'bandwidth': return 'Bandwidth (MB/s)'
    default: return 'X-Axis'
  }
})

const yAxisLabel = computed(() => {
  switch (yMetric.value) {
    case 'iops': return 'IOPS'
    case 'bandwidth': return 'Bandwidth (MB/s)'
    case 'avg_latency': return 'Average Latency (ms)'
    default: return 'Y-Axis'
  }
})

// Methods
function getPointColor(point: any, index: number): string {
  switch (colorBy.value) {
    case 'performance':
      return point.zone === 'high_performance' ? '#10b981' :
             point.zone === 'balanced' ? '#f59e0b' :
             point.zone === 'high_latency' ? '#ef4444' : '#6b7280'
    case 'hostname':
      const hostnames = [...new Set(testRuns.value.map(r => r.hostname))]
      const hostIndex = hostnames.indexOf(point.metadata?.hostname)
      return `hsl(${hostIndex * 360 / hostnames.length}, 70%, 50%)`
    case 'drive_type':
      return point.metadata?.drive_type === 'NVMe' ? '#3b82f6' :
             point.metadata?.drive_type === 'SATA' ? '#10b981' :
             point.metadata?.drive_type === 'SAS' ? '#f59e0b' : '#6b7280'
    case 'block_size':
      return point.metadata?.block_size === '4K' ? '#ef4444' :
             point.metadata?.block_size === '8K' ? '#f59e0b' :
             point.metadata?.block_size === '16K' ? '#10b981' : '#6b7280'
    default:
      return '#3b82f6'
  }
}

function showTooltip(point: ScatterPoint) {
  const event = window.event as MouseEvent
  tooltip.value = {
    visible: true,
    x: event.clientX + 10,
    y: event.clientY - 10,
    title: point.data.label || 'Data Point',
    data: {
      xValue: point.data.x,
      yValue: point.data.y,
      ...point.data.metadata,
    },
  }
}

function hideTooltip() {
  tooltip.value.visible = false
}

function onPointClick(point: ScatterPoint) {
  console.log('Point clicked:', point)
}

function formatValue(value: number, metric: string): string {
  switch (metric) {
    case 'iops':
      return formatIOPS(value)
    case 'bandwidth':
      return formatBandwidth(value)
    case 'avg_latency':
    case 'p95_latency':
    case 'p99_latency':
      return formatLatency(value)
    default:
      return value.toString()
  }
}

function formatRange(range: { min: number; max: number }, metric: string): string {
  return `${formatValue(range.min, metric)} - ${formatValue(range.max, metric)}`
}

// Watch for changes
watch([xMetric, yMetric, colorBy], () => {
  hideTooltip()
})
</script>

<style scoped>
/* Additional styles if needed */
</style>
