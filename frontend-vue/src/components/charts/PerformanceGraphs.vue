<template>
  <div class="space-y-6">
    <!-- Chart controls -->
    <div class="flex flex-wrap items-center gap-4">
      <!-- Chart type selector -->
      <div class="flex items-center space-x-2">
        <label class="text-sm font-medium text-gray-700 dark:text-white">
          Chart Type:
        </label>
        <select
          v-model="chartType"
          class="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="line">Line Chart</option>
          <option value="bar">Bar Chart</option>
          <option value="scatter">Scatter Plot</option>
          <option value="radar">Radar Chart</option>
        </select>
      </div>

      <!-- X-axis selector -->
      <div class="flex items-center space-x-2">
        <label class="text-sm font-medium text-gray-700 dark:text-white">
          X-Axis:
        </label>
        <select
          v-model="xAxis"
          class="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="block_size">Block Size</option>
          <option value="queue_depth">Queue Depth</option>
          <option value="num_jobs">Job Count</option>
          <option value="hostname">Host</option>
          <option value="drive_model">Drive Model</option>
        </select>
      </div>

      <!-- Y-axis selector -->
      <div class="flex items-center space-x-2">
        <label class="text-sm font-medium text-gray-700 dark:text-white">
          Y-Axis:
        </label>
        <select
          v-model="yAxis"
          class="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="iops">IOPS</option>
          <option value="bandwidth">Bandwidth</option>
          <option value="avg_latency">Average Latency</option>
          <option value="p95_latency">P95 Latency</option>
          <option value="p99_latency">P99 Latency</option>
        </select>
      </div>

      <!-- Group by selector -->
      <div
        v-if="chartType === 'line' || chartType === 'bar'"
        class="flex items-center space-x-2"
      >
        <label class="text-sm font-medium text-gray-700 dark:text-white">
          Group by:
        </label>
        <select
          v-model="groupBy"
          class="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">None</option>
          <option value="hostname">Host</option>
          <option value="drive_model">Drive Model</option>
          <option value="drive_type">Drive Type</option>
          <option value="protocol">Protocol</option>
        </select>
      </div>
    </div>

    <!-- Chart display area -->
    <div class="relative bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
      <!-- Line Chart -->
      <div
        v-if="chartType === 'line'"
        class="w-full"
        style="height: 400px;"
      >
        <LineChart
          :data="lineChartData"
          :options="lineChartOptions"
          class="w-full h-full"
        />
      </div>

      <!-- Bar Chart -->
      <div
        v-else-if="chartType === 'bar'"
        class="w-full"
        style="height: 400px;"
      >
        <BarChart
          :data="barChartData"
          :options="barChartOptions"
          class="w-full h-full"
        />
      </div>

      <!-- Scatter Plot -->
      <div
        v-else-if="chartType === 'scatter'"
        class="w-full"
        style="height: 400px;"
      >
        <ScatterChart
          :data="scatterChartData"
          :options="scatterChartOptions"
          class="w-full h-full"
        />
      </div>

      <!-- Radar Chart -->
      <div
        v-else-if="chartType === 'radar'"
        class="w-full"
        style="height: 400px;"
      >
        <RadarChart
          :data="radarChartData"
          :options="radarChartOptions"
          class="w-full h-full"
        />
      </div>

      <!-- No data state -->
      <div
        v-if="!processedData || processedData.length === 0"
        class="flex items-center justify-center py-12"
      >
        <div class="text-center">
          <BarChart3Icon class="mx-auto h-12 w-12 text-gray-400" />
          <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">
            No data available
          </h3>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Try adjusting your filters or chart settings.
          </p>
        </div>
      </div>
    </div>

    <!-- Chart statistics -->
    <div
      v-if="processedData && processedData.length > 0"
      class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm"
    >
      <div class="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
        <div class="text-gray-600 dark:text-gray-400">Data Points</div>
        <div class="text-lg font-semibold text-gray-900 dark:text-white">{{ processedData.length }}</div>
      </div>

      <div class="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
        <div class="text-gray-600 dark:text-gray-400">Avg {{ yAxisLabel }}</div>
        <div class="text-lg font-semibold text-gray-900 dark:text-white">{{ formatValue(chartStats.avg) }}</div>
      </div>

      <div class="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
        <div class="text-gray-600 dark:text-gray-400">Max {{ yAxisLabel }}</div>
        <div class="text-lg font-semibold text-gray-900 dark:text-white">{{ formatValue(chartStats.max) }}</div>
      </div>

      <div class="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
        <div class="text-gray-600 dark:text-gray-400">Min {{ yAxisLabel }}</div>
        <div class="text-lg font-semibold text-gray-900 dark:text-white">{{ formatValue(chartStats.min) }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useTestRunsStore } from '@/stores/testRuns'
import { processLineChartData, processScatterData, aggregateMetrics } from '@/utils/chartProcessing'
import { formatIOPS, formatLatency, formatBandwidth } from '@/utils/formatters'

// Mock chart components - in real implementation, these would be from Chart.js or similar
const LineChart = {
  props: ['data', 'options'],
  template: '<div class="w-full h-full bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center text-gray-500">Line Chart Placeholder</div>'
}

const BarChart = {
  props: ['data', 'options'],
  template: '<div class="w-full h-full bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center text-gray-500">Bar Chart Placeholder</div>'
}

const ScatterChart = {
  props: ['data', 'options'],
  template: '<div class="w-full h-full bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center text-gray-500">Scatter Chart Placeholder</div>'
}

