<template>
  <div class="filters-page">
    <div class="page-header">
      <h1 class="text-3xl font-bold text-gray-900">Advanced Filters</h1>
      <p class="text-gray-600 mt-2">Configure detailed filters for performance analysis</p>
    </div>

    <div class="page-content">
      <!-- Loading State -->
      <div v-if="loading" class="loading-state">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p class="text-center text-gray-600 mt-2">Loading filter options...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="error-state">
        <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {{ error }}
        </div>
      </div>

      <!-- Filters Section -->
      <div v-else class="filters-section">
        <!-- Current Filter Summary -->
        <div class="current-filters mb-6">
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 class="text-lg font-semibold text-blue-900 mb-2">Current Filter Selection</h3>
            <p class="text-blue-700">{{ summary }}</p>
            <div class="mt-3 flex space-x-2">
              <button
                class="px-3 py-1 text-sm font-medium text-blue-700 bg-blue-100 border border-blue-300 rounded-md hover:bg-blue-200"
                @click="clearAllFilters"
              >
                Clear All
              </button>
              <button
                class="px-3 py-1 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                @click="resetToDefaults"
              >
                Reset to Defaults
              </button>
            </div>
          </div>
        </div>

        <!-- Filter Categories -->
        <div class="filter-categories space-y-6">
          <!-- Hardware Filters -->
          <div class="filter-category">
            <div class="bg-white rounded-lg border border-gray-200 p-6">
              <h3 class="text-lg font-semibold text-gray-900 mb-4">Hardware Configuration</h3>
              <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Host</label>
                  <select
                    v-model="selectedFilters.hostname"
                    class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    @change="onFilterChange"
                  >
                    <option value="">All Hosts</option>
                    <option v-for="hostname in availableOptions.hostnames" :key="hostname" :value="hostname">
                      {{ hostname }}
                    </option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Drive Type</label>
                  <select
                    v-model="selectedFilters.drive_type"
                    class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    @change="onFilterChange"
                  >
                    <option value="">All Drive Types</option>
                    <option v-for="driveType in availableOptions.drive_types" :key="driveType" :value="driveType">
                      {{ driveType }}
                    </option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Drive Model</label>
                  <select
                    v-model="selectedFilters.drive_model"
                    class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    @change="onFilterChange"
                  >
                    <option value="">All Drive Models</option>
                    <option v-for="driveModel in availableOptions.drive_models" :key="driveModel" :value="driveModel">
                      {{ driveModel }}
                    </option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Protocol</label>
                  <select
                    v-model="selectedFilters.protocol"
                    class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    @change="onFilterChange"
                  >
                    <option value="">All Protocols</option>
                    <option v-for="protocol in availableOptions.protocols" :key="protocol" :value="protocol">
                      {{ protocol }}
                    </option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <!-- Test Configuration Filters -->
          <div class="filter-category">
            <div class="bg-white rounded-lg border border-gray-200 p-6">
              <h3 class="text-lg font-semibold text-gray-900 mb-4">Test Configuration</h3>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Test Type</label>
                  <select
                    v-model="selectedFilters.test_type"
                    class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    @change="onFilterChange"
                  >
                    <option value="">All Test Types</option>
                    <option v-for="testType in availableOptions.test_types" :key="testType" :value="testType">
                      {{ testType }}
                    </option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">I/O Pattern</label>
                  <select
                    v-model="selectedFilters.read_write_pattern"
                    class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    @change="onFilterChange"
                  >
                    <option value="">All Patterns</option>
                    <option v-for="pattern in availableOptions.read_write_patterns" :key="pattern" :value="pattern">
                      {{ pattern }}
                    </option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Block Size</label>
                  <select
                    v-model="selectedFilters.block_size"
                    class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    @change="onFilterChange"
                  >
                    <option value="">All Block Sizes</option>
                    <option v-for="blockSize in availableOptions.block_sizes" :key="blockSize" :value="blockSize">
                      {{ blockSize }}
                    </option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <!-- Performance Range Filters -->
          <div class="filter-category">
            <div class="bg-white rounded-lg border border-gray-200 p-6">
              <h3 class="text-lg font-semibold text-gray-900 mb-4">Performance Ranges</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">IOPS Range</label>
                  <div class="flex space-x-2">
                    <input
                      v-model.number="performanceRanges.iops.min"
                      type="number"
                      placeholder="Min IOPS"
                      class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      @input="onPerformanceRangeChange"
                    />
                    <span class="self-center text-gray-500">to</span>
                    <input
                      v-model.number="performanceRanges.iops.max"
                      type="number"
                      placeholder="Max IOPS"
                      class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      @input="onPerformanceRangeChange"
                    />
                  </div>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Latency Range (ms)</label>
                  <div class="flex space-x-2">
                    <input
                      v-model.number="performanceRanges.latency.min"
                      type="number"
                      step="0.1"
                      placeholder="Min Latency"
                      class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      @input="onPerformanceRangeChange"
                    />
                    <span class="self-center text-gray-500">to</span>
                    <input
                      v-model.number="performanceRanges.latency.max"
                      type="number"
                      step="0.1"
                      placeholder="Max Latency"
                      class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      @input="onPerformanceRangeChange"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Date Range Filter -->
          <div class="filter-category">
            <div class="bg-white rounded-lg border border-gray-200 p-6">
              <h3 class="text-lg font-semibold text-gray-900 mb-4">Date Range</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                  <input
                    v-model="dateRange.from"
                    type="date"
                    class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    @change="onDateRangeChange"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                  <input
                    v-model="dateRange.to"
                    type="date"
                    class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    @change="onDateRangeChange"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="action-buttons mt-8 flex justify-between items-center">
          <div class="filter-stats text-sm text-gray-600">
            {{ matchingResults }} test runs match current filters
          </div>
          <div class="button-group flex space-x-3">
            <button
              :disabled="loading"
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              @click="previewResults"
            >
              Preview Results
            </button>
            <button
              class="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-100 border border-blue-300 rounded-md hover:bg-blue-200"
              @click="saveFilterPreset"
            >
              Save Preset
            </button>
            <button
              :disabled="loading"
              class="px-6 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
              @click="applyFilters"
            >
              {{ loading ? 'Applying...' : 'Apply Filters' }}
            </button>
          </div>
        </div>

        <!-- Filter Presets -->
        <div v-if="filterPresets.length > 0" class="filter-presets mt-6">
          <div class="bg-white rounded-lg border border-gray-200 p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Saved Filter Presets</h3>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="preset in filterPresets"
                :key="preset.name"
                class="px-3 py-1 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                @click="loadFilterPreset(preset)"
              >
                {{ preset.name }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useTestRuns } from '@/composables/useTestRuns'
