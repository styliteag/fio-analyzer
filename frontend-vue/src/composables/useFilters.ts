import { ref, reactive, computed, readonly } from 'vue'
import type { TestRun, FilterOptions, FilterState } from '@/types'
import {
  isFilterActive,
  getActiveFilterCount,
  createHostDiskKey
} from '@/types/filters'

// Local storage key for filter persistence
const FILTER_STORAGE_KEY = 'fio-filters'

// Filter state structure that matches API expectations
interface InternalFilterState {
  [category: string]: (string | number)[]
}

export function useFilters() {
  // Reactive state
  const active = reactive<InternalFilterState>({
    block_sizes: [],
    patterns: [],
    queue_depths: [],
    num_jobs: [],
    protocols: [],
    hostnames: [],
    drive_types: [],
    host_disk_combinations: [],
    drive_models: [],
    syncs: [],
    directs: [],
    test_sizes: [],
    durations: [],
  })

  const available = ref<FilterOptions | null>(null)
  const applied = ref(false)
  const lastUpdated = ref<number | null>(null)

  // Computed properties
  const isActive = computed(() => isFilterActive(toFilterState()))
  const activeCount = computed(() => getActiveFilterCount(toFilterState()))
  const hasAvailableFilters = computed(() => available.value !== null)
  const activeCategories = computed(() => {
    return Object.entries(active).filter(([, values]) => values.length > 0).map(([key]) => key)
  })

  // Convert internal state to FilterState interface
  function toFilterState(): FilterState {
    return {
      selectedBlockSizes: active.block_sizes as string[],
      selectedPatterns: active.patterns as string[],
      selectedQueueDepths: active.queue_depths as number[],
      selectedNumJobs: active.num_jobs as number[],
      selectedProtocols: active.protocols as string[],
      selectedHostDiskCombinations: active.host_disk_combinations as string[],
    }
  }

  // Convert FilterState to internal state
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function fromFilterState(state: FilterState): void {
    active.block_sizes = state.selectedBlockSizes
    active.patterns = state.selectedPatterns
    active.queue_depths = state.selectedQueueDepths
    active.num_jobs = state.selectedNumJobs
    active.protocols = state.selectedProtocols
    active.host_disk_combinations = state.selectedHostDiskCombinations
  }

  // Filter manipulation methods
  function toggleFilter(category: string, value: string | number): void {
    if (!active[category]) {
      active[category] = []
    }

    const index = active[category].indexOf(value)
    if (index > -1) {
      // Remove if exists (OR logic within category)
      active[category].splice(index, 1)
    } else {
      // Add if doesn't exist (OR logic within category)
      active[category].push(value)
    }

    applied.value = false
    lastUpdated.value = Date.now()
  }

  function setFilter(category: string, values: (string | number)[]): void {
    active[category] = [...values]
    applied.value = false
    lastUpdated.value = Date.now()
  }

  function addFilter(category: string, value: string | number): void {
    if (!active[category]) {
      active[category] = []
    }

    if (!active[category].includes(value)) {
      active[category].push(value)
      applied.value = false
      lastUpdated.value = Date.now()
    }
  }

  function removeFilter(category: string, value: string | number): void {
    if (!active[category]) return

    const index = active[category].indexOf(value)
    if (index > -1) {
      active[category].splice(index, 1)
      applied.value = false
      lastUpdated.value = Date.now()
    }
  }

  function clearCategory(category: string): void {
    active[category] = []
    applied.value = false
    lastUpdated.value = Date.now()
  }

  function clearFilters(): void {
    Object.keys(active).forEach(category => {
      active[category] = []
    })
    applied.value = false
    lastUpdated.value = Date.now()
  }

  function resetFilters(): void {
    clearFilters()
    saveToStorage()
  }

  function applyFilters(): FilterState {
    applied.value = true
    saveToStorage()
    return toFilterState()
  }

  // Filter validation and checking
  function isFilterValueActive(category: string, value: string | number): boolean {
    return active[category]?.includes(value) || false
  }

  function isCategoryActive(category: string): boolean {
    return (active[category]?.length || 0) > 0
  }

  function validateFilter(category: string, value: string | number): boolean {
    if (!available.value) return true // If no available filters loaded, allow anything

    const availableValues = available.value[category as keyof FilterOptions]
    if (!availableValues) return true // If category doesn't exist, allow

    return availableValues.includes(value as never)
  }

  function getAvailableValues(category: string): (string | number)[] {
    if (!available.value) return []

    const values = available.value[category as keyof FilterOptions]
    return values || []
  }

  // Data filtering logic (OR within categories, AND between categories)
  function filterTestRuns(testRuns: TestRun[]): TestRun[] {
    if (!isActive.value) return testRuns

    return testRuns.filter(testRun => {
      // AND logic between categories - ALL active categories must match
      for (const category of activeCategories.value) {
        const categoryMatches = matchesCategory(testRun, category)
        if (!categoryMatches) {
          return false
        }
      }

      return true
    })
  }

  function matchesCategory(testRun: TestRun, category: string): boolean {
    const activeValues = active[category]
    if (!activeValues || activeValues.length === 0) return true

    switch (category) {
      case 'block_sizes':
        return activeValues.includes(testRun.block_size)

      case 'patterns':
        return activeValues.includes(testRun.read_write_pattern)

      case 'queue_depths':
        return activeValues.includes(testRun.queue_depth)

      case 'num_jobs':
        return activeValues.includes(testRun.num_jobs)

      case 'protocols':
        return activeValues.includes(testRun.protocol)

      case 'hostnames':
        return activeValues.includes(testRun.hostname)

      case 'drive_types':
        return activeValues.includes(testRun.drive_type)

      case 'drive_models':
        return activeValues.includes(testRun.drive_model)

      case 'syncs':
        return activeValues.includes(testRun.sync)

      case 'directs':
        return activeValues.includes(testRun.direct)

      case 'test_sizes':
        return activeValues.includes(testRun.test_size)

      case 'durations':
        return activeValues.includes(testRun.duration)

      case 'host_disk_combinations': {
        const key = createHostDiskKey(testRun.hostname, testRun.protocol, testRun.drive_model)
        return activeValues.includes(key)
      }

      default:
        return true
    }
  }

  // Get applied filters in API format
  function getAppliedFilters(): Record<string, string> {
    const result: Record<string, string> = {}

    // Convert filter categories to API parameter names
    const apiMappings: Record<string, string> = {
      hostnames: 'hostnames',
      drive_types: 'drive_types',
      drive_models: 'drive_models',
      protocols: 'protocols',
      patterns: 'patterns',
      block_sizes: 'block_sizes',
      syncs: 'syncs',
      queue_depths: 'queue_depths',
      directs: 'directs',
      num_jobs: 'num_jobs',
      test_sizes: 'test_sizes',
      durations: 'durations',
    }

    Object.entries(active).forEach(([category, values]) => {
      if (values.length > 0) {
        const apiParam = apiMappings[category]
        if (apiParam) {
          result[apiParam] = values.join(',')
        }
      }
    })

    return result
  }

  // Get active filters summary for UI display
  function getActiveFiltersSummary(): Array<{ category: string; values: (string | number)[] }> {
    return Object.entries(active)
      .filter(([, values]) => values.length > 0)
      .map(([category, values]) => ({
        category: formatCategoryName(category),
        values,
      }))
  }

  function formatCategoryName(category: string): string {
    const names: Record<string, string> = {
      block_sizes: 'Block Sizes',
      patterns: 'I/O Patterns',
      queue_depths: 'Queue Depths',
      num_jobs: 'Job Count',
      protocols: 'Protocols',
      hostnames: 'Hostnames',
      drive_types: 'Drive Types',
      drive_models: 'Drive Models',
      syncs: 'Sync Mode',
      directs: 'Direct I/O',
      test_sizes: 'Test Sizes',
      durations: 'Duration',
      host_disk_combinations: 'Host-Disk Combinations',
    }

    return names[category] || category
  }

  // Persistence methods
  function saveToStorage(): void {
    try {
      const data = {
        active: { ...active },
        applied: applied.value,
        timestamp: Date.now(),
      }
      localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(data))
    } catch (error) {
      console.warn('Failed to save filters to localStorage:', error)
    }
  }

  function loadFromStorage(): boolean {
    try {
      const stored = localStorage.getItem(FILTER_STORAGE_KEY)
      if (!stored) return false

      const data = JSON.parse(stored)

      // Validate stored data structure
      if (!data.active || typeof data.active !== 'object') return false

      // Load the data
      Object.assign(active, data.active)
      applied.value = data.applied || false
      lastUpdated.value = data.timestamp || null

      return true
    } catch (error) {
      console.warn('Failed to load filters from localStorage:', error)
      return false
    }
  }

  function clearStorage(): void {
    try {
      localStorage.removeItem(FILTER_STORAGE_KEY)
    } catch (error) {
      console.warn('Failed to clear filters from localStorage:', error)
    }
  }

  // Set available filter options (called when API data loads)
  function setAvailableFilters(options: FilterOptions): void {
    available.value = options
  }

  // Initialize from storage on first load
  loadFromStorage()

  return {
    // Reactive state (readonly)
    active: readonly(active),
    available: readonly(available),
    applied: readonly(applied),

    // Computed properties
    isActive,
    activeCount,
    hasAvailableFilters,
    activeCategories,

    // Filter manipulation
    toggleFilter,
    setFilter,
    addFilter,
    removeFilter,
    clearCategory,
    clearFilters,
    resetFilters,
    applyFilters,

    // Validation and checking
    isFilterValueActive,
    isCategoryActive,
    validateFilter,
    getAvailableValues,

    // Data filtering
    filterTestRuns,
    matchesCategory,

    // API integration
    getAppliedFilters,
    getActiveFiltersSummary,

    // Persistence
    saveToStorage,
    loadFromStorage,
    clearStorage,

    // Setup
    setAvailableFilters,
  }
}
