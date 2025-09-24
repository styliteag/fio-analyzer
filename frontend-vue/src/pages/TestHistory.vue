<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Header Section -->
    <div class="bg-white dark:bg-gray-800 shadow-sm">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Test History</h1>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Complete chronological view of all FIO performance test runs
            </p>
          </div>
          <div class="flex items-center space-x-3">
            <div class="text-sm text-gray-600 dark:text-gray-300">
              {{ filteredTests.length }} of {{ totalTests }} tests
            </div>
            <button
              class="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              @click="exportHistory"
            >
              <Download class="w-4 h-4 mr-2" />
              Export
            </button>
            <button
              :disabled="isRefreshing"
              class="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              @click="refreshHistory"
            >
              <RefreshCw v-if="isRefreshing" class="animate-spin w-4 h-4 mr-2" />
              <RefreshCw v-else class="w-4 h-4 mr-2" />
              {{ isRefreshing ? 'Refreshing...' : 'Refresh' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="flex flex-col lg:flex-row gap-8">
        <!-- Filters Sidebar -->
        <div class="lg:w-80 space-y-6">
          <!-- Date Range Filter -->
          <div class="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
            <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 class="text-lg font-medium text-gray-900 dark:text-white">Date Range</h3>
            </div>
            <div class="p-6 space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  From Date
                </label>
                <input
                  v-model="dateFilters.from"
                  type="date"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  To Date
                </label>
                <input
                  v-model="dateFilters.to"
                  type="date"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <button
                class="w-full px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                @click="clearDateFilters"
              >
                Clear Dates
              </button>
            </div>
          </div>

          <!-- Quick Filters -->
          <div class="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
            <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 class="text-lg font-medium text-gray-900 dark:text-white">Quick Filters</h3>
            </div>
            <div class="p-6 space-y-3">
              <button
                v-for="filter in quickFilters"
                :key="filter.id"
                class="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                @click="applyQuickFilter(filter)"
              >
                {{ filter.name }}
                <span class="text-xs text-gray-500 dark:text-gray-400 block">
                  {{ filter.description }}
                </span>
              </button>
            </div>
          </div>

          <!-- Advanced Filters -->
          <div class="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
            <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 class="text-lg font-medium text-gray-900 dark:text-white">Filters</h3>
            </div>
            <div class="p-6 space-y-4">
              <!-- Host Filter -->
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Hosts
                </label>
                <select
                  v-model="filters.hostname"
                  multiple
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option v-for="hostname in availableHostnames" :key="hostname" :value="hostname">
                    {{ hostname }}
                  </option>
                </select>
              </div>

              <!-- Test Name Filter -->
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Test Name
                </label>
                <input
                  v-model="filters.testName"
                  type="text"
                  placeholder="Filter by test name..."
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                />
              </div>

              <!-- Drive Type Filter -->
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Drive Type
                </label>
                <select
                  v-model="filters.driveType"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">All Types</option>
                  <option v-for="type in availableDriveTypes" :key="type" :value="type">
                    {{ type }}
                  </option>
                </select>
              </div>

              <!-- Clear Filters -->
              <button
                class="w-full px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-md"
                @click="clearFilters"
              >
                Clear All Filters
              </button>
            </div>
          </div>

          <!-- Statistics -->
          <div class="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
            <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 class="text-lg font-medium text-gray-900 dark:text-white">Statistics</h3>
            </div>
            <div class="p-6 space-y-3">
              <div class="flex justify-between">
                <span class="text-sm text-gray-600 dark:text-gray-400">Total Tests</span>
                <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ totalTests }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-sm text-gray-600 dark:text-gray-400">Filtered Tests</span>
                <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ filteredTests.length }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-sm text-gray-600 dark:text-gray-400">Unique Hosts</span>
                <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ uniqueHosts }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-sm text-gray-600 dark:text-gray-400">Date Range</span>
                <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ displayDateRange }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Main History Table -->
        <div class="flex-1">
          <div class="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
            <!-- Table Header -->
            <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div class="flex items-center justify-between">
                <h3 class="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                  Test History
                </h3>
                <div class="flex items-center space-x-3">
                  <!-- Sort Options -->
                  <select
                    v-model="sortBy"
                    class="text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="timestamp">Sort by Date</option>
                    <option value="hostname">Sort by Host</option>
                    <option value="test_name">Sort by Test</option>
                    <option value="iops">Sort by IOPS</option>
                    <option value="avg_latency">Sort by Latency</option>
                  </select>
                  <button
                    class="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    @click="toggleSortOrder"
                  >
                    <ArrowUpDown class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Search Bar -->
            <div class="px-6 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <div class="relative">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search class="h-5 w-5 text-gray-400 dark:text-gray-500" />
                </div>
                <input
                  v-model="searchQuery"
                  type="text"
                  class="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 pr-3 py-2 sm:text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  placeholder="Search test history..."
                />
              </div>
            </div>

            <!-- Table -->
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead class="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th
                      v-for="column in tableColumns"
                      :key="column.key"
                      class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-300"
                      @click="setSortBy(column.key)"
                    >
                      <div class="flex items-center space-x-1">
                        <span>{{ column.name }}</span>
                        <ArrowUpDown v-if="sortBy === column.key" class="w-3 h-3" />
                      </div>
                    </th>
                    <th class="relative px-6 py-3">
                      <span class="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  <tr
                    v-for="test in paginatedTests"
                    :key="test.id"
                    class="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                    @click="viewTestDetails(test)"
                  >
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
                      {{ test.drive_type }}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {{ test.block_size }}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {{ test.read_write_pattern }}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900 dark:text-gray-100">
                      {{ formatNumber(test.iops) }}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900 dark:text-gray-100">
                      {{ test.avg_latency.toFixed(3) }}ms
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900 dark:text-gray-100">
                      {{ formatNumber(test.bandwidth) }} MB/s
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        class="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                        @click.stop="viewTestDetails(test)"
                      >
                        <ExternalLink class="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                  <tr v-if="paginatedTests.length === 0">
                    <td colspan="10" class="px-6 py-12 text-center">
                      <Database class="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
                      <p class="text-sm text-gray-500 dark:text-gray-400">
                        {{ searchQuery || hasActiveFilters ? 'No tests match your search criteria' : 'No test history available' }}
                      </p>
                      <p v-if="searchQuery || hasActiveFilters" class="text-xs text-gray-400 dark:text-gray-500 mt-2">
                        Try adjusting your search or filters
                      </p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Pagination -->
            <div
              v-if="totalPages > 1"
              class="bg-white dark:bg-gray-800 px-6 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700"
            >
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
                    Showing {{ startIndex }} to {{ endIndex }} of {{ filteredTests.length }} results
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
      </div>
    </div>

    <!-- Test Details Modal -->
    <div
      v-if="selectedTest"
      class="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75 flex items-center justify-center z-50"
      @click="selectedTest = null"
    >
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" @click.stop>
        <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white">Test Details</h3>
            <button
              class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              @click="selectedTest = null"
            >
              <X class="h-6 w-6" />
            </button>
          </div>
        </div>
        <div class="px-6 py-4 space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div v-for="(value, key) in selectedTestDetails" :key="key" class="flex justify-between">
              <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">{{ formatFieldName(key) }}:</dt>
              <dd class="text-sm text-gray-900 dark:text-gray-100 font-mono">{{ value }}</dd>
            </div>
          </div>
        </div>
        <div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md"
            @click="selectedTest = null"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  Download, RefreshCw, ArrowUpDown, Search, ExternalLink, Database, ChevronLeft, ChevronRight, X
} from 'lucide-vue-next'
import { useApi } from '@/composables/useApi'
import type { TestRun } from '@/types/testRun'

