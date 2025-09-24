<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Header Section -->
    <div class="bg-white dark:bg-gray-800 shadow-sm">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Host Analysis</h1>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Multi-host performance comparison and analysis
            </p>
          </div>
          <div class="flex items-center space-x-3">
            <span v-if="selectedHostsCount > 0" class="text-sm text-gray-600 dark:text-gray-300">
              {{ selectedHostsCount }} {{ selectedHostsCount === 1 ? 'Host' : 'Hosts' }} Selected
            </span>
            <button
              :disabled="isRefreshing"
              class="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              @click="refreshAnalysis"
            >
              <RefreshCw v-if="isRefreshing" class="animate-spin w-4 h-4 mr-2" />
              <RefreshCw v-else class="w-4 h-4 mr-2" />
              {{ isRefreshing ? 'Refreshing...' : 'Refresh Analysis' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="flex flex-col lg:flex-row gap-8">
        <!-- Sidebar with Host Selection and Filters -->
        <div class="lg:w-80 space-y-6">
          <!-- Host Selection Panel -->
          <div class="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
            <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 class="text-lg font-medium text-gray-900 dark:text-white">Host Selection</h3>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Select hosts to compare performance metrics
              </p>
            </div>
            <div class="p-6">
              <HostSelector v-model="selectedHosts" :available-hosts="availableHosts" />
            </div>
          </div>

          <!-- Filter Sidebar -->
          <FilterSidebar v-model="activeFilters" :filter-options="filterOptions" />

          <!-- Active Filters Summary -->
          <div v-if="hasActiveFilters" class="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
            <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 class="text-lg font-medium text-gray-900 dark:text-white">Active Filters</h3>
            </div>
            <div class="p-6">
              <ActiveFilters v-model="activeFilters" @clear="clearAllFilters" />
            </div>
          </div>

          <!-- Analysis Summary -->
          <div class="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
            <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 class="text-lg font-medium text-gray-900 dark:text-white">Analysis Summary</h3>
            </div>
            <div class="p-6">
              <dl class="space-y-3">
                <div>
                  <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Total Tests</dt>
                  <dd class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ totalTests }}</dd>
                </div>
                <div>
                  <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Date Range</dt>
                  <dd class="text-sm text-gray-900 dark:text-gray-100">{{ dateRange }}</dd>
                </div>
                <div>
                  <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Configurations</dt>
                  <dd class="text-sm text-gray-900 dark:text-gray-100">{{ configurationsCount }}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>

        <!-- Main Analysis Area -->
        <div class="flex-1 space-y-8">
          <!-- Navigation Tabs -->
          <div class="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
            <div class="border-b border-gray-200 dark:border-gray-700">
              <nav class="flex space-x-8 px-6" aria-label="Analysis Tabs">
                <button
                  v-for="tab in analysisTabs"
                  :key="tab.id"
                  :class="[
                    'py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap',
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                  ]"
                  @click="activeTab = tab.id"
                >
                  <component :is="tab.icon" class="w-5 h-5 inline mr-2" />
                  {{ tab.name }}
                  <span v-if="tab.count" class="ml-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 py-0.5 px-2 rounded-full text-xs">
                    {{ tab.count }}
                  </span>
                </button>
              </nav>
            </div>
          </div>

          <!-- Tab Content -->
          <div class="space-y-6">
            <!-- Performance Analytics Tab -->
            <div v-if="activeTab === 'analytics'" class="space-y-6">
              <VisualizationTabs :data="filteredTestData" :hosts="selectedHosts" />
            </div>

            <!-- Test History Tab -->
            <div v-else-if="activeTab === 'history'" class="space-y-6">
              <div class="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
                <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 class="text-lg font-medium text-gray-900 dark:text-white">Test History</h3>
                  <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Chronological view of performance tests for selected hosts
                  </p>
                </div>
                <div class="overflow-x-auto">
                  <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead class="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Timestamp
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Host
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Test
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          IOPS
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Latency
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Bandwidth
                        </th>
                      </tr>
                    </thead>
                    <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      <tr v-for="test in paginatedTestHistory" :key="test.id" class="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {{ formatDate(test.timestamp) }}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                          {{ test.hostname }}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {{ test.test_name }}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {{ formatNumber(test.iops) }}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {{ test.avg_latency.toFixed(3) }}ms
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {{ formatNumber(test.bandwidth) }} MB/s
                        </td>
                      </tr>
                      <tr v-if="filteredTestData.length === 0">
                        <td colspan="6" class="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                          <Server class="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
                          <p>No test data available</p>
                          <p class="text-xs mt-2">Select hosts and adjust filters to view results</p>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <!-- Pagination -->
                <div v-if="filteredTestData.length > itemsPerPage" class="bg-white dark:bg-gray-800 px-6 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700">
                  <div class="flex-1 flex justify-between sm:hidden">
                    <button
                      :disabled="currentPage === 1"
                      class="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      @click="currentPage--"
                    >
                      Previous
                    </button>
                    <button
                      :disabled="currentPage === totalPages"
                      class="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      @click="currentPage++"
                    >
                      Next
                    </button>
                  </div>
                  <div class="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p class="text-sm text-gray-700 dark:text-gray-300">
                        Showing {{ ((currentPage - 1) * itemsPerPage) + 1 }} to {{ Math.min(currentPage * itemsPerPage, filteredTestData.length) }} of {{ filteredTestData.length }} results
                      </p>
                    </div>
                    <div>
                      <nav class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                        <button
                          :disabled="currentPage === 1"
                          class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                          @click="currentPage--"
                        >
                          <ChevronLeft class="h-5 w-5" />
                        </button>
                        <button
                          v-for="page in visiblePages"
                          :key="page"
                          :class="[
                            'relative inline-flex items-center px-4 py-2 border text-sm font-medium',
                            page === currentPage
                              ? 'z-10 bg-blue-50 dark:bg-blue-900 border-blue-500 text-blue-600 dark:text-blue-400'
                              : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600'
                          ]"
                          @click="currentPage = page"
                        >
                          {{ page }}
                        </button>
                        <button
                          :disabled="currentPage === totalPages"
                          class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                          @click="currentPage++"
                        >
                          <ChevronRight class="h-5 w-5" />
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Host Comparison Tab -->
            <div v-else-if="activeTab === 'comparison'" class="space-y-6">
              <div class="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
                <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 class="text-lg font-medium text-gray-900 dark:text-white">Advanced Host Comparison</h3>
                  <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Side-by-side performance comparison across selected hosts
                  </p>
                </div>
                <div class="p-6">
                  <div v-if="selectedHosts.length < 2" class="text-center py-12">
                    <Users class="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                      Select at least 2 hosts to enable comparison view
                    </p>
                  </div>
                  <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div v-for="host in selectedHosts" :key="host" class="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <h4 class="text-lg font-medium text-gray-900 dark:text-white mb-4">{{ host }}</h4>
                      <div class="space-y-3">
                        <div v-for="metric in hostMetrics[host]" :key="metric.name">
                          <div class="flex justify-between text-sm">
                            <span class="text-gray-600 dark:text-gray-400">{{ metric.name }}</span>
                            <span class="font-medium text-gray-900 dark:text-gray-100">{{ metric.value }}</span>
                          </div>
                          <div class="mt-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              class="bg-blue-600 h-2 rounded-full"
                              :style="{ width: `${metric.percentage}%` }"
                            ></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { RefreshCw, BarChart3, History, Users, Server, ChevronLeft, ChevronRight } from 'lucide-vue-next'
