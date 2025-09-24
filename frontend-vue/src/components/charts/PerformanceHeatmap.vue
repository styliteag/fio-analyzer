<template>
  <div class="space-y-4">
    <!-- Controls -->
    <div class="flex items-center justify-between">
      <div class="flex items-center space-x-4">
        <!-- Metric selector -->
        <div class="flex items-center space-x-2">
          <label class="text-sm font-medium text-gray-700 dark:text-white">
            Metric:
          </label>
          <select
            v-model="selectedMetric"
            class="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="iops">IOPS</option>
            <option value="bandwidth">Bandwidth</option>
            <option value="latency">Latency</option>
          </select>
        </div>

        <!-- Color scale selector -->
        <div class="flex items-center space-x-2">
          <label class="text-sm font-medium text-gray-700 dark:text-white">
            Scale:
          </label>
          <select
            v-model="colorScale"
            class="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="relative">Relative</option>
            <option value="absolute">Absolute</option>
          </select>
        </div>
      </div>

      <!-- Legend toggle -->
      <button
        @click="showLegend = !showLegend"
        class="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
      >
        {{ showLegend ? 'Hide Legend' : 'Show Legend' }}
      </button>
    </div>

    <!-- Chart area -->
    <div class="relative overflow-x-auto">
      <svg
        :width="chartWidth"
        :height="chartHeight"
        class="border border-gray-200 dark:border-gray-700 rounded-lg"
      >
        <!-- Background -->
        <rect
          width="100%"
          height="100%"
          fill="white"
          class="dark:fill-gray-800"
        />

        <!-- Y-axis labels (patterns) -->
        <g class="y-labels">
          <text
            v-for="(pattern, index) in yLabels"
            :key="pattern"
            :x="labelWidth - 10"
            :y="headerHeight + (index + 0.5) * cellHeight"
            text-anchor="end"
            dominant-baseline="middle"
            class="text-xs fill-gray-700 dark:fill-gray-300 font-medium"
          >
            {{ pattern }}
          </text>
        </g>

        <!-- X-axis labels (hosts) -->
        <g class="x-labels">
          <text
            v-for="(host, index) in xLabels"
            :key="host"
            :x="labelWidth + (index + 0.5) * cellWidth"
            :y="headerHeight - 10"
            text-anchor="middle"
            dominant-baseline="baseline"
            class="text-xs fill-gray-700 dark:fill-gray-300 font-medium"
            :transform="`rotate(-45, ${labelWidth + (index + 0.5) * cellWidth}, ${headerHeight - 10})`"
          >
            {{ host }}
          </text>
        </g>

        <!-- Heatmap cells -->
        <g class="heatmap-cells">
          <rect
            v-for="cell in heatmapCells"
            :key="`${cell.x}-${cell.y}`"
            :x="getCellX(cell.x)"
            :y="getCellY(cell.y)"
            :width="cellWidth"
            :height="cellHeight"
            :fill="cell.color"
            :stroke="cell.stroke || '#e5e7eb'"
            stroke-width="1"
            class="cursor-pointer hover:opacity-80 transition-opacity"
            @mouseover="showTooltip(cell)"
            @mouseout="hideTooltip"
            @click="onCellClick(cell)"
          />

          <!-- Cell values -->
          <text
            v-for="cell in heatmapCells"
            :key="`text-${cell.x}-${cell.y}`"
            :x="getCellX(cell.x) + cellWidth / 2"
            :y="getCellY(cell.y) + cellHeight / 2"
            text-anchor="middle"
            dominant-baseline="middle"
            class="text-xs fill-white font-medium pointer-events-none select-none"
            :class="{ 'fill-gray-900': isLightColor(cell.color) }"
          >
            {{ formatCellValue(cell.value) }}
          </text>
        </g>

        <!-- Grid lines -->
        <g class="grid-lines" stroke="#e5e7eb" stroke-width="0.5" opacity="0.3">
          <!-- Vertical lines -->
          <line
            v-for="i in xLabels.length + 1"
            :key="`v-${i}`"
            :x1="labelWidth + i * cellWidth"
            :y1="headerHeight"
            :x2="labelWidth + i * cellWidth"
            :y2="headerHeight + yLabels.length * cellHeight"
          />

          <!-- Horizontal lines -->
          <line
            v-for="i in yLabels.length + 1"
            :key="`h-${i}`"
            :x1="labelWidth"
            :y1="headerHeight + i * cellHeight"
            :x2="labelWidth + xLabels.length * cellWidth"
            :y2="headerHeight + i * cellHeight"
          />
        </g>
      </svg>

      <!-- Tooltip -->
      <div
        v-if="tooltip.visible"
        class="absolute z-10 bg-gray-900 text-white px-3 py-2 rounded-md text-sm shadow-lg pointer-events-none"
        :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
      >
        <div class="font-medium">{{ tooltip.content }}</div>
        <div class="text-xs text-gray-300 mt-1">{{ tooltip.subContent }}</div>
      </div>
    </div>

    <!-- Legend -->
    <div
      v-if="showLegend"
      class="flex items-center justify-center space-x-2 text-sm"
    >
      <span class="text-gray-600 dark:text-gray-400">Low</span>
      <div class="flex space-x-1">
        <div
          v-for="color in legendColors"
          :key="color"
          :style="{ backgroundColor: color }"
          class="w-4 h-4 rounded-sm"
        />
      </div>
      <span class="text-gray-600 dark:text-gray-400">High</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useTestRunsStore } from '@/stores/testRuns'
