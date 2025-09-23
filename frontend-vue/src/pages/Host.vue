<template>
  <div class="host-page">
    <!-- Page Header with Theme Toggle -->
    <div class="page-header">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold theme-text-primary">Host Performance Analysis</h1>
          <p class="theme-text-secondary mt-2">Advanced visualization and analytics for storage performance</p>
        </div>
        <ThemeToggle show-label />
      </div>
    </div>

    <div class="page-content">
      <!-- Host Selection and Filters -->
      <div class="host-selection-section mb-6">
        <div class="grid grid-cols-1 xl:grid-cols-4 gap-6">
          <!-- Host Selector -->
          <div class="host-selector xl:col-span-1">
            <HostSelector
              v-model:hostname="selectedHostname"
              :hostnames="availableHostnames"
              :loading="loading"
              @host-change="handleHostChange"
            />
          </div>

          <!-- Filters Sidebar -->
          <div class="filters-sidebar xl:col-span-1">
            <HostFiltersSidebar
              :performance-data="allPerformanceData"
              :filters="filters"
              @update:filters="handleFiltersUpdate"
            />
          </div>

          <!-- Compact Filters -->
          <div class="compact-filters xl:col-span-2">
            <HostFilters
              :performance-data="allPerformanceData"
              :filters="filters"
              @update:filters="handleFiltersUpdate"
            />
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="loading-state">
        <div class="flex items-center justify-center py-12">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-4"></div>
          <p class="theme-text-secondary">Loading host data...</p>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="error-state">
        <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
          <div class="flex items-center">
            <AlertCircle class="w-5 h-5 mr-2" />
            {{ error }}
          </div>
        </div>
      </div>

      <!-- Host Data Display -->
      <div v-else-if="selectedHostname && filteredPerformanceData.length > 0" class="host-data">
        <!-- Host Summary Cards -->
        <div class="host-summary-section mb-6">
          <HostSummaryCards
            :hostname="selectedHostname"
            :performance-data="filteredPerformanceData"
          />
        </div>

        <!-- Visualization Controls -->
        <div class="visualization-controls-section mb-6">
          <HostVisualizationControls
            v-model:visualization="activeVisualization"
            :available-visualizations="availableVisualizations"
            :performance-data="filteredPerformanceData"
            @visualization-change="handleVisualizationChange"
          />
        </div>

        <!-- Visualizations Section -->
        <div class="visualizations-section">
          <!-- Performance Graphs -->
          <div
            v-if="activeVisualization === 'performance-graphs'"
            ref="performanceGraphsRef"
            class="visualization-container"
          >
            <template v-if="performanceGraphsLazy.hasBeenVisible">
              <ChartErrorBoundary
                chart-type="Performance Graphs"
                @chart-error="handleChartError"
                @chart-retry="handleChartRetry"
              >
                <PerformanceGraphs
                  :performance-data="filteredPerformanceData"
                  :loading="performanceGraphsLazy.isLoading"
                  :error="null"
                />
              </ChartErrorBoundary>
            </template>
            <div v-else class="lazy-placeholder">
              <div class="animate-pulse bg-gray-200 dark:bg-gray-700 rounded h-64"></div>
            </div>
          </div>

          <!-- Performance Heatmap -->
          <div
            v-else-if="activeVisualization === 'performance-heatmap'"
            ref="performanceHeatmapRef"
            class="visualization-container"
          >
            <template v-if="performanceHeatmapLazy.hasBeenVisible">
              <ChartErrorBoundary
                chart-type="Performance Heatmap"
                @chart-error="handleChartError"
                @chart-retry="handleChartRetry"
              >
                <PerformanceFingerprintHeatmap
                  :performance-data="filteredPerformanceData"
                  :loading="performanceHeatmapLazy.isLoading"
                  :error="null"
                />
              </ChartErrorBoundary>
            </template>
            <div v-else class="lazy-placeholder">
              <div class="animate-pulse bg-gray-200 dark:bg-gray-700 rounded h-64"></div>
            </div>
          </div>

          <!-- Drive Radar Chart -->
          <div
            v-else-if="activeVisualization === 'drive-radar'"
            ref="driveRadarRef"
            class="visualization-container"
          >
            <template v-if="driveRadarLazy.hasBeenVisible">
              <ChartErrorBoundary
                chart-type="Drive Radar Chart"
                @chart-error="handleChartError"
                @chart-retry="handleChartRetry"
              >
                <DriveRadarChart
                  :performance-data="filteredPerformanceData"
                  :loading="driveRadarLazy.isLoading"
                  :error="null"
                />
              </ChartErrorBoundary>
            </template>
            <div v-else class="lazy-placeholder">
              <div class="animate-pulse bg-gray-200 dark:bg-gray-700 rounded h-64"></div>
            </div>
          </div>

          <!-- Performance Scatter Plot -->
          <div
            v-else-if="activeVisualization === 'performance-scatter'"
            ref="performanceScatterRef"
            class="visualization-container"
          >
            <template v-if="performanceScatterLazy.hasBeenVisible">
              <ChartErrorBoundary
                chart-type="Performance Scatter Plot"
                @chart-error="handleChartError"
                @chart-retry="handleChartRetry"
              >
                <PerformanceScatterPlot
                  :performance-data="filteredPerformanceData"
                  :loading="performanceScatterLazy.isLoading"
                  :error="null"
                />
              </ChartErrorBoundary>
            </template>
            <div v-else class="lazy-placeholder">
              <div class="animate-pulse bg-gray-200 dark:bg-gray-700 rounded h-64"></div>
            </div>
          </div>

          <!-- Parallel Coordinates Chart -->
          <div
            v-else-if="activeVisualization === 'parallel-coordinates'"
            ref="parallelCoordinatesRef"
            class="visualization-container"
          >
            <template v-if="parallelCoordinatesLazy.hasBeenVisible">
              <ChartErrorBoundary
                chart-type="Parallel Coordinates Chart"
                @chart-error="handleChartError"
                @chart-retry="handleChartRetry"
              >
                <ParallelCoordinatesChart
                  :performance-data="filteredPerformanceData"
                  :loading="parallelCoordinatesLazy.isLoading"
                  :error="null"
                />
              </ChartErrorBoundary>
            </template>
            <div v-else class="lazy-placeholder">
              <div class="animate-pulse bg-gray-200 dark:bg-gray-700 rounded h-64"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- No Data State -->
      <div v-else-if="selectedHostname && filteredPerformanceData.length === 0" class="no-data-state">
        <div class="text-center py-12">
          <Database class="w-12 h-12 mx-auto theme-text-muted" />
          <h3 class="text-lg font-medium theme-text-primary mt-4">No data available</h3>
          <p class="theme-text-secondary">No performance data matches the current filters for {{ selectedHostname }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { AlertCircle, Database } from 'lucide-vue-next'

// Components
import ThemeToggle from '@/components/ThemeToggle.vue'
import HostSelector from '@/components/HostSelector.vue'
import HostFiltersSidebar from '@/components/HostFiltersSidebar.vue'
import HostFilters from '@/components/HostFilters.vue'
import HostSummaryCards from '@/components/HostSummaryCards.vue'
import HostVisualizationControls from '@/components/HostVisualizationControls.vue'
import PerformanceGraphs from '@/components/PerformanceGraphs/index.vue'
import PerformanceFingerprintHeatmap from '@/components/PerformanceFingerprintHeatmap.vue'
import DriveRadarChart from '@/components/DriveRadarChart.vue'
import PerformanceScatterPlot from '@/components/PerformanceScatterPlot.vue'
import ParallelCoordinatesChart from '@/components/ParallelCoordinatesChart.vue'
import ChartErrorBoundary from '@/components/ChartErrorBoundary.vue'

// Composables
import { useTestRuns } from '@/composables/useTestRuns'
import { useErrorHandler } from '@/composables/useErrorHandler'
import { useFilters } from '@/composables/useFilters'
import { useDebouncedUpdates, useLazyChart, usePerformanceMonitoring } from '@/composables/usePerformanceOptimization'

// Types
import type { PerformanceData, FilterState } from '@/types'

const route = useRoute()
const { testRuns, loading, error, fetchTestRuns, getUniqueHostnames } = useTestRuns()
const { handleApiError } = useErrorHandler()
const { filters, applyFilters } = useFilters()

// Performance optimizations
const { recordRenderTime } = usePerformanceMonitoring('HostPage')

// State
const selectedHostname = ref('')
const activeVisualization = ref('performance-graphs')

// Lazy loading for visualizations
const performanceGraphsRef = ref<HTMLElement | null>(null)
const performanceHeatmapRef = ref<HTMLElement | null>(null)
const driveRadarRef = ref<HTMLElement | null>(null)
const performanceScatterRef = ref<HTMLElement | null>(null)
const parallelCoordinatesRef = ref<HTMLElement | null>(null)

const performanceGraphsLazy = useLazyChart(performanceGraphsRef)
const performanceHeatmapLazy = useLazyChart(performanceHeatmapRef)
const driveRadarLazy = useLazyChart(driveRadarRef)
const performanceScatterLazy = useLazyChart(performanceScatterRef)
const parallelCoordinatesLazy = useLazyChart(parallelCoordinatesRef)
const filteredPerformanceData = ref<PerformanceData[]>([])

// Available visualizations
const availableVisualizations = [
  { id: 'performance-graphs', label: 'Performance Graphs', icon: 'BarChart3' },
  { id: 'performance-heatmap', label: 'Performance Heatmap', icon: 'Grid3X3' },
  { id: 'drive-radar', label: 'Drive Radar', icon: 'Radar' },
  { id: 'performance-scatter', label: 'Scatter Plot', icon: 'ScatterChart' },
  { id: 'parallel-coordinates', label: 'Parallel Coordinates', icon: 'GitBranch' }
]

// Computed
const availableHostnames = computed(() => getUniqueHostnames.value)

const allPerformanceData = computed((): PerformanceData[] => {
  if (!selectedHostname.value) return []

  return testRuns.value
    .filter(testRun => testRun.hostname === selectedHostname.value)
    .map(testRun => ({
      id: testRun.id,
      drive_model: testRun.drive_model || 'Unknown',
      drive_type: testRun.drive_type || 'Unknown',
      test_name: testRun.test_name || 'Unknown',
      description: testRun.description || '',
      block_size: testRun.block_size,
      read_write_pattern: testRun.read_write_pattern,
      timestamp: testRun.timestamp,
      queue_depth: testRun.queue_depth,
      hostname: testRun.hostname,
      protocol: testRun.protocol,
      metrics: {
        iops: { value: testRun.iops || 0, unit: 'IOPS' },
        avg_latency: { value: testRun.avg_latency || 0, unit: 'ms' },
        bandwidth: { value: testRun.bandwidth || 0, unit: 'MB/s' },
        p95_latency: { value: testRun.p95_latency || 0, unit: 'ms' },
        p99_latency: { value: testRun.p99_latency || 0, unit: 'ms' },
        responsiveness: { value: testRun.iops ? (testRun.iops / (testRun.avg_latency || 1)) : 0, unit: 'score' }
      },
      iops: testRun.iops,
      avg_latency: testRun.avg_latency,
      bandwidth: testRun.bandwidth,
      responsiveness: testRun.iops ? (testRun.iops / (testRun.avg_latency || 1)) : 0
    }))
})

// Debounced filter updates for performance
const { debouncedUpdate: debouncedFilterUpdate } = useDebouncedUpdates(
  () => {
    applyFiltersToData()
  },
  300 // 300ms debounce
)

// Apply filters function (extracted for reuse)
const applyFiltersToData = () => {
  const startTime = performance.now()

  let data = allPerformanceData.value

  // Apply filters
  if (filters.value.selectedDriveTypes.length > 0) {
    data = data.filter(item => filters.value.selectedDriveTypes.includes(item.drive_type))
  }

  if (filters.value.selectedDriveModels.length > 0) {
    data = data.filter(item => filters.value.selectedDriveModels.includes(item.drive_model))
  }

  if (filters.value.selectedPatterns.length > 0) {
    data = data.filter(item => filters.value.selectedPatterns.includes(item.read_write_pattern))
  }

  if (filters.value.selectedBlockSizes.length > 0) {
    data = data.filter(item => filters.value.selectedBlockSizes.includes(item.block_size))
  }

  if (filters.value.selectedQueueDepths.length > 0) {
    data = data.filter(item => filters.value.selectedQueueDepths.includes(item.queue_depth))
  }

  if (filters.value.selectedProtocols.length > 0) {
    data = data.filter(item => filters.value.selectedProtocols.includes(item.protocol || ''))
  }

  filteredPerformanceData.value = data

  const endTime = performance.now()
  console.log(`Filter application took ${(endTime - startTime).toFixed(2)}ms for ${data.length} items`)
}

// Methods
const handleHostChange = async (hostname: string) => {
  selectedHostname.value = hostname
  if (hostname) {
    try {
      await fetchTestRuns()
      // Apply filters after data load
      applyFiltersToData()
    } catch (err) {
      handleApiError(err, 'Failed to load host data')
    }
  }
}

const handleFiltersUpdate = (newFilters: Partial<FilterState>) => {
  applyFilters(newFilters)
  // Use debounced update for performance
  debouncedFilterUpdate({})
}

const handleVisualizationChange = (visualization: string) => {
  activeVisualization.value = visualization
}

// Error handling methods
const handleChartError = (error: Error, chartType: string) => {
  console.error(`Chart error in ${chartType}:`, error)
  // Could send to error reporting service here
}

const handleChartRetry = (chartType: string) => {
  console.log(`Retrying chart load for ${chartType}`)
  // Force re-render of the active visualization
  const currentViz = activeVisualization.value
  activeVisualization.value = ''
  setTimeout(() => {
    activeVisualization.value = currentViz
  }, 100)
}

// Initialize
onMounted(async () => {
  const startTime = performance.now()

  try {
    await fetchTestRuns()

    // Check for hostname in route params
    const hostname = route.params.hostname as string
    if (hostname && availableHostnames.value.includes(hostname)) {
      selectedHostname.value = hostname
      // Apply initial filters
      applyFiltersToData()
    }

    const endTime = performance.now()
    recordRenderTime(startTime)
    console.log(`Host page initialization took ${(endTime - startTime).toFixed(2)}ms`)
  } catch (err) {
    handleApiError(err, 'Failed to initialize host analysis')
  }
})

// Watch for route changes
watch(() => route.params.hostname, (newHostname) => {
  if (newHostname && typeof newHostname === 'string' && availableHostnames.value.includes(newHostname)) {
    selectedHostname.value = newHostname
  }
})
</script>

<style scoped>
.host-page {
  @apply min-h-screen;
  @apply bg-gray-50 dark:bg-gray-900;
  @apply theme-transition;
}

.page-header {
  @apply mb-8;
}

.page-content {
  @apply space-y-6;
}

.host-selection-section {
  @apply theme-transition;
}

.loading-state,
.error-state,
.no-data-state {
  @apply theme-transition;
}

.host-data {
  @apply theme-transition;
}

.visualization-container {
  @apply bg-white dark:bg-gray-800;
  @apply rounded-lg border border-gray-200 dark:border-gray-700;
  @apply p-6 shadow-sm;
  @apply theme-transition;
}

.theme-text-primary {
  @apply text-gray-900 dark:text-gray-100;
}

.theme-text-secondary {
  @apply text-gray-600 dark:text-gray-400;
}

.theme-text-muted {
  @apply text-gray-400 dark:text-gray-600;
}

.theme-transition {
  @apply transition-colors duration-300 ease-in-out;
}

.lazy-placeholder {
  @apply theme-transition;
}

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

</style>