// Composables
const { fetchWithErrorHandling } = useApi()

// Component state
const tests = ref<TestRun[]>([])
const isRefreshing = ref(false)
const searchQuery = ref('')
const selectedTest = ref<TestRun | null>(null)
const currentPage = ref(1)
const itemsPerPage = 50

// Filter state
const filters = ref({
  hostname: [] as string[],
  testName: '',
  driveType: ''
})

const dateFilters = ref({
  from: '',
  to: ''
})

// Sort state
const sortBy = ref<keyof TestRun>('timestamp')
const sortOrder = ref<'asc' | 'desc'>('desc')

// Quick filters
const quickFilters = [
  { id: 'today', name: 'Today', description: 'Tests from today' },
  { id: 'week', name: 'This Week', description: 'Tests from last 7 days' },
  { id: 'month', name: 'This Month', description: 'Tests from last 30 days' },
  { id: 'latest', name: 'Latest Only', description: 'Show only latest tests per host' },
  { id: 'high-iops', name: 'High IOPS', description: 'Tests with IOPS > 100k' }
]

// Table columns
const tableColumns = [
  { key: 'timestamp' as keyof TestRun, name: 'Date' },
  { key: 'hostname' as keyof TestRun, name: 'Host' },
  { key: 'test_name' as keyof TestRun, name: 'Test' },
  { key: 'drive_type' as keyof TestRun, name: 'Drive Type' },
  { key: 'block_size' as keyof TestRun, name: 'Block Size' },
  { key: 'read_write_pattern' as keyof TestRun, name: 'Pattern' },
  { key: 'iops' as keyof TestRun, name: 'IOPS' },
  { key: 'avg_latency' as keyof TestRun, name: 'Latency' },
  { key: 'bandwidth' as keyof TestRun, name: 'Bandwidth' }
]