import HostSelector from '@/components/filters/HostSelector.vue'
import FilterSidebar from '@/components/filters/FilterSidebar.vue'
import ActiveFilters from '@/components/filters/ActiveFilters.vue'
import VisualizationTabs from '@/components/charts/VisualizationTabs.vue'
import { useApi } from '@/composables/useApi'
import { useFilters } from '@/composables/useFilters'
import { useHostSelection } from '@/composables/useHostSelection'
import type { TestRun } from '@/types/testRun'

// Composables
const { fetchWithErrorHandling } = useApi()
const { activeFilters, filterOptions, hasActiveFilters, clearAllFilters, filterTestRuns } = useFilters()
const { selectedHosts, availableHosts, persistSelection } = useHostSelection()

// Component state
const isRefreshing = ref(false)
const activeTab = ref('analytics')
const testData = ref<TestRun[]>([])
const currentPage = ref(1)
const itemsPerPage = 25

// Analysis tabs configuration
const analysisTabs = [
  { id: 'analytics', name: 'Performance Analytics', icon: BarChart3, count: null },
  { id: 'history', name: 'Test History', icon: History, count: computed(() => filteredTestData.value.length) },
  { id: 'comparison', name: 'Advanced Host Comparison', icon: Users, count: selectedHosts.value.length }
]

// Computed properties
const selectedHostsCount = computed(() => selectedHosts.value.length)

const filteredTestData = computed(() => {
  let data = testData.value

  // Filter by selected hosts first
  if (selectedHosts.value.length > 0) {
    data = data.filter(test => selectedHosts.value.includes(test.hostname))
  }

  // Apply active filters using the useFilters composable
  data = filterTestRuns(data)

  return data
})

