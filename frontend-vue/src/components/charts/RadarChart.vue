<template>
  <div class="space-y-4">
    <!-- Controls -->
    <div class="flex flex-wrap items-center gap-4">
      <!-- Hosts to compare -->
      <div class="flex items-center space-x-2">
        <label class="text-sm font-medium text-gray-700 dark:text-white">
          Compare Hosts:
        </label>
        <select
          v-model="selectedHosts"
          multiple
          class="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          :size="3"
        >
          <option
            v-for="host in availableHosts"
            :key="host"
            :value="host"
          >
            {{ host }}
          </option>
        </select>
      </div>

      <!-- Metrics to display -->
      <div class="flex items-center space-x-2">
        <label class="text-sm font-medium text-gray-700 dark:text-white">
          Metrics:
        </label>
        <div class="flex space-x-2">
          <label
            v-for="metric in availableMetrics"
            :key="metric.key"
            class="flex items-center space-x-2"
          >
            <input
              v-model="selectedMetrics"
              :value="metric.key"
              type="checkbox"
              class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span class="text-sm text-gray-700 dark:text-gray-300">
              {{ metric.label }}
            </span>
          </label>
        </div>
      </div>
    </div>

    <!-- Chart area -->
    <div class="relative bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
      <svg
        :width="chartWidth"
        :height="chartHeight"
        class="w-full h-full"
        viewBox="0 0 400 400"
      >
        <!-- Radar grid -->
        <g class="radar-grid">
          <!-- Grid circles -->
          <circle
            v-for="level in gridLevels"
            :key="level"
            :cx="centerX"
            :cy="centerY"
            :r="level * maxRadius / gridLevels"
            fill="none"
            stroke="#e5e7eb"
            stroke-width="1"
            class="dark:stroke-gray-600"
            opacity="0.5"
          />

          <!-- Grid lines -->
          <line
            v-for="i in selectedMetrics.length"
            :key="i"
            :x1="centerX"
            :y1="centerY"
            :x2="centerX + maxRadius * Math.cos((i - 1) * 2 * Math.PI / selectedMetrics.length)"
            :y2="centerY + maxRadius * Math.sin((i - 1) * 2 * Math.PI / selectedMetrics.length)"
            stroke="#e5e7eb"
            stroke-width="1"
            class="dark:stroke-gray-600"
            opacity="0.5"
          />
        </g>

        <!-- Data polygons -->
        <g class="data-polygons">
          <polygon
            v-for="(radarHostData, index) in radarData"
            :key="radarHostData.host"
            :points="getPolygonPoints(radarHostData.values)"
            :fill="getHostColor(index)"
            :stroke="getHostColor(index)"
            stroke-width="2"
            opacity="0.3"
            class="hover:opacity-0.6 transition-opacity cursor-pointer"
            @mouseover="showTooltip(radarHostData, $event)"
            @mouseout="hideTooltip"
          />
        </g>

        <!-- Data lines -->
        <g class="data-lines">
          <polyline
            v-for="(lineHostData, index) in radarData"
            :key="`line-${lineHostData.host}`"
            :points="getPolygonPoints(lineHostData.values)"
            :stroke="getHostColor(index)"
            stroke-width="2"
            fill="none"
          />
        </g>

        <!-- Data points -->
        <g class="data-points">
          <circle
            v-for="point in allPoints"
            :key="`point-${point.host}-${point.metricIndex}`"
            :cx="point.x"
            :cy="point.y"
            r="4"
            :fill="point.color"
            :stroke="point.stroke"
            stroke-width="2"
            class="cursor-pointer hover:r-6 transition-all"
            @mouseover="showPointTooltip(point, $event)"
            @mouseout="hideTooltip"
          />
        </g>

        <!-- Axis labels -->
        <g class="axis-labels">
          <text
            v-for="(metric, index) in selectedMetrics"
            :key="metric"
            :x="centerX + (maxRadius + 20) * Math.cos((index) * 2 * Math.PI / selectedMetrics.length)"
            :y="centerY + (maxRadius + 20) * Math.sin((index) * 2 * Math.PI / selectedMetrics.length)"
            text-anchor="middle"
            dominant-baseline="middle"
            class="text-sm fill-gray-700 dark:fill-gray-300 font-medium"
          >
            {{ getMetricLabel(metric) }}
          </text>
        </g>

        <!-- Scale labels -->
        <g class="scale-labels">
          <text
            v-for="level in gridLevels"
            :key="level"
            :x="centerX - maxRadius - 10"
            :y="centerY - (level * maxRadius / gridLevels) + 5"
            text-anchor="end"
            class="text-xs fill-gray-500 dark:fill-gray-400"
          >
            {{ (level / gridLevels * 100).toFixed(0) }}%
          </text>
        </g>
      </svg>

      <!-- Tooltip -->
      <div
        v-if="tooltip.visible"
        class="absolute z-10 bg-gray-900 text-white px-3 py-2 rounded-md text-sm shadow-lg pointer-events-none max-w-xs"
        :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
      >
        <div class="font-medium">{{ tooltip.title }}</div>
        <div class="text-xs text-gray-300 mt-1">
          <div
            v-for="metric in tooltip.metrics"
            :key="metric.key"
          >
            {{ metric.label }}: {{ formatValue(metric.value, metric.key) }}
          </div>
        </div>
      </div>

      <!-- Legend -->
      <div class="absolute top-4 right-4 bg-white dark:bg-gray-800 p-3 rounded-md shadow-lg border border-gray-200 dark:border-gray-700">
        <div class="text-sm font-medium text-gray-900 dark:text-white mb-2">
          Hosts
        </div>
        <div class="space-y-1">
          <div
            v-for="(legendHostData, index) in radarData"
            :key="legendHostData.host"
            class="flex items-center space-x-2"
          >
            <div
              class="w-3 h-3 rounded-full"
              :style="{ backgroundColor: getHostColor(index) }"
            />
            <span class="text-xs text-gray-700 dark:text-gray-300">
              {{ legendHostData.host }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Summary statistics -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
        <div class="text-sm text-gray-600 dark:text-gray-400">Hosts Compared</div>
        <div class="text-2xl font-bold text-gray-900 dark:text-white">{{ selectedHosts.length }}</div>
      </div>

      <div class="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
        <div class="text-sm text-gray-600 dark:text-gray-400">Metrics Displayed</div>
        <div class="text-2xl font-bold text-gray-900 dark:text-white">{{ selectedMetrics.length }}</div>
      </div>

      <div class="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
        <div class="text-sm text-gray-600 dark:text-gray-400">Best Performer</div>
        <div class="text-lg font-bold text-gray-900 dark:text-white">
          {{ bestPerformer || 'N/A' }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useTestRunsStore } from '@/stores/testRuns'
import { aggregateMetrics } from '@/utils/chartProcessing'
import { formatIOPS, formatLatency, formatBandwidth } from '@/utils/formatters'

interface RadarData {
  host: string
  values: number[]
}

interface Tooltip {
  visible: boolean
  x: number
  y: number
  title: string
  metrics: Array<{ key: string; label: string; value: number }>
}

interface RadarChartData {
  host: string
  values: number[]
}

interface RadarPoint {
  host: string
  metricIndex: number
}

const props = defineProps<{
  data?: RadarChartData[]
}>()

const testRunsStore = useTestRunsStore()

const selectedHosts = ref<string[]>([])
const selectedMetrics = ref<string[]>(['iops', 'bandwidth', 'avg_latency'])
const tooltip = ref<Tooltip>({
  visible: false,
  x: 0,
  y: 0,
  title: '',
  metrics: [],
})

const chartWidth = 400
const chartHeight = 400
const centerX = chartWidth / 2
const centerY = chartHeight / 2
const maxRadius = 120
const gridLevels = 5

// Available options
const availableHosts = computed(() => {
  const hosts = [...new Set(testRuns.value.map(r => r.hostname))]
  return hosts.slice(0, 5) // Limit to 5 hosts for readability
})

const availableMetrics = [
  { key: 'iops', label: 'IOPS' },
  { key: 'bandwidth', label: 'Bandwidth' },
  { key: 'avg_latency', label: 'Avg Latency' },
  { key: 'p95_latency', label: 'P95 Latency' },
  { key: 'p99_latency', label: 'P99 Latency' },
]

const testRuns = computed(() => props.data || testRunsStore.state.data)

// Initialize with first few hosts if none selected
watch(availableHosts, (newHosts) => {
  if (newHosts.length > 0 && selectedHosts.value.length === 0) {
    selectedHosts.value = newHosts.slice(0, 3) // Select first 3 hosts by default
  }
}, { immediate: true })

const hostData = computed(() => {
  const grouped: Record<string, TestRun[]> = {}

  testRuns.value.forEach(run => {
    if (!grouped[run.hostname]) {
      grouped[run.hostname] = []
    }
    grouped[run.hostname].push(run)
  })

  return Object.entries(grouped).map(([host, runs]) => ({
    host,
    runs,
    metrics: aggregateMetrics(runs, selectedMetrics.value),
  }))
})

const radarData = computed((): RadarData[] => {
  return selectedHosts.value.map(host => {
    const hostInfo = hostData.value.find(h => h.host === host)
    if (!hostInfo) return { host, values: [] }

    const values = selectedMetrics.value.map(metric => {
      const metricData = hostInfo.metrics[metric]
      if (!metricData) return 0

      // Normalize values to 0-1 scale
      return Math.min(metricData.avg / getMaxValue(metric), 1)
    })

    return { host, values }
  })
})

const allPoints = computed(() => {
  const points: Array<{
    x: number
    y: number
    host: string
    metricIndex: number
    color: string
    stroke: string
  }> = []

  radarData.value.forEach((hostData, hostIndex) => {
    hostData.values.forEach((value, metricIndex) => {
      const angle = (metricIndex * 2 * Math.PI) / selectedMetrics.value.length
      const radius = value * maxRadius
      const x = centerX + radius * Math.cos(angle - Math.PI / 2)
      const y = centerY + radius * Math.sin(angle - Math.PI / 2)

      points.push({
        x,
        y,
        host: hostData.host,
        metricIndex,
        color: getHostColor(hostIndex),
        stroke: '#ffffff',
      })
    })
  })

  return points
})

const bestPerformer = computed(() => {
  if (radarData.value.length === 0) return null

  let bestHost = ''
  let bestScore = 0

  radarData.value.forEach(hostData => {
    const score = hostData.values.reduce((sum, val) => sum + val, 0) / hostData.values.length
    if (score > bestScore) {
      bestScore = score
      bestHost = hostData.host
    }
  })

  return bestHost
})

// Methods
function getPolygonPoints(values: number[]): string {
  return values.map((value, index) => {
    const angle = (index * 2 * Math.PI) / values.length
    const radius = value * maxRadius
    const x = centerX + radius * Math.cos(angle - Math.PI / 2)
    const y = centerY + radius * Math.sin(angle - Math.PI / 2)
    return `${x},${y}`
  }).join(' ')
}

function getHostColor(index: number): string {
  const colors = [
    '#3b82f6', // blue
    '#ef4444', // red
    '#10b981', // green
    '#f59e0b', // yellow
    '#8b5cf6', // purple
  ]
  return colors[index % colors.length]
}

function getMaxValue(metric: string): number {
  // Calculate max values for normalization
  const values = hostData.value.map(h => h.metrics[metric]?.avg || 0)
  return Math.max(...values, 1)
}

function getMetricLabel(metric: string): string {
  const metricMap: Record<string, string> = {
    iops: 'IOPS',
    bandwidth: 'BW',
    avg_latency: 'Avg Lat',
    p95_latency: 'P95 Lat',
    p99_latency: 'P99 Lat',
  }
  return metricMap[metric] || metric
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

function showTooltip(hostData: RadarData, event: MouseEvent) {
  const metrics = selectedMetrics.value.map((metric) => {
    const hostInfo = hostData.value.find(h => h.host === hostData.host)
    const rawValue = hostInfo?.metrics[metric]?.avg || 0

    return {
      key: metric,
      label: getMetricLabel(metric),
      value: rawValue,
    }
  })

  tooltip.value = {
    visible: true,
    x: event.offsetX + 10,
    y: event.offsetY - 10,
    title: hostData.host,
    metrics,
  }
}

function showPointTooltip(point: RadarPoint, event: MouseEvent) {
  const hostInfo = hostData.value.find(h => h.host === point.host)
  const metric = selectedMetrics.value[point.metricIndex]
  const rawValue = hostInfo?.metrics[metric]?.avg || 0

  tooltip.value = {
    visible: true,
    x: event.offsetX + 10,
    y: event.offsetY - 10,
    title: `${point.host} - ${getMetricLabel(metric)}`,
    metrics: [{
      key: metric,
      label: getMetricLabel(metric),
      value: rawValue,
    }],
  }
}

function hideTooltip() {
  tooltip.value.visible = false
}
</script>

<style scoped>
/* Additional styles if needed */
</style>
