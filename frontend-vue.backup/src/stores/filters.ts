import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { FilterOptions, FilterState } from '@/types/filters'

// Filters state interface
interface FiltersState {
  active: Record<string, (string | number)[]>
  available: FilterOptions | null
  applied: boolean
  isLoading: boolean
  error: string | null
  lastUpdated: number | null
}

export const useFiltersStore = defineStore('filters', () => {
  // Reactive state
  const state = ref<FiltersState>({
    active: {},
    available: null,
    applied: false,
    isLoading: false,
    error: null,
    lastUpdated: null,
  })

  // Computed properties
  const hasActiveFilters = computed(() => {
    return Object.values(state.value.active).some(values => values.length > 0)
  })

  const activeFilterCount = computed(() => {
    return Object.values(state.value.active).reduce((total, values) => total + values.length, 0)
  })

  const activeCategories = computed(() => {
    return Object.entries(state.value.active)
      .filter(([, values]) => values.length > 0)
      .map(([category]) => category)
  })

  const isDirty = computed(() => {
    // Check if current state differs from applied state
    return !state.value.applied && hasActiveFilters.value
  })

  const appliedFilters = computed((): FilterState => {
    const appliedState: FilterState = {
      selectedBlockSizes: [],
      selectedPatterns: [],
      selectedQueueDepths: [],
      selectedNumJobs: [],
      selectedProtocols: [],
      selectedHostDiskCombinations: [],
    }

    // Convert internal active state to FilterState interface
    Object.entries(state.value.active).forEach(([category, values]) => {
      switch (category) {
        case 'block_sizes':
          appliedState.selectedBlockSizes = values as string[]
          break
        case 'patterns':
          appliedState.selectedPatterns = values as string[]
          break
        case 'queue_depths':
          appliedState.selectedQueueDepths = values as number[]
          break
        case 'num_jobs':
          appliedState.selectedNumJobs = values as number[]
          break
        case 'protocols':
          appliedState.selectedProtocols = values as string[]
          break
        case 'hostnames':
          // Handle hostnames filtering - could be extended
          break
        case 'host_disk_combinations':
          appliedState.selectedHostDiskCombinations = values as string[]
          break
      }
    })

    return appliedState
  })

  // Filter manipulation actions
  function setFilter(category: string, values: (string | number)[]): void {
    state.value.active[category] = [...values]
    state.value.applied = false
    state.value.lastUpdated = Date.now()
  }

  function addFilter(category: string, value: string | number): void {
    if (!state.value.active[category]) {
      state.value.active[category] = []
    }

    if (!state.value.active[category].includes(value)) {
      state.value.active[category].push(value)
      state.value.applied = false
      state.value.lastUpdated = Date.now()
    }
  }

  function removeFilter(category: string, value: string | number): void {
    if (!state.value.active[category]) return

    const index = state.value.active[category].indexOf(value)
    if (index > -1) {
      state.value.active[category].splice(index, 1)
      state.value.applied = false
      state.value.lastUpdated = Date.now()
    }
  }

  function toggleFilter(category: string, value: string | number): void {
    if (state.value.active[category]?.includes(value)) {
      removeFilter(category, value)
    } else {
      addFilter(category, value)
    }
  }

  function clearCategory(category: string): void {
    state.value.active[category] = []
    state.value.applied = false
    state.value.lastUpdated = Date.now()
  }

  function clearAllFilters(): void {
    Object.keys(state.value.active).forEach(category => {
      state.value.active[category] = []
    })
    state.value.applied = false
    state.value.lastUpdated = Date.now()
  }

  function resetFilters(): void {
    clearAllFilters()
    saveToStorage()
  }

  function applyFilters(): void {
    state.value.applied = true
    saveToStorage()
  }

  // Available options management
  function setAvailableFilters(options: FilterOptions): void {
    state.value.available = { ...options }

    // Remove any active filters that are no longer available
    Object.keys(state.value.active).forEach(category => {
      if (state.value.available && category in state.value.available) {
        const availableValues = state.value.available[category as keyof FilterOptions] as (string | number)[]
        state.value.active[category] = state.value.active[category].filter(value =>
          availableValues.includes(value)
        )
      }
    })
  }

  // Validation
  function isValidFilter(category: string, value: string | number): boolean {
    if (!state.value.available) return true

    const availableValues = state.value.available[category as keyof FilterOptions]
    if (!availableValues) return true

    return (availableValues as (string | number)[]).includes(value)
  }

  function getAvailableValues(category: string): (string | number)[] {
    if (!state.value.available) return []

    const values = state.value.available[category as keyof FilterOptions]
    return values || []
  }

  // API parameter conversion
  function getApiParams(): Record<string, string> {
    const params: Record<string, string> = {}

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

    Object.entries(state.value.active).forEach(([category, values]) => {
      if (values.length > 0) {
        const apiParam = apiMappings[category]
        if (apiParam) {
          params[apiParam] = values.join(',')
        }
      }
    })

    return params
  }

  // State management
  function setLoading(loading: boolean): void {
    state.value.isLoading = loading
  }

  function setError(error: string | null): void {
    state.value.error = error
    if (error) {
      state.value.isLoading = false
    }
  }

  // Persistence
  function saveToStorage(): void {
    try {
      const data = {
        active: { ...state.value.active },
        applied: state.value.applied,
        timestamp: state.value.lastUpdated,
      }
      localStorage.setItem('fio-filters', JSON.stringify(data))
    } catch (error) {
      console.warn('Failed to save filters to localStorage:', error)
    }
  }

  function loadFromStorage(): boolean {
    try {
      const stored = localStorage.getItem('fio-filters')
      if (!stored) return false

      const data = JSON.parse(stored)

      if (!data.active || typeof data.active !== 'object') return false

      state.value.active = { ...data.active }
      state.value.applied = data.applied || false
      state.value.lastUpdated = data.timestamp || null

      return true
    } catch (error) {
      console.warn('Failed to load filters from localStorage:', error)
      return false
    }
  }

  function clearStorage(): void {
    try {
      localStorage.removeItem('fio-filters')
    } catch (error) {
      console.warn('Failed to clear filters from localStorage:', error)
    }
  }

  // Utility methods
  function getFilterSummary(): Array<{
    category: string
    values: (string | number)[]
    displayName: string
  }> {
    return activeCategories.value.map(category => ({
      category,
      values: state.value.active[category],
      displayName: formatCategoryName(category),
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

  // Initialize from storage
  loadFromStorage()

  return {
    // Reactive state
    state,

    // Computed properties
    hasActiveFilters,
    activeFilterCount,
    activeCategories,
    isDirty,
    appliedFilters,

    // Filter manipulation
    setFilter,
    addFilter,
    removeFilter,
    toggleFilter,
    clearCategory,
    clearAllFilters,
    resetFilters,
    applyFilters,

    // Available options
    setAvailableFilters,

    // Validation
    isValidFilter,
    getAvailableValues,

    // API integration
    getApiParams,

    // State management
    setLoading,
    setError,

    // Persistence
    saveToStorage,
    loadFromStorage,
    clearStorage,

    // Utilities
    getFilterSummary,
    formatCategoryName,
  }
})
