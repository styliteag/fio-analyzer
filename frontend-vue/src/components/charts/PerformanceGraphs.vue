<template>
  <div class="space-y-6">
    <!-- Host Comparison Controls -->
    <div class="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
      <div class="flex flex-wrap items-center gap-4">
        <!-- View Type Selector -->
        <div class="flex items-center space-x-2">
          <label class="text-sm font-medium text-gray-700 dark:text-white">
            View:
          </label>
          <select
            v-model="activeView"
            class="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="rankings">Performance Rankings</option>
            <option value="comparison">Host Comparison</option>
            <option value="configurations">Configuration Impact</option>
            <option value="workloads">Workload Analysis</option>
          </select>
        </div>

        <!-- Primary Metric -->
        <div class="flex items-center space-x-2">
          <label class="text-sm font-medium text-gray-700 dark:text-white">
            Primary Metric:
          </label>
          <select
            v-model="primaryMetric"
            class="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="iops">IOPS</option>
            <option value="bandwidth">Bandwidth</option>
            <option value="avg_latency">Latency</option>
          </select>
        </div>

        <!-- Host-Protocol-Disk Selection (for comparison view) -->
        <div v-if="activeView === 'comparison'" class="flex items-center space-x-2">
          <label class="text-sm font-medium text-gray-700 dark:text-white">
            Compare Host-Protocol-Disk:
          </label>
          <div class="flex space-x-2">
            <select
              v-model="selectedCombination1"
              class="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select Combination 1</option>
              <option v-for="combo in availableCombinations" :key="combo" :value="combo">{{ combo }}</option>
            </select>
            <span class="text-gray-500 dark:text-gray-400 self-center">vs</span>
            <select
              v-model="selectedCombination2"
              class="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select Combination 2</option>
              <option v-for="combo in availableCombinations" :key="combo" :value="combo">{{ combo }}</option>
            </select>
          </div>
        </div>

        <!-- Host-Protocol-Disk Filter -->
        <div class="flex items-center space-x-2">
          <label class="text-sm font-medium text-gray-700 dark:text-white">
            Filter Combinations:
          </label>
          <select
            v-model="selectedCombinationFilter"
            class="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            @change="updateCombinationFilter"
          >
            <option value="">All Combinations</option>
            <option v-for="combo in availableCombinations" :key="combo" :value="combo">{{ combo }}</option>
          </select>
        </div>

        <!-- Workload Filter (for workloads view) -->
        <div v-if="activeView === 'workloads'" class="flex items-center space-x-2">
          <label class="text-sm font-medium text-gray-700 dark:text-white">
            Workload:
          </label>
          <select
            v-model="workloadFilter"
            class="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Workloads</option>
            <option value="read">Read Heavy</option>
            <option value="write">Write Heavy</option>
            <option value="mixed">Mixed</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Host Comparison Views -->
    <div class="space-y-6">
      <!-- Performance Rankings View -->
      <div v-if="activeView === 'rankings'" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Host Performance Rankings
          </h3>
          <div style="height: 400px;">
            <Bar :data="rankingsChartData" :options="rankingsChartOptions" />
          </div>
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Performance Distribution
          </h3>
          <div style="height: 400px;">
            <Bar :data="distributionChartData" :options="distributionChartOptions" />
          </div>
        </div>
      </div>

      <!-- Host Comparison View -->
      <div v-if="activeView === 'comparison'" class="space-y-6">
        <div v-if="!selectedCombination1 || !selectedCombination2" class="bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
          <div class="flex">
            <div class="flex-shrink-0">
              <svg class="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
            </div>
            <div class="ml-3">
              <p class="text-sm text-yellow-800 dark:text-yellow-200">
                Please select two Host-Protocol-Disk combinations to compare their performance.
              </p>
            </div>
          </div>
        </div>

        <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">
              {{ selectedCombination1 }} vs {{ selectedCombination2 }}
            </h3>
            <div style="height: 400px;">
              <Bar :data="comparisonChartData" :options="comparisonChartOptions" />
            </div>
          </div>

          <div class="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Performance Difference
            </h3>
            <div class="space-y-4">
              <div v-for="metric in performanceComparison" :key="metric.name" class="flex justify-between items-center">
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ metric.name }}</span>
                <div class="flex items-center space-x-2">
                  <span :class="`text-sm font-semibold ${metric.difference > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`">
                    {{ metric.difference > 0 ? '+' : '' }}{{ metric.difference.toFixed(1) }}%
                  </span>
                  <span class="text-xs text-gray-500 dark:text-gray-400">
                    ({{ selectedCombination1 }}: {{ metric.combo1 }}, {{ selectedCombination2 }}: {{ metric.combo2 }})
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Configuration Impact View -->
      <div v-if="activeView === 'configurations'" class="space-y-6">
        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Configuration Impact by Host
          </h3>
          <div style="height: 400px;">
            <Line :data="configImpactChartData" :options="configImpactChartOptions" />
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div v-for="combo in combinationConfigInsights" :key="combo.name" class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <h4 class="font-medium text-gray-900 dark:text-white mb-2">{{ combo.name }}</h4>
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-600 dark:text-gray-400">Best Block Size:</span>
                <span class="font-medium text-gray-900 dark:text-white">{{ combo.bestBlockSize }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600 dark:text-gray-400">Best Pattern:</span>
                <span class="font-medium text-gray-900 dark:text-white">{{ combo.bestPattern }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600 dark:text-gray-400">Performance Range:</span>
                <span class="font-medium text-gray-900 dark:text-white">{{ combo.performanceRange }}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Workload Analysis View -->
      <div v-if="activeView === 'workloads'" class="space-y-6">
        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Workload Performance by Host
          </h3>
          <div style="height: 400px;">
            <Bar :data="workloadChartData" :options="workloadChartOptions" />
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Read vs Write Performance
            </h3>
            <div class="space-y-4">
              <div v-for="combo in workloadInsights" :key="combo.name" class="space-y-2">
                <h4 class="font-medium text-gray-900 dark:text-white">{{ combo.name }}</h4>
                <div class="flex justify-between text-sm">
                  <span class="text-gray-600 dark:text-gray-400">Read Performance:</span>
                  <span class="font-medium text-green-600 dark:text-green-400">{{ combo.readPerf }}</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-gray-600 dark:text-gray-400">Write Performance:</span>
                  <span class="font-medium text-blue-600 dark:text-blue-400">{{ combo.writePerf }}</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-gray-600 dark:text-gray-400">Read/Write Ratio:</span>
                  <span class="font-medium text-purple-600 dark:text-purple-400">{{ combo.ratio }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Workload Recommendations
            </h3>
            <div class="space-y-3">
              <div v-for="rec in workloadRecommendations" :key="rec.combo" class="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <h4 class="font-medium text-gray-900 dark:text-white">{{ rec.combo }}</h4>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">{{ rec.recommendation }}</p>
                <div class="flex flex-wrap gap-1 mt-2">
                  <span v-for="tag in rec.tags" :key="tag" class="px-2 py-1 text-xs rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                    {{ tag }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- No data state -->
      <div
        v-if="!testRuns || testRuns.length === 0"
        class="flex items-center justify-center py-12"
      >
        <div class="text-center">
          <BarChart3 class="mx-auto h-12 w-12 text-gray-400" />
          <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">
            No performance data available
          </h3>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Run some performance tests to see host comparisons.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTestRunsStore } from '@/stores/testRuns'
import { aggregateMetrics } from '@/utils/chartProcessing'
import { formatIOPS, formatLatency, formatBandwidth } from '@/utils/formatters'
import { BarChart3 } from 'lucide-vue-next'
import { Line, Bar } from 'vue-chartjs'
import type { TestRun } from '@/types/testRun'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
)

const props = defineProps<{
  data?: readonly TestRun[]
  title?: string
  subtitle?: string
}>()

const testRunsStore = useTestRunsStore()

// Reactive state for new host comparison views
const activeView = ref<'rankings' | 'comparison' | 'configurations' | 'workloads'>('rankings')
const primaryMetric = ref<'iops' | 'bandwidth' | 'avg_latency'>('iops')
const selectedCombination1 = ref('')
const selectedCombination2 = ref('')
const selectedCombinationFilter = ref('')
const workloadFilter = ref<'all' | 'read' | 'write' | 'mixed'>('all')

// Computed properties
const testRuns = computed(() => {
  const runs = props.data || testRunsStore.state.data
  if (!selectedCombinationFilter.value) return runs
  
  return runs.filter(run => {
    const combination = `${run.hostname} - ${run.protocol} - ${run.drive_model}`
    return combination === selectedCombinationFilter.value
  })
})

const availableCombinations = computed(() => {
  if (!testRuns.value) return []
  const combinations = new Set(
    testRuns.value.map(run => `${run.hostname} - ${run.protocol} - ${run.drive_model}`)
  )
  return Array.from(combinations).sort()
})

const combinationPerformanceData = computed(() => {
  if (!testRuns.value || testRuns.value.length === 0) return {}

  // Group by Host-Protocol-Disk combination instead of just hostname
  const combinationGroups: Record<string, TestRun[]> = {}
  
  testRuns.value.forEach(run => {
    const combination = `${run.hostname} - ${run.protocol} - ${run.drive_model}`
    if (!combinationGroups[combination]) {
      combinationGroups[combination] = []
    }
    combinationGroups[combination].push(run)
  })

  const result: Record<string, {
    iops: { avg: number; min: number; max: number }
    bandwidth: { avg: number; min: number; max: number }
    avg_latency: { avg: number; min: number; max: number }
    count: number
  }> = {}

  Object.entries(combinationGroups).forEach(([combination, runs]) => {
    const metrics = aggregateMetrics(runs, ['iops', 'bandwidth', 'avg_latency'])
    result[combination] = {
      iops: metrics.iops,
      bandwidth: metrics.bandwidth,
      avg_latency: metrics.avg_latency,
      count: runs.length
    }
  })

  return result
})

// Rankings View Data
const rankingsChartData = computed(() => {
  const combinations = Object.entries(combinationPerformanceData.value)
    .sort(([, a], [, b]) => b[primaryMetric.value].avg - a[primaryMetric.value].avg)

  return {
    labels: combinations.map(([combination]) => combination),
    datasets: [{
      label: primaryMetricLabel.value,
      data: combinations.map(([, data]) => data[primaryMetric.value].avg),
      backgroundColor: '#3b82f6',
      borderColor: '#2563eb',
      borderWidth: 1,
    }]
  }
})

const rankingsChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    title: {
      display: true,
      text: `Host-Protocol-Disk Rankings by ${primaryMetricLabel.value}`
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      title: { display: true, text: primaryMetricLabel.value }
    }
  }
}))

