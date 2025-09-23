<template>
  <div class="host-page">
    <div class="page-header">
      <h1 class="text-3xl font-bold text-gray-900">Host Performance Analysis</h1>
      <p class="text-gray-600 mt-2">Detailed performance visualization and metrics for individual hosts</p>
    </div>

    <div class="page-content">
      <!-- Host Selection -->
      <div class="host-selector mb-6">
        <div class="bg-white rounded-lg border border-gray-200 p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Select Host</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Hostname</label>
              <select
                v-model="selectedHostname"
                class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                @change="loadHostData"
              >
                <option value="">Select a host...</option>
                <option v-for="hostname in uniqueHostnames" :key="hostname" :value="hostname">
                  {{ hostname }}
                </option>
              </select>
            </div>
            <div v-if="selectedHostname" class="flex items-end">
              <button
                :disabled="loading"
                class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
                @click="refreshHostData"
              >
                {{ loading ? 'Loading...' : 'Refresh Data' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="loading-state">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p class="text-center text-gray-600 mt-2">Loading host data...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="error-state">
        <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {{ error }}
        </div>
      </div>

      <!-- Host Data Display -->
      <div v-else-if="selectedHostname && hostTestRuns.length > 0" class="host-data">
        <!-- Host Summary -->
        <div class="host-summary mb-6">
          <div class="bg-white rounded-lg border border-gray-200 p-6">
            <h2 class="text-lg font-semibold text-gray-900 mb-4">{{ selectedHostname }} - Summary</h2>
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div class="metric-card">
                <div class="text-2xl font-bold text-blue-600">{{ hostTestRuns.length }}</div>
                <div class="text-sm text-gray-600">Total Tests</div>
              </div>
              <div class="metric-card">
                <div class="text-2xl font-bold text-green-600">{{ formatNumber(avgIOPS) }}</div>
                <div class="text-sm text-gray-600">Avg Total IOPS</div>
              </div>
              <div class="metric-card">
                <div class="text-2xl font-bold text-orange-600">{{ avgLatency.toFixed(2) }}ms</div>
                <div class="text-sm text-gray-600">Avg Latency</div>
              </div>
              <div class="metric-card">
                <div class="text-2xl font-bold text-purple-600">{{ formatNumber(avgBandwidth) }} MB/s</div>
                <div class="text-sm text-gray-600">Avg Bandwidth</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Chart Template Selector -->
        <div class="chart-controls mb-6">
          <ChartTemplateSelector
            v-model="selectedChartType"
            @template-change="onTemplateChange"
            @options-change="onOptionsChange"
          />
        </div>

        <!-- Charts Section -->
        <div class="charts-section">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Performance Radar Chart -->
            <div v-if="selectedChartType === 'radar'" class="chart-container">
              <RadarChart
                :test-runs="hostTestRuns"
                :selected-metrics="radarMetrics"
                :height="400"
                title="Performance Radar"
              />
            </div>

            <!-- Time Series Line Chart -->
            <div v-if="selectedChartType === 'line'" class="chart-container">
              <BasicLineChart
                :time-series-data="timeSeriesData"
                :height="400"
                :show-area="chartOptions.showArea"
                :smooth="chartOptions.smooth"
                title="Performance Trends"
              />
            </div>

            <!-- 3D Bar Chart -->
            <div v-if="selectedChartType === 'bar3d'" class="chart-container full-width">
              <ThreeDBarChart
                :test-runs="hostTestRuns"
                :metric="chartOptions.metric"
                :height="400"
              />
            </div>

            <!-- Performance Comparison Chart -->
            <div v-if="selectedChartType === 'comparison'" class="chart-container">
              <BasicLineChart
                :time-series-data="comparisonData"
                :height="400"
                title="IOPS vs Latency Comparison"
                y-axis-label="Performance Score"
              />
            </div>
          </div>
        </div>

        <!-- Detailed Test Results -->
        <div class="test-results mt-6">
          <div class="bg-white rounded-lg border border-gray-200 p-6">
            <h2 class="text-lg font-semibold text-gray-900 mb-4">Recent Test Results</h2>
            <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table class="min-w-full divide-y divide-gray-300">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="table-header">Date</th>
                    <th class="table-header">Test Name</th>
                    <th class="table-header">Drive Type</th>
                    <th class="table-header">IOPS</th>
                    <th class="table-header">Bandwidth</th>
                    <th class="table-header">Avg Latency</th>
                    <th class="table-header">95th % Latency</th>
                    <th class="table-header">Pattern</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 bg-white">
                  <tr v-for="(testRun, index) in recentTestRuns" :key="`${testRun.id}-${index}`" class="hover:bg-gray-50">
                    <td class="table-cell">{{ formatDate(testRun.timestamp) }}</td>
                    <td class="table-cell">{{ testRun.test_name }}</td>
                    <td class="table-cell">{{ testRun.drive_type }}</td>
                    <td class="table-cell">{{ formatNumber(testRun.iops) }}</td>
                    <td class="table-cell">{{ formatNumber(testRun.bandwidth) }}</td>
                    <td class="table-cell">{{ (testRun.avg_latency || 0).toFixed(2) }}ms</td>
                    <td class="table-cell">{{ (testRun.p95_latency || 0).toFixed(2) }}ms</td>
                    <td class="table-cell">{{ testRun.read_write_pattern || 'N/A' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- No Data State -->
      <div v-else-if="selectedHostname && hostTestRuns.length === 0" class="no-data-state">
        <div class="text-center py-12">
          <svg class="w-12 h-12 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
          <h3 class="text-lg font-medium text-gray-900 mt-4">No test data found</h3>
          <p class="text-gray-500">No performance data available for {{ selectedHostname }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useTestRuns } from '@/composables/useTestRuns'
import { useErrorHandler } from '@/composables/useErrorHandler'
import RadarChart from '@/components/charts/RadarChart.vue'
import BasicLineChart from '@/components/charts/BasicLineChart.vue'
import ThreeDBarChart from '@/components/charts/ThreeDBarChart.vue'
import ChartTemplateSelector from '@/components/ChartTemplateSelector.vue'
import type { TimeSeriesData } from '@/types'

const route = useRoute()
const { testRuns, loading, error, fetchTestRuns, getUniqueHostnames } = useTestRuns()
const { handleApiError } = useErrorHandler()

// State
const selectedHostname = ref('')
const selectedChartType = ref('radar')

// Watch for chart type changes and ensure valid state
watch(selectedChartType, (newType) => {
  // Ensure we have valid time series data when switching to line chart
  if (newType === 'line' && (!timeSeriesData.value || timeSeriesData.value.length === 0)) {
    loadTimeSeriesData()
  }
})
const chartOptions = ref({
  showArea: false,
  smooth: true,
  metric: 'iops' as 'iops' | 'latency' | 'bandwidth'
})
const timeSeriesData = ref<TimeSeriesData[]>([])
const radarMetrics = ['iops', 'avg_latency', 'bandwidth', 'p95_latency']

// Computed
const uniqueHostnames = getUniqueHostnames

const hostTestRuns = computed(() => {
  if (!selectedHostname.value || !testRuns.value) return []
  return testRuns.value.filter(run => run.hostname === selectedHostname.value)
})

const recentTestRuns = computed(() => {
  return hostTestRuns.value
    .slice()
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10)
})

const avgIOPS = computed(() => {
  if (!hostTestRuns.value || hostTestRuns.value.length === 0) return 0
  const total = hostTestRuns.value.reduce((sum, run) => {
    return sum + (run.iops || 0)
  }, 0)
  return Math.round(total / hostTestRuns.value.length)
})

const avgLatency = computed(() => {
  if (!hostTestRuns.value || hostTestRuns.value.length === 0) return 0
  const total = hostTestRuns.value.reduce((sum, run) => {
    return sum + (run.avg_latency || 0)
  }, 0)
  return total / hostTestRuns.value.length
})

const avgBandwidth = computed(() => {
  if (!hostTestRuns.value || hostTestRuns.value.length === 0) return 0
  const total = hostTestRuns.value.reduce((sum, run) => {
    return sum + (run.bandwidth || 0)
  }, 0)
  return Math.round(total / hostTestRuns.value.length)
})

const comparisonData = computed((): TimeSeriesData[] => {
  if (!hostTestRuns.value || hostTestRuns.value.length === 0) return []

  const timestamps = hostTestRuns.value.map(run => run.timestamp)
  const iopsValues = hostTestRuns.value.map(run => run.iops || 0)
  const latencyValues = hostTestRuns.value.map(run => {
    const latency = run.avg_latency || 0
    return Math.max(0, 100 - latency)
  })

  return [
    {
      timestamps,
      values: iopsValues,
      metric: 'Total IOPS',
      hostname: selectedHostname.value
    },
    {
      timestamps,
      values: latencyValues,
      metric: 'Latency Score',
      hostname: selectedHostname.value
    }
  ]
})

// Methods
const loadHostData = async () => {
  if (!selectedHostname.value) return

  try {
    await fetchTestRuns({ hostname: selectedHostname.value })
    await loadTimeSeriesData()
  } catch (err) {
    handleApiError(err)
  }
}

const refreshHostData = () => {
  loadHostData()
}

const loadTimeSeriesData = async () => {
  if (!selectedHostname.value || !testRuns.value) return

  try {
    // Transform test runs data into time series format locally
    const hostTestRuns = testRuns.value.filter(run => run.hostname === selectedHostname.value)

    if (hostTestRuns.length === 0) {
      timeSeriesData.value = []
      return
    }

    // Sort by timestamp for proper time series ordering
    const sortedRuns = hostTestRuns.slice().sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )

    // Create time series data from test runs (using aggregated metrics)
    const iopsTotal: TimeSeriesData = {
      timestamps: sortedRuns.map(run => run.timestamp),
      values: sortedRuns.map(run => run.iops || 0),
      metric: 'Total IOPS',
      hostname: selectedHostname.value
    }

    const avgLatency: TimeSeriesData = {
      timestamps: sortedRuns.map(run => run.timestamp),
      values: sortedRuns.map(run => run.avg_latency || 0),
      metric: 'Average Latency (ms)',
      hostname: selectedHostname.value
    }

    const bandwidth: TimeSeriesData = {
      timestamps: sortedRuns.map(run => run.timestamp),
      values: sortedRuns.map(run => run.bandwidth || 0),
      metric: 'Bandwidth (MB/s)',
      hostname: selectedHostname.value
    }

    const p95Latency: TimeSeriesData = {
      timestamps: sortedRuns.map(run => run.timestamp),
      values: sortedRuns.map(run => run.p95_latency || 0),
      metric: '95th Percentile Latency (ms)',
      hostname: selectedHostname.value
    }

    timeSeriesData.value = [iopsTotal, avgLatency, bandwidth, p95Latency]
  } catch (err) {
    console.error('Error loading time series data:', err)
    timeSeriesData.value = []
  }
}

const onTemplateChange = (template: string) => {
  selectedChartType.value = template
}

const onOptionsChange = (options: Partial<typeof chartOptions.value>) => {
  chartOptions.value = { ...chartOptions.value, ...options }
}

const formatNumber = (num: number): string => {
  if (typeof num !== 'number' || isNaN(num)) return '0'
  return num.toLocaleString()
}

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString()
}

// Lifecycle
onMounted(() => {
  // Check if hostname is provided in URL query
  const hostnameFromQuery = route.query.hostname as string
  if (hostnameFromQuery) {
    selectedHostname.value = hostnameFromQuery
  }

  fetchTestRuns().then(() => {
    if (hostnameFromQuery) {
      loadHostData()
    }
  })
})

watch(() => route.query.hostname, (newHostname) => {
  if (newHostname && typeof newHostname === 'string') {
    selectedHostname.value = newHostname
    loadHostData()
  }
})
</script>

<style scoped>
.host-page {
  @apply min-h-screen bg-gray-50 p-6;
}

.page-header {
  @apply mb-8;
}

.page-content {
  @apply max-w-7xl mx-auto;
}

.loading-state,
.error-state,
.no-data-state {
  @apply text-center py-12;
}

.metric-card {
  @apply text-center p-4 bg-gray-50 rounded-lg;
}

.chart-container {
  @apply bg-white rounded-lg border border-gray-200 p-4;
}

.chart-container.full-width {
  @apply lg:col-span-2;
}

.table-header {
  @apply px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider;
}

.table-cell {
  @apply px-6 py-4 whitespace-nowrap text-sm text-gray-500;
}
</style>


