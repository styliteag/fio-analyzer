<template>
  <div class="flex h-screen bg-gray-50">
    <!-- Filter Sidebar -->
    <FilterSidebar />

    <!-- Main Content -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <!-- Header -->
      <header class="bg-white border-b border-gray-200 px-6 py-4">
        <div class="flex items-center justify-between">
          <h1 class="text-2xl font-bold text-gray-900">Workload Analysis Dashboard</h1>
          <div class="flex items-center gap-4">
            <router-link to="/" class="btn-secondary">
              Back to Comparison
            </router-link>
            <button @click="handleLogout" class="btn-secondary">
              Logout
            </button>
          </div>
        </div>
      </header>

      <!-- Main Area -->
      <main class="flex-1 overflow-y-auto p-6 space-y-6">
        <!-- Host Selector -->
        <div class="card">
          <HostSelector
            :available-hosts="testRunsStore.availableHostnames"
            :selected-hosts="selectedHosts"
            :loading="testRunsStore.loading"
            @update:selected-hosts="selectedHosts = $event"
            @refresh="loadData"
          />
        </div>

        <!-- Metric Selector -->
        <div class="card">
          <h3 class="text-lg font-semibold mb-3">Select Metric</h3>
          <div class="flex gap-2">
            <button
              v-for="m in availableMetrics"
              :key="m.value"
              @click="selectedMetric = m.value"
              class="px-4 py-2 rounded-lg font-medium transition-colors"
              :class="{
                'bg-blue-600 text-white': selectedMetric === m.value,
                'bg-gray-200 text-gray-700 hover:bg-gray-300': selectedMetric !== m.value
              }"
            >
              {{ m.label }}
            </button>
          </div>
        </div>

        <!-- Loading State -->
        <div v-if="testRunsStore.loading" class="card text-center py-12">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p class="mt-4 text-gray-600">Loading test data...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="testRunsStore.error" class="card">
          <div class="text-center py-8">
            <p class="text-red-600 font-semibold">Error loading data</p>
            <p class="text-gray-600 mt-2">{{ testRunsStore.error }}</p>
            <button @click="loadData" class="btn-primary mt-4">Retry</button>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else-if="selectedHosts.length === 0" class="card">
          <div class="text-center py-12">
            <p class="text-gray-500 text-lg">Select hosts to view workload analysis</p>
          </div>
        </div>

        <!-- Dashboard Content -->
        <div v-else-if="filteredTestRuns.length > 0" class="space-y-6">
          <!-- Summary Cards -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div v-for="host in selectedHosts" :key="host" class="card">
              <h4 class="font-semibold text-gray-900 mb-2">{{ host }}</h4>
              <div v-if="getHostSummary(host)" class="space-y-2 text-sm">
                <div class="flex justify-between">
                  <span class="text-gray-600">Avg {{ getMetricLabel(selectedMetric) }}:</span>
                  <span class="font-semibold">{{ formatValue(getHostSummary(host)!.avg) }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-600">Best:</span>
                  <span class="font-semibold text-green-600">{{ formatValue(getHostSummary(host)!.max) }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-600">Tests:</span>
                  <span class="font-semibold">{{ getHostSummary(host)!.count }}</span>
                </div>
                <div v-if="getBestConfig(host)" class="mt-2 pt-2 border-t border-gray-200">
                  <div class="text-gray-600 mb-1">Best Config:</div>
                  <div class="font-medium text-xs">{{ formatConfig(getBestConfig(host)!) }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Performance Heatmap -->
          <div class="card">
            <h3 class="text-lg font-semibold mb-4">Performance Heatmap - All Configurations</h3>
            <HeatmapChart
              :heatmap-data="heatmapData"
              :metric="selectedMetric"
            />
          </div>

          <!-- Performance Matrix -->
          <div class="card">
            <PerformanceMatrix
              :test-runs="filteredTestRuns"
              :metric="selectedMetric"
              title="Performance Matrix (Configurable Dimensions)"
            />
          </div>

          <!-- Trend Charts -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Block Size Trend -->
            <div class="card">
              <TrendChart
                :data="blockSizeTrendData"
                title="Block Size Performance Trend"
                :x-axis-label="'Block Size'"
                :y-axis-label="getMetricLabel(selectedMetric)"
                :height="'350px'"
              />
            </div>

            <!-- Queue Depth Trend -->
            <div class="card">
              <TrendChart
                :data="queueDepthTrendData"
                title="Queue Depth Scaling"
                :x-axis-label="'Queue Depth'"
                :y-axis-label="getMetricLabel(selectedMetric)"
                :height="'350px'"
              />
            </div>
          </div>

          <!-- Pattern Comparison -->
          <div class="card">
            <BarChart
              :data="patternComparisonData"
              title="I/O Pattern Comparison"
              :y-axis-label="getMetricLabel(selectedMetric)"
              :height="'400px'"
            />
          </div>
        </div>

        <!-- No Data State -->
        <div v-else class="card">
          <div class="text-center py-12">
            <p class="text-gray-500 text-lg">No test data found for selected hosts and filters</p>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useTestRunsStore } from '../stores/testRuns'
import { useFiltersStore } from '../stores/filters'
import { useApi } from '../composables/useApi'
import { useHeatmapData } from '../composables/useHeatmapData'
import { useTrendAnalysis } from '../composables/useTrendAnalysis'
import { useChartData } from '../composables/useChartData'
import FilterSidebar from '../components/filters/FilterSidebar.vue'
import HostSelector from '../components/filters/HostSelector.vue'
import HeatmapChart from '../components/charts/HeatmapChart.vue'
import TrendChart from '../components/charts/TrendChart.vue'
import BarChart from '../components/charts/BarChart.vue'
import PerformanceMatrix from '../components/charts/PerformanceMatrix.vue'
import type { MetricType, TestRun } from '../types/testRun'

const router = useRouter()
const authStore = useAuthStore()
const testRunsStore = useTestRunsStore()
const filtersStore = useFiltersStore()
const api = useApi()

const { createHostHeatmap } = useHeatmapData()
const { createBlockSizeTrend, createQueueDepthTrend, createPatternComparison, calculateSummary, findBestConfig } = useTrendAnalysis()
const { getMetricLabel, formatMetric, getConfigLabel } = useChartData()

const selectedHosts = ref<string[]>([])
const selectedMetric = ref<MetricType>('iops')

const availableMetrics = [
  { value: 'iops' as MetricType, label: 'IOPS' },
  { value: 'avg_latency' as MetricType, label: 'Avg Latency' },
  { value: 'bandwidth' as MetricType, label: 'Bandwidth' },
  { value: 'p95_latency' as MetricType, label: 'P95 Latency' },
  { value: 'p99_latency' as MetricType, label: 'P99 Latency' }
]

// Filter test runs by selected hosts
const filteredTestRuns = computed(() => {
  return testRunsStore.getTestRunsByHosts(selectedHosts.value)
})

// Heatmap data
const heatmapData = computed(() => {
  return createHostHeatmap(filteredTestRuns.value, selectedMetric.value)
})

// Trend data
const blockSizeTrendData = computed(() => {
  return createBlockSizeTrend(filteredTestRuns.value, selectedMetric.value, 'hostname')
})

const queueDepthTrendData = computed(() => {
  return createQueueDepthTrend(filteredTestRuns.value, selectedMetric.value, 'hostname')
})

const patternComparisonData = computed(() => {
  return createPatternComparison(filteredTestRuns.value, selectedMetric.value, selectedHosts.value)
})

// Get summary for a host
function getHostSummary(hostname: string) {
  const hostRuns = filteredTestRuns.value.filter((r) => r.hostname === hostname)
  return calculateSummary(hostRuns, selectedMetric.value)
}

// Get best config for a host
function getBestConfig(hostname: string): TestRun | null {
  const hostRuns = filteredTestRuns.value.filter((r) => r.hostname === hostname)
  return findBestConfig(hostRuns, selectedMetric.value)
}

// Format config string
function formatConfig(run: TestRun): string {
  return getConfigLabel(run)
}

// Format value
function formatValue(value: number): string {
  return formatMetric(value, selectedMetric.value)
}

async function loadData() {
  await testRunsStore.fetchTestRuns(authStore.getAuthHeader())
}

async function loadFilters() {
  try {
    const filters = await api.getFilters()
    filtersStore.setAvailable(filters)
  } catch (error) {
    console.error('Error loading filters:', error)
  }
}

function handleLogout() {
  authStore.logout()
  router.push({ name: 'Login' })
}

// Load data when filters change
watch(() => filtersStore.active, loadData, { deep: true })

onMounted(async () => {
  authStore.init()
  await loadFilters()
  await loadData()
})
</script>
