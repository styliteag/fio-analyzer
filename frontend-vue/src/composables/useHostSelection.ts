import { ref, reactive, computed, readonly } from 'vue'
import type { TestRun } from '@/types'

// Local storage key for host selection persistence
const HOST_SELECTION_STORAGE_KEY = 'fio-host-selection'

// Host selection state
interface HostSelectionState {
  selected: string[] // Selected hostnames
  available: string[] // All available hostnames
  persisted: boolean // Whether current selection is persisted
  lastUpdated: number | null // Timestamp of last update
}

export function useHostSelection() {
  // Reactive state
  const state = reactive<HostSelectionState>({
    selected: [],
    available: [],
    persisted: false,
    lastUpdated: null,
  })

  // Computed properties
  const hasSelection = computed(() => state.selected.length > 0)
  const selectionCount = computed(() => state.selected.length)
  const availableCount = computed(() => state.available.length)
  const isAllSelected = computed(() =>
    state.available.length > 0 && state.selected.length === state.available.length
  )
  const isNoneSelected = computed(() => state.selected.length === 0)
  const selectedHostsText = computed(() => {
    if (state.selected.length === 0) return 'No hosts selected'
    if (state.selected.length === 1) return `${state.selected[0]}`
    if (state.selected.length === state.available.length) return 'All hosts'
    return `${state.selected.length} hosts selected`
  })

  // Host selection methods
  function selectHosts(hostnames: string[]): void {
    // Validate that all hostnames are available
    const validHostnames = hostnames.filter(hostname =>
      state.available.includes(hostname)
    )

    state.selected = [...validHostnames]
    state.persisted = true
    state.lastUpdated = Date.now()

    saveToStorage()
  }

  function selectHost(hostname: string): void {
    if (!state.available.includes(hostname)) return
    if (!state.selected.includes(hostname)) {
      state.selected.push(hostname)
      state.persisted = true
      state.lastUpdated = Date.now()
      saveToStorage()
    }
  }

  function deselectHost(hostname: string): void {
    const index = state.selected.indexOf(hostname)
    if (index > -1) {
      state.selected.splice(index, 1)
      state.persisted = true
      state.lastUpdated = Date.now()
      saveToStorage()
    }
  }

  function toggleHost(hostname: string): void {
    if (state.selected.includes(hostname)) {
      deselectHost(hostname)
    } else {
      selectHost(hostname)
    }
  }

  function selectAllHosts(): void {
    state.selected = [...state.available]
    state.persisted = true
    state.lastUpdated = Date.now()
    saveToStorage()
  }

  function deselectAllHosts(): void {
    state.selected = []
    state.persisted = true
    state.lastUpdated = Date.now()
    saveToStorage()
  }

  function clearSelection(): void {
    state.selected = []
    state.persisted = false
    state.lastUpdated = Date.now()
    clearStorage()
  }

  function setAvailableHosts(hostnames: string[]): void {
    // Remove duplicates and sort
    const uniqueHostnames = [...new Set(hostnames)].sort()

    // Check if available hosts changed
    const hasChanged = JSON.stringify(state.available) !== JSON.stringify(uniqueHostnames)

    if (hasChanged) {
      state.available = uniqueHostnames

      // Remove any selected hosts that are no longer available
      state.selected = state.selected.filter(hostname =>
        uniqueHostnames.includes(hostname)
      )

      // If selection changed due to unavailable hosts, update persistence
      if (state.selected.length !== hostnames.length) {
        state.lastUpdated = Date.now()
        saveToStorage()
      }
    }
  }

  // Update available hosts from test run data
  function updateFromTestRuns(testRuns: TestRun[]): void {
    const hostnames = [...new Set(testRuns.map(run => run.hostname))].sort()
    setAvailableHosts(hostnames)
  }

  // Check if host is selected
  function isHostSelected(hostname: string): boolean {
    return state.selected.includes(hostname)
  }

  // Check if host is available
  function isHostAvailable(hostname: string): boolean {
    return state.available.includes(hostname)
  }

  // Get selected hosts for API calls
  function getSelectedHosts(): string[] {
    return [...state.selected]
  }

  // Get selected hosts as comma-separated string for API
  function getSelectedHostsString(): string {
    return state.selected.join(',')
  }

  // Filter data by selected hosts
  function filterBySelectedHosts<T extends { hostname: string }>(data: T[]): T[] {
    if (state.selected.length === 0) return data
    return data.filter(item => state.selected.includes(item.hostname))
  }

  // Persistence methods
  function saveToStorage(): void {
    try {
      const data = {
        selected: [...state.selected],
        available: [...state.available],
        persisted: state.persisted,
        timestamp: state.lastUpdated,
      }
      localStorage.setItem(HOST_SELECTION_STORAGE_KEY, JSON.stringify(data))
    } catch (error) {
      console.warn('Failed to save host selection to localStorage:', error)
    }
  }

  function loadFromStorage(): boolean {
    try {
      const stored = localStorage.getItem(HOST_SELECTION_STORAGE_KEY)
      if (!stored) return false

      const data = JSON.parse(stored)

      // Validate stored data structure
      if (!Array.isArray(data.selected) || !Array.isArray(data.available)) {
        return false
      }

      // Load the data
      state.selected = [...data.selected]
      state.available = [...data.available]
      state.persisted = data.persisted || false
      state.lastUpdated = data.timestamp || null

      return true
    } catch (error) {
      console.warn('Failed to load host selection from localStorage:', error)
      return false
    }
  }

  function clearStorage(): void {
    try {
      localStorage.removeItem(HOST_SELECTION_STORAGE_KEY)
    } catch (error) {
      console.warn('Failed to clear host selection from localStorage:', error)
    }
  }

  // Get selection summary for UI
  function getSelectionSummary(): {
    selected: string[]
    available: string[]
    count: number
    total: number
    text: string
    isAll: boolean
    isNone: boolean
  } {
    return {
      selected: [...state.selected],
      available: [...state.available],
      count: state.selected.length,
      total: state.available.length,
      text: selectedHostsText.value,
      isAll: isAllSelected.value,
      isNone: isNoneSelected.value,
    }
  }

  // Initialize from storage on first load
  loadFromStorage()

  return {
    // Reactive state (readonly)
    selected: readonly(computed(() => state.selected)),
    available: readonly(computed(() => state.available)),
    persisted: readonly(computed(() => state.persisted)),

    // Computed properties
    hasSelection,
    selectionCount,
    availableCount,
    isAllSelected,
    isNoneSelected,
    selectedHostsText,

    // Host selection methods
    selectHosts,
    selectHost,
    deselectHost,
    toggleHost,
    selectAllHosts,
    deselectAllHosts,
    clearSelection,

    // Setup methods
    setAvailableHosts,
    updateFromTestRuns,

    // Query methods
    isHostSelected,
    isHostAvailable,
    getSelectedHosts,
    getSelectedHostsString,

    // Data filtering
    filterBySelectedHosts,

    // Persistence
    saveToStorage,
    loadFromStorage,
    clearStorage,

    // Information
    getSelectionSummary,
  }
}