import { processHeatmapData, calculateRelativeColorScale } from '@/utils/chartProcessing'
import { formatIOPS, formatLatency, formatBandwidth } from '@/utils/formatters'

interface HeatmapCell {
  x: string
  y: string
  value: number
  color: string
  tooltip?: string
  stroke?: string
}

interface Tooltip {
  visible: boolean
  x: number
  y: number
  content: string
  subContent: string
}

const props = defineProps<{
  data?: any[]
  width?: number
  height?: number
}>()

const testRunsStore = useTestRunsStore()

const selectedMetric = ref<'iops' | 'bandwidth' | 'latency'>('iops')
const colorScale = ref<'relative' | 'absolute'>('relative')
const showLegend = ref(true)
const tooltip = ref<Tooltip>({
  visible: false,
  x: 0,
  y: 0,
  content: '',
  subContent: '',
})

// Chart dimensions
const labelWidth = 120
const headerHeight = 80
const cellWidth = 60
const cellHeight = 40

const chartWidth = computed(() => {
  const data = heatmapData.value
  return labelWidth + (data.xLabels?.length || 0) * cellWidth + 20
})

const chartHeight = computed(() => {
  const data = heatmapData.value
  return headerHeight + (data.yLabels?.length || 0) * cellHeight + 20
})

// Process data for heatmap
const heatmapData = computed(() => {
  const testRuns = props.data || testRunsStore.state.data
  if (!testRuns || testRuns.length === 0) {
    return { cells: [], xLabels: [], yLabels: [] }
  }

  const cells = processHeatmapData(testRuns, selectedMetric.value)
  const xLabels = [...new Set(cells.map(cell => cell.x))].sort()
  const yLabels = [...new Set(cells.map(cell => cell.y))].sort()

  return { cells, xLabels, yLabels }
})

const heatmapCells = computed(() => heatmapData.value.cells)
const xLabels = computed(() => heatmapData.value.xLabels)
const yLabels = computed(() => heatmapData.value.yLabels)

// Color scale for legend
const legendColors = computed(() => {
  const scale = calculateRelativeColorScale(
    props.data || testRunsStore.state.data,
    selectedMetric.value
  )
  return scale.colors || []
})

// Methods
function getCellX(xValue: string): number {
  const index = xLabels.value.indexOf(xValue)
  return labelWidth + index * cellWidth
}

function getCellY(yValue: string): number {
  const index = yLabels.value.indexOf(yValue)
  return headerHeight + index * cellHeight
}

function formatCellValue(value: number): string {
  if (value >= 1000) {
    return (value / 1000).toFixed(1) + 'K'
  }
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1) + 'M'
  }
  return value.toFixed(0)
}

function isLightColor(color: string): boolean {
  // Simple check for light colors (you might want to use a more sophisticated approach)
  const lightColors = ['#fef3c7', '#fde68a', '#fcd34d', '#fbbf24', '#f59e0b']
  return lightColors.includes(color)
}

function showTooltip(cell: HeatmapCell) {
  const event = window.event as MouseEvent
  const rect = (event.target as SVGElement).getBoundingClientRect()

  tooltip.value = {
    visible: true,
    x: event.clientX - rect.left + 10,
    y: event.clientY - rect.top - 10,
    content: `${cell.x} - ${cell.y}`,
    subContent: `${selectedMetric.value.toUpperCase()}: ${formatMetricValue(cell.value)}`,
  }
}

function hideTooltip() {
  tooltip.value.visible = false
}

function onCellClick(cell: HeatmapCell) {
  // Emit click event for parent component
  console.log('Cell clicked:', cell)
}

function formatMetricValue(value: number): string {
  switch (selectedMetric.value) {
    case 'iops':
      return formatIOPS(value)
    case 'bandwidth':
      return formatBandwidth(value)
    case 'latency':
      return formatLatency(value)
    default:
      return value.toString()
  }
}

// Watch for data changes
watch([selectedMetric, colorScale], () => {
  // Recompute heatmap when settings change
})
</script>

<style scoped>
/* Additional styles if needed */
</style>