const distributionChartData = computed(() => {
  const values = Object.values(combinationPerformanceData.value).map(data => data[primaryMetric.value].avg)
  if (values.length === 0) return { labels: [], datasets: [] }

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min
  const bins = 5

  const binSize = range / bins
  const distribution = new Array(bins).fill(0)

  values.forEach(value => {
    const binIndex = Math.min(Math.floor((value - min) / binSize), bins - 1)
    distribution[binIndex]++
  })

  const labels = []
  for (let i = 0; i < bins; i++) {
    const binMin = min + (i * binSize)
    const binMax = min + ((i + 1) * binSize)
    labels.push(`${formatValue(binMin)} - ${formatValue(binMax)}`)
  }

  return {
    labels,
    datasets: [{
      label: 'Number of Hosts',
      data: distribution,
      backgroundColor: '#10b981',
      borderColor: '#059669',
      borderWidth: 1,
    }]
  }
})

const distributionChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    title: {
      display: true,
      text: `${primaryMetricLabel.value} Distribution Across Host-Protocol-Disk Combinations`
    }
  },
  scales: {
    y: { beginAtZero: true, title: { display: true, text: 'Combination Count' } }
  }
}))

// Comparison View Data
const comparisonChartData = computed(() => {
  if (!selectedCombination1.value || !selectedCombination2.value) return { labels: [], datasets: [] }

  const combo1Data = combinationPerformanceData.value[selectedCombination1.value]
  const combo2Data = combinationPerformanceData.value[selectedCombination2.value]

  if (!combo1Data || !combo2Data) return { labels: [], datasets: [] }

  return {
    labels: ['IOPS', 'Bandwidth', 'Latency'],
    datasets: [
      {
        label: selectedCombination1.value,
        data: [combo1Data.iops.avg, combo1Data.bandwidth.avg, combo1Data.avg_latency.avg],
        backgroundColor: '#3b82f6',
        borderColor: '#2563eb',
        borderWidth: 1,
      },
      {
        label: selectedCombination2.value,
        data: [combo2Data.iops.avg, combo2Data.bandwidth.avg, combo2Data.avg_latency.avg],
        backgroundColor: '#ef4444',
        borderColor: '#dc2626',
        borderWidth: 1,
      }
    ]
  }
})

const comparisonChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    title: {
      display: true,
      text: 'Performance Comparison'
    }
  },
  scales: {
    y: { beginAtZero: true }
  }
}))

const performanceComparison = computed(() => {
  if (!selectedCombination1.value || !selectedCombination2.value) return []

  const combo1Data = combinationPerformanceData.value[selectedCombination1.value]
  const combo2Data = combinationPerformanceData.value[selectedCombination2.value]

  if (!combo1Data || !combo2Data) return []

  const calculateDifference = (val1: number, val2: number) => {
    return ((val1 - val2) / val2) * 100
  }

  return [
    {
      name: 'IOPS',
      combo1: formatIOPS(combo1Data.iops.avg),
      combo2: formatIOPS(combo2Data.iops.avg),
      difference: calculateDifference(combo1Data.iops.avg, combo2Data.iops.avg)
    },
    {
      name: 'Bandwidth',
      combo1: formatBandwidth(combo1Data.bandwidth.avg),
      combo2: formatBandwidth(combo2Data.bandwidth.avg),
      difference: calculateDifference(combo1Data.bandwidth.avg, combo2Data.bandwidth.avg)
    },
    {
      name: 'Latency',
      combo1: formatLatency(combo1Data.avg_latency.avg),
      combo2: formatLatency(combo2Data.avg_latency.avg),
      difference: calculateDifference(combo2Data.avg_latency.avg, combo1Data.avg_latency.avg) // Lower is better for latency
    }
  ]
})