import { useErrorHandler } from '@/composables/useErrorHandler'
import { apiClient } from '@/services/apiClient'
import type { TestRun, TestRunFilters, FilterOptions } from '@/types'

interface SelectedFilters {
  hostname: string
  drive_type: string
  drive_model: string
  test_type: string
  read_write_pattern: string
  block_size: string | number | ''
  protocol: string
}

interface RangeFilters {
  iops: { min: number | null; max: number | null }
  latency: { min: number | null; max: number | null }
}

interface FilterPreset {
  name: string
  selected: SelectedFilters
  performanceRanges: RangeFilters
  dateRange: { from: string; to: string }
}

interface ExtendedFilterOptions extends FilterOptions {
  test_types: string[]
  read_write_patterns: string[]
}

const router = useRouter()
const route = useRoute()
const { testRuns, loading, error, fetchTestRuns, getUniqueTestTypes } = useTestRuns()
const { handleApiError } = useErrorHandler()

const defaultSelected: SelectedFilters = {
  hostname: '',
  drive_type: '',
  drive_model: '',
  test_type: '',
  read_write_pattern: '',
  block_size: '',
  protocol: '',
}

const createDefaultRanges = (): RangeFilters => ({
  iops: { min: null, max: null },
  latency: { min: null, max: null },
})

