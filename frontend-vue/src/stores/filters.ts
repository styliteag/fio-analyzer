import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { FilterOptions, ActiveFilters } from '../types/testRun'

export const useFiltersStore = defineStore('filters', () => {
  // Available filter options from API
  const available = ref<FilterOptions>({
    hostnames: [],
    protocols: [],
    drive_types: [],
    drive_models: [],
    block_sizes: [],
    patterns: [],
    queue_depths: [],
    num_jobs: [],
    directs: [],
    syncs: [],
    test_sizes: [],
    durations: []
  })

  // Active/selected filters
  const active = ref<ActiveFilters>({
    hostnames: [],
    protocols: [],
    drive_types: [],
    drive_models: [],
    block_sizes: [],
    patterns: [],
    queue_depths: [],
    num_jobs: [],
    directs: [],
    syncs: [],
    test_sizes: [],
    durations: []
  })

  // Computed: check if any filters are active
  const hasActiveFilters = computed(() => {
    return Object.values(active.value).some((arr) => arr.length > 0)
  })

  // Computed: count of active filter categories
  const activeFilterCount = computed(() => {
    return Object.values(active.value).filter((arr) => arr.length > 0).length
  })

  // Set available filter options
  function setAvailable(options: FilterOptions) {
    available.value = options
  }

  // Toggle a filter value
  function toggleFilter(category: keyof ActiveFilters, value: string | number) {
    const arr = active.value[category] as (string | number)[]
    const index = arr.indexOf(value)

    if (index > -1) {
      arr.splice(index, 1)
    } else {
      arr.push(value)
    }
  }

  // Set multiple values for a category
  function setFilter(category: keyof ActiveFilters, values: (string | number)[]) {
    active.value[category] = values as any
  }

  // Clear a specific filter category
  function clearFilter(category: keyof ActiveFilters) {
    active.value[category] = [] as any
  }

  // Clear all filters
  function clearAllFilters() {
    Object.keys(active.value).forEach((key) => {
      active.value[key as keyof ActiveFilters] = [] as any
    })
  }

  // Get query params for API
  function getQueryParams(): Record<string, string> {
    const params: Record<string, string> = {}

    Object.entries(active.value).forEach(([key, value]) => {
      if (value.length > 0) {
        params[key] = value.join(',')
      }
    })

    return params
  }

  return {
    available,
    active,
    hasActiveFilters,
    activeFilterCount,
    setAvailable,
    toggleFilter,
    setFilter,
    clearFilter,
    clearAllFilters,
    getQueryParams
  }
})
