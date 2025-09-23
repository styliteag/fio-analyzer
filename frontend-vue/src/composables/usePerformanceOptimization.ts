/**
 * Performance Optimization Composable
 * Provides utilities for optimizing chart rendering and data processing
 */

import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import type { Ref } from 'vue'

interface PerformanceConfig {
  debounceMs: number
  maxDataPoints: number
  enableLazyLoading: boolean
  enableMemoization: boolean
  enableVirtualization: boolean
}

const defaultConfig: PerformanceConfig = {
  debounceMs: 300,
  maxDataPoints: 10000,
  enableLazyLoading: true,
  enableMemoization: true,
  enableVirtualization: false
}

/**
 * Data memoization composable
 * Caches expensive computations and invalidates when dependencies change
 */
export function useDataMemoization<T>(
  computeFn: () => T,
  deps: Ref<unknown>[],
  config: Partial<PerformanceConfig> = {}
) {
  const memoizedData = ref<T | null>(null)
  const isComputing = ref(false)
  const lastComputed = ref<number>(0)

  const finalConfig = { ...defaultConfig, ...config }

  const computeData = async (): Promise<T> => {
    if (isComputing.value) return memoizedData.value as T

    isComputing.value = true
    try {
      const startTime = performance.now()
      const result = await computeFn()
      const endTime = performance.now()

      console.log(`Data computation took ${(endTime - startTime).toFixed(2)}ms`)

      if (finalConfig.enableMemoization) {
        memoizedData.value = result
        lastComputed.value = Date.now()
      }

      return result
    } finally {
      isComputing.value = false
    }
  }

  const invalidateCache = () => {
    memoizedData.value = null
  }

  // Watch dependencies and invalidate cache
  deps.forEach(dep => {
    watch(dep, invalidateCache, { deep: true })
  })

  const data = computed(() => {
    if (memoizedData.value !== null && finalConfig.enableMemoization) {
      return memoizedData.value
    }
    // Trigger computation (this will be async)
    computeData()
    return null
  })

  return {
    data: readonly(data),
    isComputing: readonly(isComputing),
    computeData,
    invalidateCache,
    lastComputed: readonly(lastComputed)
  }
}

/**
 * Debounced updates composable
 * Prevents excessive re-computations during rapid filter changes
 */
export function useDebouncedUpdates<T>(
  updateFn: (data: T) => void,
  delay: number = 300
) {
  let timeoutId: number | null = null
  let lastUpdateTime = 0
  const pendingUpdates = ref<T[]>([])
  const isDebouncing = ref(false)

  const debouncedUpdate = (data: T) => {
    pendingUpdates.value.push(data)
    isDebouncing.value = true

    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    timeoutId = window.setTimeout(() => {
      const latestData = pendingUpdates.value[pendingUpdates.value.length - 1]
      pendingUpdates.value = []

      const startTime = performance.now()
      updateFn(latestData)
      const endTime = performance.now()

      console.log(`Update took ${(endTime - startTime).toFixed(2)}ms`)

      isDebouncing.value = false
      lastUpdateTime = Date.now()
      timeoutId = null
    }, delay)
  }

  const forceUpdate = (data: T) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    pendingUpdates.value = []
    updateFn(data)
    isDebouncing.value = false
    lastUpdateTime = Date.now()
  }

  const cancelPending = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    pendingUpdates.value = []
    isDebouncing.value = false
  }

  onUnmounted(() => {
    cancelPending()
  })

  return {
    debouncedUpdate,
    forceUpdate,
    cancelPending,
    isDebouncing: readonly(isDebouncing),
    lastUpdateTime: readonly(ref(lastUpdateTime)),
    pendingCount: computed(() => pendingUpdates.value.length)
  }
}

/**
 * Lazy loading composable for charts
 * Only renders charts when they become visible
 */
export function useLazyChart(
  containerRef: Ref<HTMLElement | null>,
  options: {
    rootMargin?: string
    threshold?: number
  } = {}
) {
  const isVisible = ref(false)
  const hasBeenVisible = ref(false)
  const isLoading = ref(false)

  let observer: IntersectionObserver | null = null

  const { rootMargin = '50px', threshold = 0.1 } = options

  const startObserving = () => {
    if (!containerRef.value || observer) return

    observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        isVisible.value = entry.isIntersecting

        if (entry.isIntersecting && !hasBeenVisible.value) {
          hasBeenVisible.value = true
          isLoading.value = true

          // Simulate loading delay (remove in production if not needed)
          setTimeout(() => {
            isLoading.value = false
          }, 100)
        }
      },
      { rootMargin, threshold }
    )

    observer.observe(containerRef.value)
  }

  const stopObserving = () => {
    if (observer && containerRef.value) {
      observer.unobserve(containerRef.value)
      observer.disconnect()
      observer = null
    }
  }

  onMounted(() => {
    nextTick(startObserving)
  })

  onUnmounted(() => {
    stopObserving()
  })

  return {
    isVisible: readonly(isVisible),
    hasBeenVisible: readonly(hasBeenVisible),
    isLoading: readonly(isLoading),
    startObserving,
    stopObserving
  }
}