const availableOptions = ref<ExtendedFilterOptions>({
  hostnames: [],
  drive_types: [],
  drive_models: [],
  patterns: [],
  block_sizes: [],
  syncs: [],
  queue_depths: [],
  directs: [],
  num_jobs: [],
  test_sizes: [],
  durations: [],
  host_disk_combinations: [],
  protocols: [],
  test_types: [],
  read_write_patterns: [],
})

const selectedFilters = ref<SelectedFilters>({ ...defaultSelected })
const performanceRanges = ref<RangeFilters>(createDefaultRanges())
const dateRange = ref({ from: '', to: '' })
const filterPresets = ref<FilterPreset[]>([])
const matchingResults = ref(0)

const summary = computed(() => {
  const activeFilters: string[] = []

  if (selectedFilters.value.hostname) activeFilters.push(`Host: ${selectedFilters.value.hostname}`)
  if (selectedFilters.value.drive_type) activeFilters.push(`Drive: ${selectedFilters.value.drive_type}`)
  if (selectedFilters.value.drive_model) activeFilters.push(`Model: ${selectedFilters.value.drive_model}`)
  if (selectedFilters.value.protocol) activeFilters.push(`Protocol: ${selectedFilters.value.protocol}`)
  if (selectedFilters.value.test_type) activeFilters.push(`Test: ${selectedFilters.value.test_type}`)
  if (selectedFilters.value.read_write_pattern) activeFilters.push(`Pattern: ${selectedFilters.value.read_write_pattern}`)
  if (selectedFilters.value.block_size) activeFilters.push(`Block: ${selectedFilters.value.block_size}`)

  if (performanceRanges.value.iops.min !== null || performanceRanges.value.iops.max !== null) {
    const min = performanceRanges.value.iops.min ?? '0'
    const max = performanceRanges.value.iops.max ?? '∞'
    activeFilters.push(`IOPS: ${min}-${max}`)
  }

  if (performanceRanges.value.latency.min !== null || performanceRanges.value.latency.max !== null) {
    const min = performanceRanges.value.latency.min ?? '0'
    const max = performanceRanges.value.latency.max ?? '∞'
    activeFilters.push(`Latency: ${min}-${max}ms`)
  }

  if (dateRange.value.from || dateRange.value.to) {
    const from = dateRange.value.from || 'beginning'
    const to = dateRange.value.to || 'now'
    activeFilters.push(`Date: ${from} to ${to}`)
  }

  return activeFilters.length > 0 ? activeFilters.join(', ') : 'No active filters'
})

const loadFilterOptions = async () => {
  try {
    await fetchTestRuns()

    const filterOptions = await apiClient.getFilterOptions()
    const derivedTestTypes = getUniqueTestTypes.value
    const derivedDriveModels = [...new Set(testRuns.value.map((run: TestRun) => run.drive_model).filter(Boolean))] as string[]
    const derivedPatterns = [...new Set(testRuns.value.map((run: TestRun) => run.read_write_pattern).filter(Boolean))] as string[]
    const derivedBlockSizes = [...new Set(testRuns.value.map((run: TestRun) => run.block_size).filter(Boolean))] as (string | number)[]

    const patterns = filterOptions.patterns.length ? filterOptions.patterns : derivedPatterns
    const blockSizes = filterOptions.block_sizes.length ? filterOptions.block_sizes : derivedBlockSizes

    const driveModels = filterOptions.drive_models.length ? filterOptions.drive_models : derivedDriveModels

    availableOptions.value = {
      ...filterOptions,
      drive_models: driveModels,
      test_types: derivedTestTypes,
      read_write_patterns: patterns,
      block_sizes: blockSizes,
    }
    availableOptions.value.patterns = patterns
  } catch (err) {
    handleApiError(err)
  }
}