// Configuration Impact View Data
const configImpactChartData = computed(() => {
  const configPerformance: Record<string, Record<string, number>> = {}

  testRuns.value?.forEach(run => {
    const configKey = `${run.block_size}-${run.read_write_pattern}`
    const combinationKey = `${run.hostname} - ${run.protocol} - ${run.drive_model}`
    
    if (!configPerformance[configKey]) {
      configPerformance[configKey] = {}
    }
    if (!configPerformance[configKey][combinationKey]) {
      configPerformance[configKey][combinationKey] = 0
    }
    configPerformance[configKey][combinationKey] = Math.max(
      configPerformance[configKey][combinationKey],
      run[primaryMetric.value]
    )
  })

  const labels = Object.keys(configPerformance).sort()
  const datasets = availableCombinations.value.map((combination, index) => ({
    label: combination,
    data: labels.map(config => configPerformance[config][combination] || 0),
    borderColor: colorPalette[index % colorPalette.length],
    backgroundColor: colorPalette[index % colorPalette.length] + '33',
    tension: 0.1,
  }))

  return { labels, datasets }
})

const configImpactChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    title: {
      display: true,
      text: `${primaryMetricLabel.value} by Configuration and Host-Protocol-Disk`
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      title: { display: true, text: primaryMetricLabel.value }
    }
  }
}))

const combinationConfigInsights = computed(() => {
  return availableCombinations.value.map(combination => {
    const combinationRuns = testRuns.value?.filter(run => {
      const runCombination = `${run.hostname} - ${run.protocol} - ${run.drive_model}`
      return runCombination === combination
    }) || []

    // Find best block size
    const blockSizePerformance = combinationRuns.reduce((acc, run) => {
      if (!acc[run.block_size]) acc[run.block_size] = []
      acc[run.block_size].push(run[primaryMetric.value])
      return acc
    }, {} as Record<string, number[]>)

    const bestBlockSize = Object.entries(blockSizePerformance)
      .map(([size, values]) => ({ size, avg: values.reduce((a, b) => a + b, 0) / values.length }))
      .sort((a, b) => b.avg - a.avg)[0]?.size || 'N/A'

    // Find best pattern
    const patternPerformance = combinationRuns.reduce((acc, run) => {
      if (!acc[run.read_write_pattern]) acc[run.read_write_pattern] = []
      acc[run.read_write_pattern].push(run[primaryMetric.value])
      return acc
    }, {} as Record<string, number[]>)

    const bestPattern = Object.entries(patternPerformance)
      .map(([pattern, values]) => ({ pattern, avg: values.reduce((a, b) => a + b, 0) / values.length }))
      .sort((a, b) => b.avg - a.avg)[0]?.pattern || 'N/A'

    // Performance range
    const values = combinationRuns.map(run => run[primaryMetric.value])
    const min = Math.min(...values)
    const max = Math.max(...values)
    const rangePercent = values.length > 1 ? ((max - min) / min) * 100 : 0

    return {
      name: combination,
      bestBlockSize,
      bestPattern,
      performanceRange: rangePercent.toFixed(1)
    }
  })
})

