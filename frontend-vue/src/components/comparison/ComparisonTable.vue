<template>
  <div class="space-y-6">
    <!-- Comparison Table -->
    <div class="overflow-x-auto">
      <table class="min-w-full border-collapse bg-white">
        <thead>
          <tr class="bg-gray-100">
            <th class="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-700">
              Metric
            </th>
            <th
              v-for="host in selectedHosts"
              :key="host"
              class="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-700"
            >
              {{ host }}
            </th>
          </tr>
        </thead>
        <tbody>
          <!-- Performance Metrics Section -->
          <tr class="bg-blue-50">
            <td colspan="100" class="border border-gray-300 px-4 py-2 font-semibold text-gray-800">
              Performance Metrics
            </td>
          </tr>
          <tr v-for="metric in performanceMetrics" :key="metric.key">
            <td class="border border-gray-300 px-4 py-3 font-medium text-gray-700">
              {{ metric.label }}
            </td>
            <td
              v-for="host in selectedHosts"
              :key="`${metric.key}-${host}`"
              class="border border-gray-300 px-4 py-3 text-center"
              :class="getCellClass(metric.key, host)"
            >
              {{ formatMetricValue(metric.key, host) }}
            </td>
          </tr>

          <!-- System Info Section -->
          <tr class="bg-green-50">
            <td colspan="100" class="border border-gray-300 px-4 py-2 font-semibold text-gray-800">
              System Information
            </td>
          </tr>
          <tr v-for="info in systemInfo" :key="info.key">
            <td class="border border-gray-300 px-4 py-3 font-medium text-gray-700">
              {{ info.label }}
            </td>
            <td
              v-for="host in selectedHosts"
              :key="`${info.key}-${host}`"
              class="border border-gray-300 px-4 py-3 text-center text-sm"
            >
              {{ formatInfoValue(info.key, host) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Visual Comparison Chart -->
    <div class="card" v-if="selectedHosts.length > 0">
      <h3 class="text-lg font-semibold mb-4">Visual Comparison</h3>
      <BarChart
        :data="chartData"
        :height="'300px'"
        y-axis-label="Value"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TestRun, MetricType } from '../../types/testRun'
import { useChartData } from '../../composables/useChartData'
import BarChart from '../charts/BarChart.vue'

interface Props {
  testRuns: Map<string, TestRun> // hostname -> test run
  selectedHosts: string[]
}

const props = defineProps<Props>()

const { formatMetric, getMetricLabel, createMultiMetricGroupedData } = useChartData()

const performanceMetrics = [
  { key: 'iops' as MetricType, label: 'IOPS' },
  { key: 'avg_latency' as MetricType, label: 'Average Latency (ms)' },
  { key: 'bandwidth' as MetricType, label: 'Bandwidth (MB/s)' },
  { key: 'p95_latency' as MetricType, label: 'P95 Latency (ms)' },
  { key: 'p99_latency' as MetricType, label: 'P99 Latency (ms)' }
]

const systemInfo = [
  { key: 'drive_model', label: 'Drive Model' },
  { key: 'drive_type', label: 'Drive Type' },
  { key: 'protocol', label: 'Protocol' },
  { key: 'test_date', label: 'Test Date' },
  { key: 'description', label: 'Description' }
]

// Format metric value
function formatMetricValue(metric: MetricType, host: string): string {
  const run = props.testRuns.get(host)
  if (!run || run[metric] === null) return '-'

  return formatMetric(run[metric]!, metric)
}

// Format info value
function formatInfoValue(key: string, host: string): string {
  const run = props.testRuns.get(host)
  if (!run) return '-'

  const value = run[key as keyof TestRun]
  if (value === null || value === undefined) return '-'

  return String(value)
}

// Get cell class for highlighting best/worst
function getCellClass(metric: MetricType, host: string): string {
  const run = props.testRuns.get(host)
  if (!run || run[metric] === null) return ''

  const values = props.selectedHosts
    .map((h) => props.testRuns.get(h)?.[metric])
    .filter((v): v is number => v !== null && v !== undefined)

  if (values.length === 0) return ''

  const currentValue = run[metric]!

  // For latency metrics, lower is better
  const isLatency = metric.includes('latency')
  const best = isLatency ? Math.min(...values) : Math.max(...values)
  const worst = isLatency ? Math.max(...values) : Math.min(...values)

  if (currentValue === best && values.length > 1) {
    return 'bg-green-100 font-semibold text-green-800'
  } else if (currentValue === worst && values.length > 1) {
    return 'bg-red-100 font-semibold text-red-800'
  }

  return ''
}

// Chart data for visual comparison
const chartData = computed(() => {
  const runs = props.selectedHosts
    .map((host) => props.testRuns.get(host))
    .filter((run): run is TestRun => run !== undefined)

  if (runs.length === 0) {
    return { labels: [], datasets: [] }
  }

  return createMultiMetricGroupedData(
    runs,
    ['iops', 'bandwidth'] // Show main metrics only
  )
})
</script>