const buildActiveFilters = (): TestRunFilters => {
  const filters: TestRunFilters = {}

  if (selectedFilters.value.hostname) filters.hostnames = [selectedFilters.value.hostname]
  if (selectedFilters.value.drive_type) filters.drive_types = [selectedFilters.value.drive_type]
  if (selectedFilters.value.drive_model) filters.drive_models = [selectedFilters.value.drive_model]
  if (selectedFilters.value.protocol) filters.protocols = [selectedFilters.value.protocol]
  if (selectedFilters.value.block_size) filters.block_sizes = [selectedFilters.value.block_size]

  const patternSelections = new Set<string>()
  if (selectedFilters.value.test_type) patternSelections.add(selectedFilters.value.test_type)
  if (selectedFilters.value.read_write_pattern) patternSelections.add(selectedFilters.value.read_write_pattern)
  if (patternSelections.size > 0) {
    filters.patterns = Array.from(patternSelections)
  }

  return filters
}

const buildQueryFromFilters = (filters: TestRunFilters): Record<string, string> => {
  const query: Record<string, string> = {}

  if (filters.hostnames?.length) query.hostnames = filters.hostnames.join(',')
  if (filters.drive_types?.length) query.drive_types = filters.drive_types.join(',')
  if (filters.drive_models?.length) query.drive_models = filters.drive_models.join(',')
  if (filters.protocols?.length) query.protocols = filters.protocols.join(',')
  if (filters.patterns?.length) query.patterns = filters.patterns.join(',')
  if (filters.block_sizes?.length) query.block_sizes = filters.block_sizes.map(String).join(',')

  return query
}

const updateMatchingResults = async () => {
  try {
    const filters = buildActiveFilters()
    const results = await fetchTestRuns(filters)
    matchingResults.value = results.length
  } catch (err) {
    matchingResults.value = 0
  }
}

const onFilterChange = () => {
  updateMatchingResults()
}

const onPerformanceRangeChange = () => {
  updateMatchingResults()
}

const onDateRangeChange = () => {
  updateMatchingResults()
}

const resetFiltersState = () => {
  selectedFilters.value = { ...defaultSelected }
  performanceRanges.value = createDefaultRanges()
  dateRange.value = { from: '', to: '' }
}

const clearAllFilters = () => {
  resetFiltersState()
  updateMatchingResults()
}

const resetToDefaults = () => {
  clearAllFilters()
}

const applyNavigation = (filters: TestRunFilters) => {
  const query = buildQueryFromFilters(filters)

  if (performanceRanges.value.iops.min !== null) query.iops_min = String(performanceRanges.value.iops.min)
  if (performanceRanges.value.iops.max !== null) query.iops_max = String(performanceRanges.value.iops.max)
  if (performanceRanges.value.latency.min !== null) query.latency_min = String(performanceRanges.value.latency.min)
  if (performanceRanges.value.latency.max !== null) query.latency_max = String(performanceRanges.value.latency.max)

  if (dateRange.value.from) query.date_from = dateRange.value.from
  if (dateRange.value.to) query.date_to = dateRange.value.to

  router.push({ path: '/test-runs', query })
}

const previewResults = async () => {
  try {
    const filters = buildActiveFilters()
    await fetchTestRuns(filters)
    applyNavigation(filters)
  } catch (err) {
    handleApiError(err)
  }
}

const applyFilters = async () => {
  try {
    const filters = buildActiveFilters()
    await fetchTestRuns(filters)
    applyNavigation(filters)
  } catch (err) {
    handleApiError(err)
  }
}

const saveFilterPreset = () => {
  const presetName = prompt('Enter a name for this filter preset:')
  if (!presetName) return

  const preset: FilterPreset = {
    name: presetName,
    selected: { ...selectedFilters.value },
    performanceRanges: { ...performanceRanges.value },
    dateRange: { ...dateRange.value },
  }

  filterPresets.value.push(preset)
  localStorage.setItem('filterPresets', JSON.stringify(filterPresets.value))
}

const loadFilterPreset = (preset: FilterPreset) => {
  selectedFilters.value = { ...preset.selected }
  performanceRanges.value = { ...preset.performanceRanges }
  dateRange.value = { ...preset.dateRange }
  updateMatchingResults()
}

