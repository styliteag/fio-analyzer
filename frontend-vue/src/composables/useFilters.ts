import { ref, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import type { TestRunFilters, FilterOptions } from '@/types'

interface UseFiltersOptions {
  syncWithUrl?: boolean
  debounceMs?: number
}

export function useFilters(options: UseFiltersOptions = {}) {
  const {
    syncWithUrl = true,
    debounceMs = 300
  } = options

  const router = useRouter()
  const route = useRoute()

  // Filter state
  const activeFilters = ref<TestRunFilters>({})
  const filterHistory = ref<TestRunFilters[]>([])
  const availableOptions = ref<FilterOptions>({
    hostnames: [],
    drive_types: [],
    drive_models: [],
    test_types: [],
    read_write_patterns: [],
    block_sizes: []
  })

  // Performance and date range filters
  const performanceRanges = ref({
    iops: { min: null as number | null, max: null as number | null },
    latency: { min: null as number | null, max: null as number | null },
    bandwidth: { min: null as number | null, max: null as number | null }
  })

  const dateRange = ref({
    from: '',
    to: ''
  })

  // Filter presets
  const savedPresets = ref<Array<{
    id: string
    name: string
    filters: TestRunFilters
    performanceRanges?: typeof performanceRanges.value
    dateRange?: typeof dateRange.value
    createdAt: string
  }>>([])

  // Computed
  const hasActiveFilters = computed(() => {
    return Object.values(activeFilters.value).some(value => value !== '' && value !== null && value !== undefined) ||
           Object.values(performanceRanges.value).some(range => range.min !== null || range.max !== null) ||
           dateRange.value.from !== '' || dateRange.value.to !== ''
  })

  const filterCount = computed(() => {
    let count = Object.values(activeFilters.value).filter(value => value !== '' && value !== null && value !== undefined).length

    if (performanceRanges.value.iops.min !== null || performanceRanges.value.iops.max !== null) count++
    if (performanceRanges.value.latency.min !== null || performanceRanges.value.latency.max !== null) count++
    if (performanceRanges.value.bandwidth.min !== null || performanceRanges.value.bandwidth.max !== null) count++
    if (dateRange.value.from !== '' || dateRange.value.to !== '') count++

    return count
  })

  const filterSummary = computed(() => {
    const summaryParts: string[] = []

    // Basic filters
    Object.entries(activeFilters.value).forEach(([key, value]) => {
      if (value) {
        const displayKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
        summaryParts.push(`${displayKey}: ${value}`)
      }
    })

    // Performance ranges
    if (performanceRanges.value.iops.min !== null || performanceRanges.value.iops.max !== null) {
      const min = performanceRanges.value.iops.min || '0'
      const max = performanceRanges.value.iops.max || '∞'
      summaryParts.push(`IOPS: ${min}-${max}`)
    }

    if (performanceRanges.value.latency.min !== null || performanceRanges.value.latency.max !== null) {
      const min = performanceRanges.value.latency.min || '0'
      const max = performanceRanges.value.latency.max || '∞'
      summaryParts.push(`Latency: ${min}-${max}ms`)
    }

    if (performanceRanges.value.bandwidth.min !== null || performanceRanges.value.bandwidth.max !== null) {
      const min = performanceRanges.value.bandwidth.min || '0'
      const max = performanceRanges.value.bandwidth.max || '∞'
      summaryParts.push(`Bandwidth: ${min}-${max} MB/s`)
    }

    // Date range
    if (dateRange.value.from || dateRange.value.to) {
      const from = dateRange.value.from || 'beginning'
      const to = dateRange.value.to || 'now'
      summaryParts.push(`Date: ${from} to ${to}`)
    }

    return summaryParts.length > 0 ? summaryParts.join(', ') : 'No active filters'
  })

  const urlQuery = computed(() => {
    const query: Record<string, string> = {}

    // Add basic filters
    Object.entries(activeFilters.value).forEach(([key, value]) => {
      if (value) query[key] = String(value)
    })

    // Add performance ranges
    if (performanceRanges.value.iops.min !== null) query.iops_min = String(performanceRanges.value.iops.min)
    if (performanceRanges.value.iops.max !== null) query.iops_max = String(performanceRanges.value.iops.max)
    if (performanceRanges.value.latency.min !== null) query.latency_min = String(performanceRanges.value.latency.min)
    if (performanceRanges.value.latency.max !== null) query.latency_max = String(performanceRanges.value.latency.max)
    if (performanceRanges.value.bandwidth.min !== null) query.bandwidth_min = String(performanceRanges.value.bandwidth.min)
    if (performanceRanges.value.bandwidth.max !== null) query.bandwidth_max = String(performanceRanges.value.bandwidth.max)

    // Add date range
    if (dateRange.value.from) query.date_from = dateRange.value.from
    if (dateRange.value.to) query.date_to = dateRange.value.to

    return query
  })

  // Methods
  const setFilter = (key: keyof TestRunFilters, value: string | null) => {
    if (value === null || value === '') {
      delete activeFilters.value[key]
    } else {
      activeFilters.value[key] = value
    }
    saveToHistory()
  }

  const setFilters = (filters: TestRunFilters) => {
    activeFilters.value = { ...filters }
    saveToHistory()
  }

  const setPerformanceRange = (metric: 'iops' | 'latency' | 'bandwidth', min: number | null, max: number | null) => {
    performanceRanges.value[metric] = { min, max }
  }

  const setDateRange = (from: string, to: string) => {
    dateRange.value = { from, to }
  }

  const clearFilter = (key: keyof TestRunFilters) => {
    delete activeFilters.value[key]
    saveToHistory()
  }

  const clearAllFilters = () => {
    activeFilters.value = {}
    performanceRanges.value = {
      iops: { min: null, max: null },
      latency: { min: null, max: null },
      bandwidth: { min: null, max: null }
    }
    dateRange.value = { from: '', to: '' }
    saveToHistory()
  }

  const resetFilters = () => {
    clearAllFilters()
  }

  const saveToHistory = () => {
    const currentState = { ...activeFilters.value }
    if (filterHistory.value.length === 0 ||
        JSON.stringify(filterHistory.value[filterHistory.value.length - 1]) !== JSON.stringify(currentState)) {
      filterHistory.value.push(currentState)

      // Keep only last 10 states
      if (filterHistory.value.length > 10) {
        filterHistory.value = filterHistory.value.slice(-10)
      }
    }
  }

  const undoLastFilter = () => {
    if (filterHistory.value.length > 1) {
      filterHistory.value.pop() // Remove current state
      const previousState = filterHistory.value[filterHistory.value.length - 1]
      activeFilters.value = { ...previousState }
    }
  }

  const savePreset = (name: string) => {
    const preset = {
      id: Date.now().toString(),
      name,
      filters: { ...activeFilters.value },
      performanceRanges: JSON.parse(JSON.stringify(performanceRanges.value)),
      dateRange: { ...dateRange.value },
      createdAt: new Date().toISOString()
    }

    savedPresets.value.push(preset)

    // Save to localStorage
    localStorage.setItem('filterPresets', JSON.stringify(savedPresets.value))

    return preset
  }

  const loadPreset = (preset: typeof savedPresets.value[0]) => {
    activeFilters.value = { ...preset.filters }
    if (preset.performanceRanges) {
      performanceRanges.value = JSON.parse(JSON.stringify(preset.performanceRanges))
    }
    if (preset.dateRange) {
      dateRange.value = { ...preset.dateRange }
    }
    saveToHistory()
  }

  const deletePreset = (presetId: string) => {
    savedPresets.value = savedPresets.value.filter(preset => preset.id !== presetId)
    localStorage.setItem('filterPresets', JSON.stringify(savedPresets.value))
  }

  const initializeFromUrl = () => {
    if (!syncWithUrl) return

    const query = route.query

    // Initialize basic filters
    const filters: TestRunFilters = {}
    const filterKeys: (keyof TestRunFilters)[] = [
      'hostname', 'drive_type', 'drive_model', 'test_type', 'read_write_pattern', 'block_size'
    ]

    filterKeys.forEach(key => {
      if (query[key]) {
        filters[key] = String(query[key])
      }
    })

    activeFilters.value = filters

    // Initialize performance ranges
    if (query.iops_min || query.iops_max) {
      performanceRanges.value.iops = {
        min: query.iops_min ? Number(query.iops_min) : null,
        max: query.iops_max ? Number(query.iops_max) : null
      }
    }

    if (query.latency_min || query.latency_max) {
      performanceRanges.value.latency = {
        min: query.latency_min ? Number(query.latency_min) : null,
        max: query.latency_max ? Number(query.latency_max) : null
      }
    }

    if (query.bandwidth_min || query.bandwidth_max) {
      performanceRanges.value.bandwidth = {
        min: query.bandwidth_min ? Number(query.bandwidth_min) : null,
        max: query.bandwidth_max ? Number(query.bandwidth_max) : null
      }
    }

    // Initialize date range
    if (query.date_from || query.date_to) {
      dateRange.value = {
        from: query.date_from ? String(query.date_from) : '',
        to: query.date_to ? String(query.date_to) : ''
      }
    }

    saveToHistory()
  }

  const syncToUrl = () => {
    if (!syncWithUrl) return

    const query = urlQuery.value

    router.replace({
      path: route.path,
      query: Object.keys(query).length > 0 ? query : undefined
    })
  }

  const loadSavedPresets = () => {
    const saved = localStorage.getItem('filterPresets')
    if (saved) {
      try {
        savedPresets.value = JSON.parse(saved)
      } catch (error) {
        console.error('Error loading saved filter presets:', error)
        savedPresets.value = []
      }
    }
  }

  const exportFilters = () => {
    const exportData = {
      filters: activeFilters.value,
      performanceRanges: performanceRanges.value,
      dateRange: dateRange.value,
      presets: savedPresets.value,
      exportedAt: new Date().toISOString()
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `filters-export-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const importFilters = (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string)

          if (data.filters) activeFilters.value = data.filters
          if (data.performanceRanges) performanceRanges.value = data.performanceRanges
          if (data.dateRange) dateRange.value = data.dateRange
          if (data.presets) {
            savedPresets.value = data.presets
            localStorage.setItem('filterPresets', JSON.stringify(savedPresets.value))
          }

          saveToHistory()
          resolve()
        } catch (error) {
          reject(new Error('Invalid filter export file'))
        }
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsText(file)
    })
  }

  // Watchers
  let debounceTimer: NodeJS.Timeout | null = null

  watch([activeFilters, performanceRanges, dateRange], () => {
    if (syncWithUrl) {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(syncToUrl, debounceMs)
    }
  }, { deep: true })

  // Initialize
  loadSavedPresets()
  initializeFromUrl()

  return {
    // State
    activeFilters,
    performanceRanges,
    dateRange,
    availableOptions,
    savedPresets,
    filterHistory,

    // Computed
    hasActiveFilters,
    filterCount,
    filterSummary,
    urlQuery,

    // Methods
    setFilter,
    setFilters,
    setPerformanceRange,
    setDateRange,
    clearFilter,
    clearAllFilters,
    resetFilters,
    undoLastFilter,
    savePreset,
    loadPreset,
    deletePreset,
    initializeFromUrl,
    syncToUrl,
    exportFilters,
    importFilters
  }
}