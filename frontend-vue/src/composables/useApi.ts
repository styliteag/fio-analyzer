import { computed, reactive, readonly } from 'vue'
import type {
  TestRun,
  FilterOptions,
  UserAccount,
  HealthCheckResponse
} from '@/types'
import { apiClient, ApiClientError } from '@/services/api/client'

// Cache configuration
const CACHE_DURATION = {
  filters: 5 * 60 * 1000, // 5 minutes
  testRuns: 2 * 60 * 1000, // 2 minutes
  users: 10 * 60 * 1000, // 10 minutes
  health: 60 * 60 * 1000, // 1 hour
}

interface CacheEntry<T> {
  data: T
  timestamp: number
  params?: Record<string, string | number | boolean>
}

interface ApiState<T> {
  data: T | null
  loading: boolean
  error: ApiClientError | null
  lastFetched: number | null
}

// Global cache store
const cache = new Map<string, CacheEntry<unknown>>()

// Request deduplication - prevent multiple identical requests
const pendingRequests = new Map<string, Promise<unknown>>()

// Request cancellation - track active AbortControllers
const activeRequests = new Map<string, AbortController>()

export function useApi() {
  // Reactive state for different API endpoints
  const testRuns = reactive<ApiState<TestRun[]>>({
    data: null,
    loading: false,
    error: null,
    lastFetched: null,
  })

  const filters = reactive<ApiState<FilterOptions>>({
    data: null,
    loading: false,
    error: null,
    lastFetched: null,
  })

  const users = reactive<ApiState<UserAccount[]>>({
    data: null,
    loading: false,
    error: null,
    lastFetched: null,
  })

  const health = reactive<ApiState<HealthCheckResponse>>({
    data: null,
    loading: false,
    error: null,
    lastFetched: null,
  })

  // Computed properties
  const isLoading = computed(() =>
    testRuns.loading || filters.loading || users.loading || health.loading
  )

  const hasError = computed(() =>
    testRuns.error !== null || filters.error !== null ||
    users.error !== null || health.error !== null
  )

  // Cache utilities
  function getCacheKey(endpoint: string, params?: Record<string, string | number | boolean>): string {
    const paramStr = params ? JSON.stringify(params) : ''
    return `${endpoint}:${paramStr}`
  }

  function getCachedData<T>(key: string, duration: number): T | null {
    const entry = cache.get(key)
    if (!entry) return null

    const now = Date.now()
    if (now - entry.timestamp > duration) {
      cache.delete(key)
      return null
    }

    return entry.data
  }

  function setCachedData<T>(key: string, data: T, params?: Record<string, string | number | boolean>): void {
    cache.set(key, {
      data,
      timestamp: Date.now(),
      params,
    })
  }

  function isCacheValid(key: string, duration: number): boolean {
    const entry = cache.get(key)
    if (!entry) return false

    const now = Date.now()
    return now - entry.timestamp <= duration
  }

  // Request deduplication
  function getPendingRequest<T>(key: string): Promise<T> | null {
    return pendingRequests.get(key) || null
  }

  function setPendingRequest<T>(key: string, promise: Promise<T>): void {
    pendingRequests.set(key, promise)

    // Clean up when request completes
    promise.finally(() => {
      pendingRequests.delete(key)
    })
  }

  // Request cancellation
  function createAbortController(key: string): AbortController {
    // Cancel any existing request with the same key
    const existingController = activeRequests.get(key)
    if (existingController) {
      existingController.abort('Superseded by new request')
    }

    // Create new controller
    const controller = new AbortController()
    activeRequests.set(key, controller)

    return controller
  }

  function cleanupRequest(key: string): void {
    activeRequests.delete(key)
    pendingRequests.delete(key)
  }

  function cancelRequest(key: string): boolean {
    const controller = activeRequests.get(key)
    if (controller) {
      controller.abort('Request cancelled by user')
      cleanupRequest(key)
      return true
    }
    return false
  }

  function cancelAllRequests(): void {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    activeRequests.forEach((controller, _key) => {
      controller.abort('All requests cancelled')
    })
    activeRequests.clear()
    pendingRequests.clear()
  }

  // Error handling
  function getError(): ApiClientError | null {
    return testRuns.error || filters.error || users.error || health.error
  }

  function clearError(): void {
    testRuns.error = null
    filters.error = null
    users.error = null
    health.error = null
  }

  function clearAllErrors(): void {
    clearError()
  }

  // API methods
  async function fetchTestRuns(params?: Record<string, string | number>): Promise<TestRun[]> {
    const cacheKey = getCacheKey('testRuns', params)
    const pending = getPendingRequest<TestRun[]>(cacheKey)

    if (pending) {
      return pending
    }

    // Check cache first
    if (!params || Object.keys(params).length === 0) {
      const cached = getCachedData<TestRun[]>(cacheKey, CACHE_DURATION.testRuns)
      if (cached) {
        testRuns.data = cached
        testRuns.lastFetched = Date.now()
        return cached
      }
    }

    testRuns.loading = true
    testRuns.error = null

    try {
      let url = '/api/test-runs/'
      if (params && Object.keys(params).length > 0) {
        const searchParams = new URLSearchParams(params as Record<string, string>)
        url += `?${searchParams.toString()}`
      }

      const request = apiClient.get<TestRun[]>(url)

      setPendingRequest(cacheKey, request)

      const data = await request

      // Validate response structure
      if (!Array.isArray(data)) {
        throw new ApiClientError(500, 'Invalid response format: expected array')
      }

      testRuns.data = data
      testRuns.loading = false
      testRuns.lastFetched = Date.now()

      // Cache the result
      setCachedData(cacheKey, data, params)

      return data
    } catch (error) {
      testRuns.loading = false
      testRuns.error = error as ApiClientError
      throw error
    }
  }

  async function fetchFilters(): Promise<FilterOptions> {
    const cacheKey = getCacheKey('filters')
    const pending = getPendingRequest<FilterOptions>(cacheKey)

    if (pending) {
      return pending
    }

    // Check cache
    const cached = getCachedData<FilterOptions>(cacheKey, CACHE_DURATION.filters)
    if (cached) {
      filters.data = cached
      filters.lastFetched = Date.now()
      return cached
    }

    filters.loading = true
    filters.error = null

    try {
      const request = apiClient.get<FilterOptions>('/api/filters/')

      setPendingRequest(cacheKey, request)

      const data = await request

      // Validate response structure
      if (!data || typeof data !== 'object') {
        throw new ApiClientError(500, 'Invalid response format: expected object')
      }

      filters.data = data
      filters.loading = false
      filters.lastFetched = Date.now()

      // Cache the result
      setCachedData(cacheKey, data)

      return data
    } catch (error) {
      filters.loading = false
      filters.error = error as ApiClientError
      throw error
    }
  }

  async function fetchUsers(): Promise<UserAccount[]> {
    const cacheKey = getCacheKey('users')
    const pending = getPendingRequest<UserAccount[]>(cacheKey)

    if (pending) {
      return pending
    }

    // Check cache
    const cached = getCachedData<UserAccount[]>(cacheKey, CACHE_DURATION.users)
    if (cached) {
      users.data = cached
      users.lastFetched = Date.now()
      return cached
    }

    users.loading = true
    users.error = null

    try {
      const request = apiClient.get<UserAccount[]>('/api/users/')

      setPendingRequest(cacheKey, request)

      const data = await request

      if (!Array.isArray(data)) {
        throw new ApiClientError(500, 'Invalid response format: expected array')
      }

      users.data = data
      users.loading = false
      users.lastFetched = Date.now()

      setCachedData(cacheKey, data)

      return data
    } catch (error) {
      users.loading = false
      users.error = error as ApiClientError
      throw error
    }
  }

  async function createUser(userData: { username: string; password: string; role: string }): Promise<{ message: string; user: UserAccount }> {
    users.loading = true
    users.error = null

    try {
      const data = await apiClient.post<{ message: string; user: UserAccount }>('/api/users/', userData)

      users.loading = false

      // Invalidate users cache since we added a new user
      cache.delete(getCacheKey('users'))

      return data
    } catch (error) {
      users.loading = false
      users.error = error as ApiClientError
      throw error
    }
  }

  async function updateUser(username: string, updates: Partial<Pick<UserAccount, 'username' | 'role' | 'permissions'>>): Promise<{ message: string }> {
    users.loading = true
    users.error = null

    try {
      const data = await apiClient.put<{ message: string }>(`/api/users/${username}`, updates)

      users.loading = false

      // Invalidate users cache since we updated a user
      cache.delete(getCacheKey('users'))

      return data
    } catch (error) {
      users.loading = false
      users.error = error as ApiClientError
      throw error
    }
  }

  async function deleteUser(username: string): Promise<{ message: string }> {
    users.loading = true
    users.error = null

    try {
      const data = await apiClient.delete<{ message: string }>(`/api/users/${username}`)

      users.loading = false

      // Invalidate users cache since we deleted a user
      cache.delete(getCacheKey('users'))

      return data
    } catch (error) {
      users.loading = false
      users.error = error as ApiClientError
      throw error
    }
  }

  async function fetchHealth(): Promise<HealthCheckResponse> {
    const cacheKey = getCacheKey('health')
    const pending = getPendingRequest<HealthCheckResponse>(cacheKey)

    if (pending) {
      return pending
    }

    // Check cache
    const cached = getCachedData<HealthCheckResponse>(cacheKey, CACHE_DURATION.health)
    if (cached) {
      health.data = cached
      health.lastFetched = Date.now()
      return cached
    }

    health.loading = true
    health.error = null

    try {
      const request = apiClient.get<HealthCheckResponse>('/health')

      setPendingRequest(cacheKey, request)

      const data = await request

      health.data = data
      health.loading = false
      health.lastFetched = Date.now()

      setCachedData(cacheKey, data)

      return data
    } catch (error) {
      health.loading = false
      health.error = error as ApiClientError
      throw error
    }
  }

  async function uploadData(formData: FormData): Promise<{ message: string; imported: number; failed: number; test_run_ids: number[] }> {
    testRuns.loading = true
    testRuns.error = null

    try {
      const data = await apiClient.upload<{ message: string; imported: number; failed: number; test_run_ids: number[] }>('/api/import', formData)

      testRuns.loading = false

      // Invalidate test runs and filters cache since we added new data
      cache.delete(getCacheKey('testRuns'))
      cache.delete(getCacheKey('filters'))

      return data
    } catch (error) {
      testRuns.loading = false
      testRuns.error = error as ApiClientError
      throw error
    }
  }

  // Cache management
  function clearCache(): void {
    cache.clear()
  }

  function clearEndpointCache(endpoint: string): void {
    const keysToDelete = Array.from(cache.keys()).filter(key => key.startsWith(`${endpoint}:`))
    keysToDelete.forEach(key => cache.delete(key))
  }

  // Utility methods
  function isCached(endpoint: string, params?: Record<string, string | number | boolean>): boolean {
    const cacheKey = getCacheKey(endpoint, params)
    const duration = CACHE_DURATION[endpoint as keyof typeof CACHE_DURATION] || 0
    return isCacheValid(cacheKey, duration)
  }

  function getCacheAge(endpoint: string, params?: Record<string, string | number | boolean>): number | null {
    const cacheKey = getCacheKey(endpoint, params)
    const entry = cache.get(cacheKey)
    return entry ? Date.now() - entry.timestamp : null
  }

  // Generic fetch function with cancellation support
  async function fetchWithErrorHandling<T>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
      params?: Record<string, string | number | boolean>
      body?: unknown
      headers?: Record<string, string>
      cancelKey?: string
    } = {}
  ): Promise<T | null> {
    const {
      method = 'GET',
      params,
      body,
      headers,
      cancelKey = `${method}:${endpoint}`
    } = options

    try {
      // Create abort controller for cancellation
      const controller = createAbortController(cancelKey)

      let url = endpoint
      if (params && method === 'GET') {
        const searchParams = new URLSearchParams(params as Record<string, string>)
        url += `?${searchParams.toString()}`
      }

      const requestOptions: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        signal: controller.signal,
      }

      if (body && method !== 'GET') {
        requestOptions.body = JSON.stringify(body)
      }

      const response = await fetch(url, requestOptions)

      // Clean up successful request
      cleanupRequest(cancelKey)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      cleanupRequest(cancelKey)

      // Don't throw AbortError - just return null for cancelled requests
      if (error instanceof Error && error.name === 'AbortError') {
        console.log(`Request cancelled: ${cancelKey}`)
        return null
      }

      console.error(`API Error (${endpoint}):`, error)
      throw error
    }
  }

  return {
    // Reactive state (readonly to prevent external mutations)
    testRuns: readonly(testRuns),
    filters: readonly(filters),
    users: readonly(users),
    health: readonly(health),

    // Computed properties
    isLoading,
    hasError,

    // API methods
    fetchTestRuns,
    fetchFilters,
    fetchUsers,
    createUser,
    updateUser,
    deleteUser,
    fetchHealth,
    uploadData,

    // Generic fetch with cancellation support
    fetchWithErrorHandling,

    // Request cancellation
    cancelRequest,
    cancelAllRequests,

    // Error handling
    getError,
    clearError,
    clearAllErrors,

    // Cache management
    clearCache,
    clearEndpointCache,
    isCached,
    getCacheAge,
  }
}