const loadSavedPresets = () => {
  const saved = localStorage.getItem('filterPresets')
  if (!saved) return

  try {
    const parsed = JSON.parse(saved) as FilterPreset[]
    if (Array.isArray(parsed)) {
      filterPresets.value = parsed.map((preset) => ({
        name: preset.name,
        selected: { ...defaultSelected, ...preset.selected },
        performanceRanges: preset.performanceRanges ?? createDefaultRanges(),
        dateRange: preset.dateRange ?? { from: '', to: '' },
      }))
    }
  } catch (err) {
    console.error('Error loading filter presets:', err)
  }
}

const parseQueryValue = (value: string | string[] | undefined): string | undefined => {
  if (Array.isArray(value)) return value[0]
  return value
}

const parseQueryList = (value: string | string[] | undefined): string[] => {
  const raw = Array.isArray(value) ? value : value ? [value] : []
  return raw
    .flatMap((entry) => String(entry).split(','))
    .map((entry) => entry.trim())
    .filter(Boolean)
}

const initializeFromQuery = () => {
  const hostnames = parseQueryList(route.query.hostnames || route.query.hostname)
  selectedFilters.value.hostname = hostnames[0] || ''

  const driveTypes = parseQueryList(route.query.drive_types || route.query.drive_type)
  selectedFilters.value.drive_type = driveTypes[0] || ''

  const driveModels = parseQueryList(route.query.drive_models || route.query.drive_model)
  selectedFilters.value.drive_model = driveModels[0] || ''

  const protocols = parseQueryList(route.query.protocols || route.query.protocol)
  selectedFilters.value.protocol = protocols[0] || ''

  const patterns = parseQueryList(route.query.patterns || route.query.read_write_pattern)
  selectedFilters.value.read_write_pattern = patterns[0] || ''
  selectedFilters.value.test_type = patterns.length > 1 ? patterns[1] : selectedFilters.value.read_write_pattern

  const blockSizes = parseQueryList(route.query.block_sizes || route.query.block_size)
  selectedFilters.value.block_size = blockSizes[0] || ''

  const iopsMin = parseQueryValue(route.query.iops_min)
  const iopsMax = parseQueryValue(route.query.iops_max)
  performanceRanges.value.iops.min = iopsMin ? Number(iopsMin) : null
  performanceRanges.value.iops.max = iopsMax ? Number(iopsMax) : null

  const latencyMin = parseQueryValue(route.query.latency_min)
  const latencyMax = parseQueryValue(route.query.latency_max)
  performanceRanges.value.latency.min = latencyMin ? Number(latencyMin) : null
  performanceRanges.value.latency.max = latencyMax ? Number(latencyMax) : null

  const dateFrom = parseQueryValue(route.query.date_from)
  const dateTo = parseQueryValue(route.query.date_to)
  dateRange.value.from = dateFrom || ''
  dateRange.value.to = dateTo || ''
}

onMounted(async () => {
  await loadFilterOptions()
  loadSavedPresets()
  initializeFromQuery()
  updateMatchingResults()
})

watch(
  () => route.query,
  () => {
    initializeFromQuery()
    updateMatchingResults()
  },
  { deep: true },
)
</script>

<style scoped>
.filters-page {
  @apply min-h-screen bg-gray-50 p-6;
}

.page-header {
  @apply mb-8;
}

.page-content {
  @apply max-w-7xl mx-auto;
}

.loading-state,
.error-state {
  @apply text-center py-12;
}

.filters-section {
  @apply space-y-6;
}

.current-filters {
  @apply mb-6;
}

.filter-categories {
  @apply space-y-6;
}

.filter-category {
  @apply mb-6;
}

.action-buttons {
  @apply mt-8 flex justify-between items-center;
}

.button-group {
  @apply flex space-x-3;
}

.filter-presets {
  @apply mt-6;
}

.filter-stats {
  @apply text-sm text-gray-600;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .action-buttons {
    @apply flex-col space-y-4 items-stretch;
  }

  .button-group {
    @apply flex-col space-x-0 space-y-2;
  }

  .filter-stats {
    @apply text-center;
  }
}
</style>
