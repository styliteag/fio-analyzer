/**
 * Filter Management Composable
 * Provides reactive filter state management for Vue components
 */

import { ref, computed, readonly } from 'vue'
import type { FilterState } from '@/types/filters'
import type { PerformanceData } from '@/types/performance'

export interface UseFiltersReturn {
  filters: Readonly<FilterState>
  applyFilters: (newFilters: Partial<FilterState>) => void
  clearFilters: () => void
  resetFilters: () => void
  isFilterActive: Readonly<boolean>
  getActiveFilterCount: Readonly<number>
  getActiveFilterTags: Readonly<Array<{ id: string; label: string; category: string }>>
  matchesFilters: (item: PerformanceData) => boolean
  getFilteredData: (data: PerformanceData[]) => PerformanceData[]
  getFilterSummary: () => {
    totalItems: number
    filteredItems: number
    activeFilters: number
  }
}

// Default filter state
const defaultFilterState: FilterState = {
  selectedBlockSizes: [],
  selectedPatterns: [],
  selectedQueueDepths: [],
  selectedNumJobs: [],
  selectedProtocols: [],
  selectedHostDiskCombinations: []
}

// Reactive filter state
const filters = ref<FilterState>({ ...defaultFilterState })

// Computed properties
const isFilterActive = computed(() => {
  return (
    filters.value.selectedBlockSizes.length > 0 ||
    filters.value.selectedPatterns.length > 0 ||
    filters.value.selectedQueueDepths.length > 0 ||
    filters.value.selectedNumJobs.length > 0 ||
    filters.value.selectedProtocols.length > 0 ||
    filters.value.selectedHostDiskCombinations.length > 0
  )
})

const getActiveFilterCount = computed(() => {
  return (
    filters.value.selectedBlockSizes.length +
    filters.value.selectedPatterns.length +
    filters.value.selectedQueueDepths.length +
    filters.value.selectedNumJobs.length +
    filters.value.selectedProtocols.length +
    filters.value.selectedHostDiskCombinations.length
  )
})

const getActiveFilterTags = computed(() => {
  const tags: Array<{ id: string; label: string; category: string }> = []

  filters.value.selectedBlockSizes.forEach(size => {
    tags.push({
      id: `blocksize-${size}`,
      label: `Block: ${size}`,
      category: 'block-size'
    })
  })

  filters.value.selectedPatterns.forEach(pattern => {
    tags.push({
      id: `pattern-${pattern}`,
      label: `Pattern: ${pattern.replace('_', ' ')}`,
      category: 'io-pattern'
    })
  })

  filters.value.selectedQueueDepths.forEach(depth => {
    tags.push({
      id: `queuedepth-${depth}`,
      label: `QD: ${depth}`,
      category: 'queue-depth'
    })
  })

  filters.value.selectedNumJobs.forEach(jobs => {
    tags.push({
      id: `numjobs-${jobs}`,
      label: `Jobs: ${jobs}`,
      category: 'num-jobs'
    })
  })

  filters.value.selectedProtocols.forEach(protocol => {
    tags.push({
      id: `protocol-${protocol}`,
      label: `Protocol: ${protocol.toUpperCase()}`,
      category: 'protocol'
    })
  })

  filters.value.selectedHostDiskCombinations.forEach(combo => {
    tags.push({
      id: `hostdisk-${combo.replace(/\s+/g, '-').toLowerCase()}`,
      label: combo,
      category: 'host-disk'
    })
  })

  return tags
})

// Methods
const applyFilters = (newFilters: Partial<FilterState>) => {
  filters.value = {
    ...filters.value,
    ...newFilters
  }
}

const clearFilters = () => {
  filters.value = { ...defaultFilterState }
}

const resetFilters = () => {
  filters.value = { ...defaultFilterState }
}

const matchesFilters = (item: PerformanceData): boolean => {
  // Block size filter
  if (filters.value.selectedBlockSizes.length > 0) {
    const blockSize = typeof item.block_size === 'string' ? item.block_size : item.block_size?.toString()
    if (!blockSize || !filters.value.selectedBlockSizes.includes(blockSize)) {
      return false
    }
  }

  // IO pattern filter
  if (filters.value.selectedPatterns.length > 0 &&
      (!item.read_write_pattern || !filters.value.selectedPatterns.includes(item.read_write_pattern))) {
    return false
  }

  // Queue depth filter
  if (filters.value.selectedQueueDepths.length > 0 &&
      (!item.queue_depth || !filters.value.selectedQueueDepths.includes(item.queue_depth))) {
    return false
  }

  // Number of jobs filter
  if (filters.value.selectedNumJobs.length > 0 &&
      (!item.num_jobs || !filters.value.selectedNumJobs.includes(item.num_jobs))) {
    return false
  }

  // Protocol filter
  if (filters.value.selectedProtocols.length > 0 &&
      (!item.protocol || !filters.value.selectedProtocols.includes(item.protocol))) {
    return false
  }

  // Host-disk combination filter
  if (filters.value.selectedHostDiskCombinations.length > 0) {
    const combo = item.hostname && item.drive_model ? `${item.hostname} - ${item.drive_model}` : ''
    if (!combo || !filters.value.selectedHostDiskCombinations.includes(combo)) {
      return false
    }
  }

  return true
}

const getFilteredData = (data: PerformanceData[]): PerformanceData[] => {
  return data.filter(matchesFilters)
}

const getFilterSummary = () => {
  // This would need to be called with actual data, but we return structure
  return {
    totalItems: 0, // Would be set by caller
    filteredItems: 0, // Would be set by caller
    activeFilters: getActiveFilterCount.value
  }
}

// Quick filter presets
export const quickFilters = {
  'high-performance': {
    label: 'High IOPS',
    filters: {
      selectedPatterns: ['random_read', 'random_write']
    }
  },
  'low-latency': {
    label: 'Low Latency',
    filters: {
      selectedPatterns: ['random_read']
    }
  },
  'sequential': {
    label: 'Sequential IO',
    filters: {
      selectedPatterns: ['sequential_read', 'sequential_write']
    }
  },
  'random': {
    label: 'Random IO',
    filters: {
      selectedPatterns: ['random_read', 'random_write']
    }
  }
}

export const applyQuickFilter = (filterKey: keyof typeof quickFilters) => {
  const quickFilter = quickFilters[filterKey]
  if (quickFilter) {
    applyFilters(quickFilter.filters)
  }
}

// Main composable
export const useFilters = (): UseFiltersReturn => {
  return {
    filters: readonly(filters),
    applyFilters,
    clearFilters,
    resetFilters,
    isFilterActive: readonly(isFilterActive),
    getActiveFilterCount: readonly(getActiveFilterCount),
    getActiveFilterTags: readonly(getActiveFilterTags),
    matchesFilters,
    getFilteredData,
    getFilterSummary
  }
}

// Export filter utilities
export { filters as filterState }