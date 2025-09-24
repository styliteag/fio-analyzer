<template>
  <div class="test-runs-page">
    <div class="page-header">
      <h1 class="text-3xl font-bold text-gray-900">Test Runs</h1>
      <p class="text-gray-600 mt-2">Performance benchmark results and analysis</p>
    </div>

    <div class="page-content">
      <!-- Filters Section -->
      <div class="filters-section mb-6">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Hostname</label>
            <select
              v-model="filters.hostname"
              class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              @change="applyFilters"
            >
              <option value="">All Hosts</option>
              <option v-for="hostname in uniqueHostnames" :key="hostname" :value="hostname">
                {{ hostname }}
              </option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Drive Type</label>
            <select
              v-model="filters.driveType"
              class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              @change="applyFilters"
            >
              <option value="">All Drive Types</option>
              <option v-for="driveType in uniqueDriveTypes" :key="driveType" :value="driveType">
                {{ driveType }}
              </option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Test Name</label>
            <select
              v-model="filters.pattern"
              class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              @change="applyFilters"
            >
              <option value="">All Tests</option>
              <option v-for="testName in uniqueTestNames" :key="testName" :value="testName">
                {{ testName }}
              </option>
            </select>
          </div>
        </div>
        <div class="mt-4 flex justify-between items-center">
          <button
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            @click="clearFilters"
          >
            Clear Filters
          </button>
          <button
            :disabled="loading"
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
            @click="refreshData"
          >
            {{ loading ? 'Refreshing...' : 'Refresh Data' }}
          </button>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="loading-state">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p class="text-center text-gray-600 mt-2">Loading test runs...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="error-state">
        <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {{ error }}
        </div>
      </div>

      <!-- Data Table -->
      <div v-else class="data-section">
        <div class="flex justify-between items-center mb-4">
          <div class="text-sm text-gray-500">
            Showing {{ pagedTestRuns.length }} of {{ testRuns.length }} test runs
          </div>
          <PaginationControls
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            :total-items="testRuns.length"
            class="text-sm"
          />
        </div>

        <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
          <table class="min-w-full divide-y divide-gray-300">
            <thead class="bg-gray-50">
              <tr>
                <th class="table-header">Host</th>
                <th class="table-header">Drive Type</th>
                <th class="table-header">Test Name</th>
                <th class="table-header">Pattern</th>
                <th class="table-header">Date</th>
                <th class="table-header">IOPS</th>
                <th class="table-header">Avg Latency</th>
                <th class="table-header">Bandwidth (MB/s)</th>
                <th class="table-header">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 bg-white">
              <tr v-for="testRun in pagedTestRuns" :key="testRun.id" class="hover:bg-gray-50">
                <td class="table-cell font-medium text-gray-900">{{ testRun.hostname ?? 'Unknown' }}</td>
                <td class="table-cell">{{ testRun.drive_type ?? '—' }}</td>
                <td class="table-cell">{{ testRun.test_name ?? '—' }}</td>
                <td class="table-cell">{{ testRun.read_write_pattern ?? '—' }}</td>
                <td class="table-cell">{{ formatDate(testRun.timestamp) }}</td>
                <td class="table-cell">{{ formatNumber(testRun.iops) }}</td>
                <td class="table-cell">{{ formatLatency(testRun.avg_latency) }}</td>
                <td class="table-cell">{{ formatNumber(testRun.bandwidth) }}</td>
                <td class="table-cell">
                  <button
                    class="text-blue-600 hover:text-blue-900 text-sm font-medium"
                    @click="viewDetails(testRun)"
                  >
                    View Details
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Bottom Pagination -->
        <div class="mt-4 flex justify-center">
          <PaginationControls
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            :total-items="testRuns.length"
            :show-page-info="true"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useTestRuns } from '@/composables/useTestRuns'
import { useErrorHandler } from '@/composables/useErrorHandler'
import PaginationControls from '@/components/PaginationControls.vue'
import type { TestRun, TestRunFilters } from '@/types'

const router = useRouter()
const {
  testRuns,
  loading,
  error,
  fetchTestRuns,
  fetchFilterOptions,
  getUniqueHostnames,
  getUniqueDriveTypes,
  getUniqueTestTypes,
} = useTestRuns()
const { handleApiError } = useErrorHandler()

// Pagination
const currentPage = ref(1)
const pageSize = ref(20)

// Filters
const filters = ref({
  hostname: '',
  driveType: '',
  pattern: '',
})

// Computed properties
const uniqueHostnames = getUniqueHostnames
const uniqueDriveTypes = getUniqueDriveTypes
const uniqueTestNames = getUniqueTestTypes

const pagedTestRuns = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return testRuns.value.slice(start, end)
})

// Methods
const applyFilters = async () => {
  currentPage.value = 1
  const activeFilters: TestRunFilters = {}

  if (filters.value.hostname) activeFilters.hostnames = [filters.value.hostname]
  if (filters.value.driveType) activeFilters.drive_types = [filters.value.driveType]
  if (filters.value.pattern) activeFilters.patterns = [filters.value.pattern]

  try {
    await fetchTestRuns(activeFilters)
  } catch (err) {
    handleApiError(err)
  }
}

const clearFilters = () => {
  filters.value = {
    hostname: '',
    driveType: '',
    pattern: '',
  }
  applyFilters()
}

const refreshData = async () => {
  try {
    await Promise.all([fetchTestRuns(), fetchFilterOptions()])
  } catch (err) {
    handleApiError(err)
  }
}

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString()
}

const formatNumber = (num: number | null | undefined): string => {
  if (num === null || num === undefined) return '—'
  return Number.isFinite(num) ? num.toLocaleString() : '—'
}

const formatLatency = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—'
  }
  return `${value.toFixed(2)} ms`
}

const viewDetails = (testRun: TestRun) => {
  if (!testRun.hostname) return
  router.push(`/host?hostname=${encodeURIComponent(testRun.hostname)}`)
}

// Lifecycle
onMounted(() => {
  refreshData()
})

// Reset page when filters change
watch(() => [filters.value.hostname, filters.value.driveType, filters.value.pattern], () => {
  currentPage.value = 1
})
</script>

<style scoped>
.test-runs-page {
  @apply min-h-screen bg-gray-50 p-6;
}

.page-header {
  @apply mb-8;
}

.page-content {
  @apply max-w-7xl mx-auto;
}

.filters-section {
  @apply bg-white rounded-lg border border-gray-200 p-6;
}

.loading-state,
.error-state {
  @apply text-center py-12;
}

.data-section {
  @apply bg-white rounded-lg border border-gray-200 p-6;
}

.table-header {
  @apply px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider;
}

.table-cell {
  @apply px-6 py-4 whitespace-nowrap text-sm text-gray-500;
}
</style>