const totalTests = computed(() => filteredTestData.value.length)

const dateRange = computed(() => {
  if (filteredTestData.value.length === 0) return 'No data'

  const dates = filteredTestData.value.map(t => new Date(t.timestamp)).sort()
  const start = dates[0]
  const end = dates[dates.length - 1]

  if (start.toDateString() === end.toDateString()) {
    return start.toLocaleDateString()
  }
  return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`
})

const configurationsCount = computed(() => {
  const configs = new Set(filteredTestData.value.map(t => `${t.block_size}-${t.read_write_pattern}-${t.queue_depth}`))
  return configs.size
})

const paginatedTestHistory = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return filteredTestData.value
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(start, end)
})

const totalPages = computed(() => Math.ceil(filteredTestData.value.length / itemsPerPage))

const visiblePages = computed(() => {
  const total = totalPages.value
  const current = currentPage.value
  const pages = []

  if (total <= 7) {
    for (let i = 1; i <= total; i++) {
      pages.push(i)
    }
  } else {
    if (current <= 4) {
      for (let i = 1; i <= 5; i++) {
        pages.push(i)
      }
      pages.push('...', total)
    } else if (current >= total - 3) {
      pages.push(1, '...')
      for (let i = total - 4; i <= total; i++) {
        pages.push(i)
      }
    } else {
      pages.push(1, '...')
      for (let i = current - 1; i <= current + 1; i++) {
        pages.push(i)
      }
      pages.push('...', total)
    }
  }

  return pages.filter(p => typeof p === 'number')
})

const hostMetrics = computed(() => {
  const metrics: Record<string, Array<{ name: string; value: string; percentage: number }>> = {}

  selectedHosts.value.forEach(host => {
    const hostData = filteredTestData.value.filter(t => t.hostname === host)
    if (hostData.length === 0) {
      metrics[host] = []
      return
    }

    const avgIOPS = hostData.reduce((sum, t) => sum + t.iops, 0) / hostData.length
    const avgLatency = hostData.reduce((sum, t) => sum + t.avg_latency, 0) / hostData.length
    const avgBandwidth = hostData.reduce((sum, t) => sum + t.bandwidth, 0) / hostData.length

    // Calculate percentages relative to max values across all hosts
    const maxIOPS = Math.max(...Object.values(metrics).flat().map(m => parseFloat(m.value) || 0), avgIOPS)
    const maxBandwidth = Math.max(...Object.values(metrics).flat().map(m => parseFloat(m.value) || 0), avgBandwidth)
    const minLatency = Math.min(...filteredTestData.value.map(t => t.avg_latency))

    metrics[host] = [
      {
        name: 'Average IOPS',
        value: formatNumber(avgIOPS),
        percentage: (avgIOPS / maxIOPS) * 100
      },
      {
        name: 'Average Latency',
        value: `${avgLatency.toFixed(3)}ms`,
        percentage: minLatency > 0 ? ((minLatency / avgLatency) * 100) : 0 // Lower is better for latency
      },
      {
        name: 'Average Bandwidth',
        value: `${formatNumber(avgBandwidth)} MB/s`,
        percentage: (avgBandwidth / maxBandwidth) * 100
      },
      {
        name: 'Test Count',
        value: hostData.length.toString(),
        percentage: (hostData.length / filteredTestData.value.length) * 100
      }
    ]
  })

  return metrics
})

// Methods
const formatDate = (timestamp: string) => {
  return new Date(timestamp).toLocaleString()
}

const formatNumber = (value: number) => {
  return new Intl.NumberFormat().format(Math.round(value))
}

const refreshAnalysis = async () => {
  isRefreshing.value = true
  try {
    await loadTestData()
  } finally {
    isRefreshing.value = false
  }
}

const loadTestData = async () => {
  try {
    const response = await fetchWithErrorHandling('/api/test-runs/', {
      params: {
        limit: 10000 // Load more data for analysis
      }
    })
    if (response) {
      testData.value = response
    }
  } catch (error) {
    console.error('Failed to load test data:', error)
    testData.value = []
  }
}

// Watch for host selection changes and persist them
watch(selectedHosts, (newHosts) => {
  persistSelection(newHosts)
  // Reset pagination when hosts change
  currentPage.value = 1
}, { deep: true })

// Watch for filter changes and reset pagination
watch(activeFilters, () => {
  currentPage.value = 1
}, { deep: true })

// Lifecycle
onMounted(async () => {
  await loadTestData()

  // Load filter options
  try {
    const response = await fetchWithErrorHandling('/api/filters/')
    if (response) {
      filterOptions.value = response
    }
  } catch (error) {
    console.error('Failed to load filter options:', error)
  }
})
</script>