// Workload Analysis View Data
const workloadChartData = computed(() => {
  const workloadData: Record<string, Record<string, number>> = {}

  testRuns.value?.forEach(run => {
    let workload = 'mixed'
    if (run.read_write_pattern.includes('read')) workload = 'read'
    else if (run.read_write_pattern.includes('write')) workload = 'write'

    if (workloadFilter.value !== 'all' && workload !== workloadFilter.value) return

    const combinationKey = `${run.hostname} - ${run.protocol} - ${run.drive_model}`

    if (!workloadData[workload]) workloadData[workload] = {}
    if (!workloadData[workload][combinationKey]) {
      workloadData[workload][combinationKey] = 0
    }
    workloadData[workload][combinationKey] = Math.max(
      workloadData[workload][combinationKey],
      run[primaryMetric.value]
    )
  })

  const workloads = Object.keys(workloadData)
  const datasets = availableCombinations.value.map((combination, index) => ({
    label: combination,
    data: workloads.map(workload => workloadData[workload][combination] || 0),
    backgroundColor: colorPalette[index % colorPalette.length],
    borderColor: colorPalette[index % colorPalette.length],
    borderWidth: 1,
  }))

  return { labels: workloads, datasets }
})

const workloadChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    title: {
      display: true,
      text: `${primaryMetricLabel.value} by Workload Type and Host-Protocol-Disk`
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      title: { display: true, text: primaryMetricLabel.value }
    }
  }
}))

const workloadInsights = computed(() => {
  return availableCombinations.value.map(combination => {
    const combinationRuns = testRuns.value?.filter(run => {
      const runCombination = `${run.hostname} - ${run.protocol} - ${run.drive_model}`
      return runCombination === combination
    }) || []

    const readRuns = combinationRuns.filter(run => run.read_write_pattern.includes('read'))
    const writeRuns = combinationRuns.filter(run => run.read_write_pattern.includes('write'))

    const readAvg = readRuns.length > 0
      ? readRuns.reduce((sum, run) => sum + run[primaryMetric.value], 0) / readRuns.length
      : 0
    const writeAvg = writeRuns.length > 0
      ? writeRuns.reduce((sum, run) => sum + run[primaryMetric.value], 0) / writeRuns.length
      : 0

    const ratio = writeAvg > 0 ? (readAvg / writeAvg).toFixed(2) : 'N/A'

    return {
      name: combination,
      readPerf: formatValue(readAvg),
      writePerf: formatValue(writeAvg),
      ratio
    }
  })
})

const workloadRecommendations = computed(() => {
  return availableCombinations.value.map(combination => {
    const insights = workloadInsights.value.find(i => i.name === combination)
    if (!insights) return { combo: combination, recommendation: 'Insufficient data', tags: [] }

    const readValue = parseFloat(insights.readPerf.replace(/[^\d.]/g, ''))
    const writeValue = parseFloat(insights.writePerf.replace(/[^\d.]/g, ''))
    const ratio = parseFloat(insights.ratio)

    let recommendation = ''
    const tags = []

    if (readValue > writeValue * 1.5) {
      recommendation = 'Excellent for read-heavy workloads'
      tags.push('Read Optimized')
    } else if (writeValue > readValue * 1.5) {
      recommendation = 'Excellent for write-heavy workloads'
      tags.push('Write Optimized')
    } else {
      recommendation = 'Balanced performance across read/write workloads'
      tags.push('Balanced')
    }

    if (ratio > 2) tags.push('High Read/Write Ratio')
    else if (ratio < 0.5) tags.push('Low Read/Write Ratio')

    return { combo: combination, recommendation, tags }
  })
})

// Helper computed properties
const primaryMetricLabel = computed(() => {
  switch (primaryMetric.value) {
    case 'iops': return 'IOPS'
    case 'bandwidth': return 'Bandwidth'
    case 'avg_latency': return 'Latency'
    default: return 'Value'
  }
})

const colorPalette = [
  '#3b82f6', '#22c55e', '#eab308', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316',
  '#10b981', '#a855f7', '#84cc16', '#0ea5e9', '#f43f5e', '#14b8a6', '#f59e0b'
]

// Utility functions
function formatValue(value: number): string {
  switch (primaryMetric.value) {
    case 'iops': return formatIOPS(value)
    case 'bandwidth': return formatBandwidth(value)
    case 'avg_latency': return formatLatency(value)
    default: return value.toString()
  }
}

function updateCombinationFilter() {
  // This will trigger reactive updates to all computed properties
  // The testRuns computed property will automatically filter based on selectedCombinationFilter
}
</script>

<style scoped>
/* Additional styles if needed */
</style>