// Computed properties
const availableHostnames = computed(() => {
  return [...new Set(tests.value.map(t => t.hostname))].sort()
})

const availableDriveTypes = computed(() => {
  return [...new Set(tests.value.map(t => t.drive_type))].sort()
})

const totalTests = computed(() => tests.value.length)

const hasActiveFilters = computed(() => {
  return filters.value.hostname.length > 0 ||
         filters.value.testName !== '' ||
         filters.value.driveType !== '' ||
         dateFilters.value.from !== '' ||
         dateFilters.value.to !== '' ||
         searchQuery.value !== ''
})

const filteredTests = computed(() => {
  let filtered = tests.value

  // Apply search query
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(test =>
      test.hostname.toLowerCase().includes(query) ||
      test.test_name.toLowerCase().includes(query) ||
      test.drive_type.toLowerCase().includes(query) ||
      test.drive_model.toLowerCase().includes(query)
    )
  }

  // Apply hostname filter
  if (filters.value.hostname.length > 0) {
    filtered = filtered.filter(test => filters.value.hostname.includes(test.hostname))
  }

  // Apply test name filter
  if (filters.value.testName) {
    const testName = filters.value.testName.toLowerCase()
    filtered = filtered.filter(test => test.test_name.toLowerCase().includes(testName))
  }

  // Apply drive type filter
  if (filters.value.driveType) {
    filtered = filtered.filter(test => test.drive_type === filters.value.driveType)
  }

  // Apply date filters
  if (dateFilters.value.from) {
    filtered = filtered.filter(test => new Date(test.timestamp) >= new Date(dateFilters.value.from))
  }
  if (dateFilters.value.to) {
    filtered = filtered.filter(test => new Date(test.timestamp) <= new Date(dateFilters.value.to))
  }

  // Apply sorting
  filtered.sort((a, b) => {
    const aVal = a[sortBy.value]
    const bVal = b[sortBy.value]

    let comparison = 0
    if (aVal < bVal) comparison = -1
    if (aVal > bVal) comparison = 1

    return sortOrder.value === 'desc' ? -comparison : comparison
  })

  return filtered
})

const uniqueHosts = computed(() => {
  return new Set(filteredTests.value.map(t => t.hostname)).size
})

