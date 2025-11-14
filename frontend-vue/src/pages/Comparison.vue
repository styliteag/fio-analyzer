<template>
  <div class="flex h-screen bg-gray-50">
    <!-- Filter Sidebar -->
    <FilterSidebar />

    <!-- Main Content -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <!-- Header -->
      <header class="bg-white border-b border-gray-200 px-6 py-4">
        <div class="flex items-center justify-between">
          <h1 class="text-2xl font-bold text-gray-900">Advanced Comparison Views</h1>
          <div class="flex items-center gap-4">
            <router-link
              to="/"
              class="text-sm text-blue-600 hover:text-blue-700"
            >
              ← Simple Comparison
            </router-link>
            <router-link
              to="/upload"
              class="btn-secondary"
            >
              Upload Data
            </router-link>
            <button
              @click="handleLogout"
              class="btn-secondary"
            >
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

        <!-- Tab Navigation -->
        <div class="bg-white border-b border-gray-200">
          <nav class="flex gap-2 px-4">
            <button
              v-for="tab in tabs"
              :key="tab.value"
              @click="activeTab = tab.value"
              class="px-4 py-3 font-medium border-b-2 transition-colors"
              :class="{
                'border-blue-600 text-blue-600': activeTab === tab.value,
                'border-transparent text-gray-600 hover:text-gray-900': activeTab !== tab.value
              }"
            >
              {{ tab.label }}
            </button>
          </nav>
        </div>

        <!-- Metric Selector -->
        <div class="card">
          <div class="space-y-3">
            <h3 class="text-lg font-semibold text-gray-900">Metrics to Compare</h3>
            <div class="flex flex-wrap gap-2">
              <label
                v-for="metric in availableMetrics"
                :key="metric.value"
                class="flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer hover:bg-gray-50"
                :class="{
                  'border-blue-500 bg-blue-50': selectedMetrics.includes(metric.value),
                  'border-gray-300': !selectedMetrics.includes(metric.value)
                }"
              >
                <input
                  type="checkbox"
                  :value="metric.value"
                  v-model="selectedMetrics"
                  class="w-4 h-4 text-blue-600"
                />
                <span class="text-sm font-medium">{{ metric.label }}</span>
              </label>
            </div>
          </div>
        </div>

        <!-- Chart Type Selector -->
        <div class="card">
          <div class="space-y-3">
            <h3 class="text-lg font-semibold text-gray-900">Chart Type</h3>
            <div class="flex gap-4">
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="grouped"
                  v-model="chartType"
                  class="w-4 h-4 text-blue-600"
                />
                <span class="text-sm font-medium">Grouped</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="stacked"
                  v-model="chartType"
                  class="w-4 h-4 text-blue-600"
                />
                <span class="text-sm font-medium">Stacked</span>
              </label>
            </div>
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
            <button @click="loadData" class="btn-primary mt-4">
              Retry
            </button>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else-if="selectedHosts.length === 0" class="card">
          <div class="text-center py-12">
            <p class="text-gray-500 text-lg">Select hosts to view comparison charts</p>
          </div>
        </div>

        <!-- No Data State -->
        <div v-else-if="filteredTestRuns.length === 0" class="card">
          <div class="text-center py-12">
            <p class="text-gray-500 text-lg">No test data found for selected hosts and filters</p>
          </div>
        </div>

        <!-- Tab Content -->
        <div v-else class="space-y-6">
          <!-- Bar Charts Tab -->
          <div v-if="activeTab === 'charts'" class="space-y-6">
            <div
              v-for="[configKey, runs] in groupedTestRuns"
              :key="configKey"
              class="card"
            >
              <h3 class="text-lg font-semibold text-gray-800 mb-4">
                {{ getConfigLabel(runs[0]) }}
              </h3>
              <BarChart
                :data="createChartData(runs)"
                :stacked="chartType === 'stacked'"
                :y-axis-label="getYAxisLabel()"
                :height="'350px'"
              />
            </div>
          </div>

          <!-- Heatmap Tab -->
          <div v-else-if="activeTab === 'heatmap'" class="card">
            <HeatmapChart
              :heatmap-data="heatmapData"
              :metric="selectedMetrics[0] || 'iops'"
              title="Performance Heatmap - All Configurations"
            />
          </div>

          <!-- Trends Tab -->
          <div v-else-if="activeTab === 'trends'" class="space-y-6">
            <div class="card">
              <TrendChart
                :data="blockSizeTrendData"
                title="Block Size Performance Trend"
                x-axis-label="Block Size"
                :y-axis-label="getYAxisLabel()"
                height="400px"
              />
            </div>
            <div class="card">
              <TrendChart
                :data="queueDepthTrendData"
                title="Queue Depth Scaling"
                x-axis-label="Queue Depth"
                :y-axis-label="getYAxisLabel()"
                height="400px"
              />
            </div>
          </div>

          <!-- Matrix Tab -->
          <div v-else-if="activeTab === 'matrix'" class="card">
            <PerformanceMatrix
              :test-runs="filteredTestRuns"
              :metric="selectedMetrics[0] || 'iops'"
              title="Configurable Performance Matrix"
            />
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
import { useChartData } from '../composables/useChartData'
import { useHeatmapData } from '../composables/useHeatmapData'
import { useTrendAnalysis } from '../composables/useTrendAnalysis'
import FilterSidebar from '../components/filters/FilterSidebar.vue'
import HostSelector from '../components/filters/HostSelector.vue'
import BarChart from '../components/charts/BarChart.vue'
import HeatmapChart from '../components/charts/HeatmapChart.vue'
import TrendChart from '../components/charts/TrendChart.vue'
import PerformanceMatrix from '../components/charts/PerformanceMatrix.vue'
import type { MetricType, TestRun } from '../types/testRun'