/**
 * Chart memory management composable
 * Handles Chart.js instance cleanup and memory optimization
 */
export function useChartMemoryManagement() {
  const chartInstances = new Map<string, { destroy?: () => void }>()
  const memoryWarnings = ref<string[]>([])

  const registerChart = (_id: string, chartInstance: { destroy?: () => void }) => {
    // Note: Chart registration is simplified - in production you'd want proper ID management
    // For now, we just ensure cleanup on unmount
    chartInstances.set(_id, chartInstance)

    // Memory monitoring (development only)
    if (import.meta.env.DEV && chartInstances.size > 10) {
      memoryWarnings.value.push(`High chart count: ${chartInstances.size} instances`)
    }
  }

  const unregisterChart = (_id: string) => {
    if (chartInstances.has(_id)) {
      const chart = chartInstances.get(_id)
      if (chart && typeof chart.destroy === 'function') {
        chart.destroy()
      }
      chartInstances.delete(_id)
    }
  }

  const cleanupAll = () => {
    chartInstances.forEach((chart) => {
      if (chart && typeof chart.destroy === 'function') {
        chart.destroy()
      }
    })
    chartInstances.clear()
    memoryWarnings.value = []
  }

  const getMemoryStats = () => ({
    activeCharts: chartInstances.size,
    warnings: memoryWarnings.value,
    memoryUsage: (chartInstances.size * 0.5).toFixed(2) + 'MB (estimated)'
  })

  // Cleanup on unmount
  onUnmounted(() => {
    cleanupAll()
  })

  return {
    registerChart,
    unregisterChart,
    cleanupAll,
    getMemoryStats,
    memoryWarnings: readonly(memoryWarnings)
  }
}

/**
 * Progressive data loading composable
 * Loads data in chunks to prevent UI blocking
 */
export function useProgressiveData<T>(
  dataSource: T[],
  options: {
    chunkSize?: number
    delay?: number
    maxTime?: number
  } = {}
) {
  const {
    chunkSize = 1000,
    delay = 16, // ~60fps
    maxTime = 100 // Max time per frame
  } = options

  const loadedData = ref<T[]>([])
  const isLoading = ref(false)
  const progress = ref(0)
  const currentIndex = ref(0)

  const loadProgressive = async (): Promise<T[]> => {
    if (isLoading.value) return loadedData.value

    isLoading.value = true
    loadedData.value = []
    currentIndex.value = 0
    progress.value = 0

    const totalItems = dataSource.length

    const processChunk = () => {
      const startTime = performance.now()
      let processed = 0

      while (
        currentIndex.value < totalItems &&
        processed < chunkSize &&
        (performance.now() - startTime) < maxTime
      ) {
        loadedData.value.push(dataSource[currentIndex.value])
        currentIndex.value++
        processed++
      }

      progress.value = (currentIndex.value / totalItems) * 100

      if (currentIndex.value < totalItems) {
        // Schedule next chunk
        setTimeout(processChunk, delay)
      } else {
        // Finished loading
        isLoading.value = false
      }
    }

    // Start processing
    processChunk()

    return loadedData.value
  }

  const cancelLoading = () => {
    isLoading.value = false
    currentIndex.value = dataSource.length
    progress.value = 100
  }

  return {
    loadedData: readonly(loadedData),
    isLoading: readonly(isLoading),
    progress: readonly(progress),
    loadProgressive,
    cancelLoading,
    currentIndex: readonly(currentIndex)
  }
}

/**
 * Performance monitoring composable
 * Tracks rendering performance and provides metrics
 */
export function usePerformanceMonitoring(componentName: string) {
  const renderTimes = ref<number[]>([])
  const maxSamples = 10

  const recordRenderTime = (startTime: number) => {
    const renderTime = performance.now() - startTime
    renderTimes.value.push(renderTime)

    // Keep only recent samples
    if (renderTimes.value.length > maxSamples) {
      renderTimes.value.shift()
    }

    // Log slow renders
    if (renderTime > 100) {
      console.warn(`${componentName} slow render: ${renderTime.toFixed(2)}ms`)
    }

    return renderTime
  }

  const getMetrics = () => {
    if (renderTimes.value.length === 0) return null

    const times = renderTimes.value
    const avg = times.reduce((a, b) => a + b, 0) / times.length
    const min = Math.min(...times)
    const max = Math.max(...times)
    const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)]

    return {
      average: avg,
      min,
      max,
      p95,
      sampleCount: times.length,
      componentName
    }
  }

  const resetMetrics = () => {
    renderTimes.value = []
  }

  return {
    recordRenderTime,
    getMetrics,
    resetMetrics
  }
}

// Export performance utilities
export { defaultConfig as performanceConfig }
export type { PerformanceConfig }