const displayDateRange = computed(() => {
  if (filteredTests.value.length === 0) return 'No data'

  const dates = filteredTests.value.map(t => new Date(t.timestamp)).sort()
  const start = dates[0]
  const end = dates[dates.length - 1]

  if (start.toDateString() === end.toDateString()) {
    return start.toLocaleDateString()
  }
  return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`
})

const totalPages = computed(() => Math.ceil(filteredTests.value.length / itemsPerPage))

const startIndex = computed(() => ((currentPage.value - 1) * itemsPerPage) + 1)
const endIndex = computed(() => Math.min(currentPage.value * itemsPerPage, filteredTests.value.length))

const paginatedTests = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return filteredTests.value.slice(start, end)
})

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
      if (total > 5) pages.push('...', total)
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

const selectedTestDetails = computed(() => {
  if (!selectedTest.value) return {}

  const test = selectedTest.value
  return {
    id: test.id,
    timestamp: formatDate(test.timestamp),
    hostname: test.hostname,
    test_name: test.test_name,
    description: test.description || 'N/A',
    drive_model: test.drive_model,
    drive_type: test.drive_type,
    protocol: test.protocol,
    block_size: test.block_size,
    read_write_pattern: test.read_write_pattern,
    queue_depth: test.queue_depth,
    duration: `${test.duration}s`,
    num_jobs: test.num_jobs,
    direct: test.direct ? 'Yes' : 'No',
    sync: test.sync ? 'Yes' : 'No',
    test_size: test.test_size,
    iops: formatNumber(test.iops),
    avg_latency: `${test.avg_latency.toFixed(3)}ms`,
    bandwidth: `${formatNumber(test.bandwidth)} MB/s`,
    p95_latency: test.p95_latency ? `${test.p95_latency.toFixed(3)}ms` : 'N/A',
    p99_latency: test.p99_latency ? `${test.p99_latency.toFixed(3)}ms` : 'N/A',
    fio_version: test.fio_version || 'N/A',
    job_runtime: test.job_runtime ? `${test.job_runtime}ms` : 'N/A'
  }
})

// Methods
const formatDate = (timestamp: string) => {
  return new Date(timestamp).toLocaleString()
}

const formatNumber = (value: number) => {
  return new Intl.NumberFormat().format(Math.round(value))
}

const formatFieldName = (key: string) => {
  return key.replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

const loadTestHistory = async () => {
  try {
    const response = await fetchWithErrorHandling('/api/test-runs/', {
      params: {
        limit: 10000 // Load all historical data
      }
    })
    if (response) {
      tests.value = response
    }
  } catch (error) {
    console.error('Failed to load test history:', error)
    tests.value = []
  }
}

const refreshHistory = async () => {
  isRefreshing.value = true
  try {
    await loadTestHistory()
  } finally {
    isRefreshing.value = false
  }
}

const exportHistory = () => {
  const csvData = filteredTests.value.map(test => ({
    Date: formatDate(test.timestamp),
    Host: test.hostname,
    Test: test.test_name,
    DriveType: test.drive_type,
    BlockSize: test.block_size,
    Pattern: test.read_write_pattern,
    IOPS: test.iops,
    Latency: test.avg_latency,
    Bandwidth: test.bandwidth
  }))

  const csvContent = [
    Object.keys(csvData[0]).join(','),
    ...csvData.map(row => Object.values(row).join(','))
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `test-history-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  window.URL.revokeObjectURL(url)
}

const applyQuickFilter = (filter: typeof quickFilters[0]) => {
  const now = new Date()

  switch (filter.id) {
    case 'today':
      dateFilters.value.from = now.toISOString().split('T')[0]
      dateFilters.value.to = now.toISOString().split('T')[0]
      break
    case 'week': {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      dateFilters.value.from = weekAgo.toISOString().split('T')[0]
      dateFilters.value.to = now.toISOString().split('T')[0]
      break
    }
    case 'month': {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      dateFilters.value.from = monthAgo.toISOString().split('T')[0]
      dateFilters.value.to = now.toISOString().split('T')[0]
      break
    }
    case 'latest':
      // This would require backend support for latest-only filtering
      console.log('Latest only filter - would need backend support')
      break
    case 'high-iops':
      // This would require adding IOPS range filtering
      console.log('High IOPS filter - would need range filtering')
      break
  }

  currentPage.value = 1
}

const clearFilters = () => {
  filters.value = {
    hostname: [],
    testName: '',
    driveType: ''
  }
  searchQuery.value = ''
  currentPage.value = 1
}

const clearDateFilters = () => {
  dateFilters.value = {
    from: '',
    to: ''
  }
  currentPage.value = 1
}

const setSortBy = (column: keyof TestRun) => {
  if (sortBy.value === column) {
    toggleSortOrder()
  } else {
    sortBy.value = column
    sortOrder.value = 'desc'
  }
}

const toggleSortOrder = () => {
  sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
}

const viewTestDetails = (test: TestRun) => {
  selectedTest.value = test
}

// Lifecycle
onMounted(async () => {
  await loadTestHistory()
})
</script>