const router = useRouter()
const authStore = useAuthStore()
const testRunsStore = useTestRunsStore()
const filtersStore = useFiltersStore()
const api = useApi()
const chartUtils = useChartData()
const { createHostHeatmap } = useHeatmapData()
const { createBlockSizeTrend, createQueueDepthTrend } = useTrendAnalysis()

const selectedHosts = ref<string[]>([])
const selectedMetrics = ref<MetricType[]>(['iops'])
const chartType = ref<'grouped' | 'stacked'>('grouped')
const activeTab = ref<'charts' | 'heatmap' | 'trends' | 'matrix'>('charts')

const tabs = [
  { value: 'charts' as const, label: 'Bar Charts' },
  { value: 'heatmap' as const, label: 'Heatmap' },
  { value: 'trends' as const, label: 'Trends' },
  { value: 'matrix' as const, label: 'Matrix' }
]

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

// Group test runs by configuration
const groupedTestRuns = computed(() => {
  return testRunsStore.groupByConfiguration(filteredTestRuns.value)
})

// Heatmap data
const heatmapData = computed(() => {
  if (selectedMetrics.value.length === 0) return createHostHeatmap([], 'iops')
  return createHostHeatmap(filteredTestRuns.value, selectedMetrics.value[0])
})

// Trend data
const blockSizeTrendData = computed(() => {
  if (selectedMetrics.value.length === 0) return { labels: [], datasets: [] }
  return createBlockSizeTrend(filteredTestRuns.value, selectedMetrics.value[0], 'hostname')
})

const queueDepthTrendData = computed(() => {
  if (selectedMetrics.value.length === 0) return { labels: [], datasets: [] }
  return createQueueDepthTrend(filteredTestRuns.value, selectedMetrics.value[0], 'hostname')
})

// Create chart data for a group of test runs
function createChartData(runs: TestRun[]) {
  if (selectedMetrics.value.length === 1) {
    return chartUtils.createHostComparisonData(runs, selectedMetrics.value[0])
  } else {
    return chartUtils.createMultiMetricGroupedData(runs, selectedMetrics.value)
  }
}

function getConfigLabel(run: TestRun): string {
  return chartUtils.getConfigLabel(run)
}

function getYAxisLabel(): string {
  if (selectedMetrics.value.length === 1) {
    return chartUtils.getMetricLabel(selectedMetrics.value[0])
  }
  return 'Value'
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