const RadarChart = {
  props: ['data', 'options'],
  template: '<div class="w-full h-full bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center text-gray-500">Radar Chart Placeholder</div>'
}

interface TestRun {
  id: number
  hostname: string
  drive_model: string
  block_size: string
  read_write_pattern: string
  iops: number
  bandwidth: number
  avg_latency: number
  p95_latency?: number
  p99_latency?: number
}

const props = defineProps<{
  data?: TestRun[]
}>()

const testRunsStore = useTestRunsStore()

// Reactive state
const chartType = ref<'line' | 'bar' | 'scatter' | 'radar'>('line')
const xAxis = ref<'block_size' | 'queue_depth' | 'num_jobs' | 'hostname' | 'drive_model'>('block_size')
const yAxis = ref<'iops' | 'bandwidth' | 'avg_latency' | 'p95_latency' | 'p99_latency'>('iops')
const groupBy = ref<string>('')

// Computed properties
const testRuns = computed(() => props.data || testRunsStore.state.data)

const processedData = computed(() => {
  if (!testRuns.value || testRuns.value.length === 0) return []

  switch (chartType.value) {
    case 'line':
    case 'bar':
      return processLineChartData(testRuns.value, xAxis.value, yAxis.value, groupBy.value || undefined)
    case 'scatter':
      return processScatterData(testRuns.value, 'avg_latency', yAxis.value)
    case 'radar':
      // For radar charts, we'll aggregate by hostname and show multiple metrics
      return processRadarData(testRuns.value)
    default:
      return []
  }
})

const chartStats = computed(() => {
  if (!processedData.value || processedData.value.length === 0) {
    return { avg: 0, min: 0, max: 0 }
  }

  const values = processedData.value.map(d => d.y).filter(v => v !== undefined && v !== null)
  if (values.length === 0) return { avg: 0, min: 0, max: 0 }

  return {
    avg: values.reduce((a, b) => a + b, 0) / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
  }
})

const yAxisLabel = computed(() => {
  switch (yAxis.value) {
    case 'iops': return 'IOPS'
    case 'bandwidth': return 'Bandwidth'
    case 'avg_latency': return 'Latency'
    case 'p95_latency': return 'P95 Latency'
    case 'p99_latency': return 'P99 Latency'
    default: return 'Value'
  }
})

// Chart data and options
const lineChartData = computed(() => ({
  labels: processedData.value.map(d => d.x),
  datasets: [{
    label: yAxisLabel.value,
    data: processedData.value.map(d => d.y),
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    tension: 0.1,
  }],
}))

const lineChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    y: {
      beginAtZero: true,
      title: {
        display: true,
        text: yAxisLabel.value,
      },
    },
    x: {
      title: {
        display: true,
        text: xAxis.value.replace('_', ' ').toUpperCase(),
      },
    },
  },
}))

const barChartData = computed(() => ({
  labels: processedData.value.map(d => d.x),
  datasets: [{
    label: yAxisLabel.value,
    data: processedData.value.map(d => d.y),
    backgroundColor: '#3b82f6',
    borderColor: '#2563eb',
    borderWidth: 1,
  }],
}))

const barChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    y: {
      beginAtZero: true,
      title: {
        display: true,
        text: yAxisLabel.value,
      },
    },
  },
}))

const scatterChartData = computed(() => ({
  datasets: [{
    label: 'Performance Data',
    data: processedData.value.map(d => ({ x: d.x, y: d.y })),
    backgroundColor: '#3b82f6',
    borderColor: '#2563eb',
  }],
}))

const scatterChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    x: {
      title: {
        display: true,
        text: 'Latency (ms)',
      },
    },
    y: {
      title: {
        display: true,
        text: yAxisLabel.value,
      },
    },
  },
}))

const radarChartData = computed(() => ({
  labels: ['IOPS', 'Bandwidth', 'Latency', 'P95 Latency', 'P99 Latency'],
  datasets: processedData.value.slice(0, 5).map((hostData, index) => ({
    label: `Host ${index + 1}`,
    data: [
      hostData.iops || 0,
      hostData.bandwidth || 0,
      hostData.avg_latency || 0,
      hostData.p95_latency || 0,
      hostData.p99_latency || 0,
    ],
    backgroundColor: `rgba(${59 + index * 20}, ${130 + index * 10}, ${246 + index * 5}, 0.2)`,
    borderColor: `rgb(${59 + index * 20}, ${130 + index * 10}, ${246 + index * 5})`,
  })),
}))

const radarChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
}))

// Methods
function processRadarData(testRuns: TestRun[]) {
  // Group by hostname and aggregate metrics
  const hostGroups: Record<string, TestRun[]> = {}
  testRuns.forEach(run => {
    if (!hostGroups[run.hostname]) {
      hostGroups[run.hostname] = []
    }
    hostGroups[run.hostname].push(run)
  })

  return Object.entries(hostGroups).map(([hostname, runs]) => {
    const metrics = aggregateMetrics(runs, ['iops', 'bandwidth', 'avg_latency', 'p95_latency', 'p99_latency'])
    return {
      hostname,
      ...metrics,
    }
  })
}

function formatValue(value: number): string {
  switch (yAxis.value) {
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

// Watch for changes and update charts
watch([chartType, xAxis, yAxis, groupBy], () => {
  // Charts will automatically update due to computed properties
})
</script>

<style scoped>
/* Additional styles if needed */
</style>
