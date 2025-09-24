// API client shared across Vue pages/composables. Mirrors the backend contract
// exposed by the existing FastAPI service so we stay aligned with the React app.

const API_BASE_URL = (import.meta as unknown as { env?: { VITE_API_URL?: string } })?.env?.VITE_API_URL || ''
const AUTH_STORAGE_KEY = 'fio-auth'

export interface TestRun {
  id: number
  timestamp: string
  drive_model: string | null
  drive_type: string | null
  test_name: string | null
  description?: string | null
  block_size: string | number
  read_write_pattern: string | null
  queue_depth: number
  duration: number | null
  fio_version?: string | null
  job_runtime?: number | null
  rwmixread?: number | null
  total_ios_read?: number | null
  total_ios_write?: number | null
  usr_cpu?: number | null
  sys_cpu?: number | null
  hostname?: string | null
  protocol?: string | null
  output_file?: string | null
  num_jobs?: number | null
  direct?: number | null
  test_size?: string | null
  sync?: number | null
  iodepth?: number | null
  is_latest?: number | null
  iops?: number | null
  avg_latency?: number | null
  bandwidth?: number | null
  p95_latency?: number | null
  p99_latency?: number | null
}

export interface FilterOptions {
  drive_models: string[]
  host_disk_combinations: string[]
  block_sizes: Array<string | number>
  patterns: string[]
  syncs: number[]
  queue_depths: number[]
  directs: number[]
  num_jobs: number[]
  test_sizes: string[]
  durations: number[]
  hostnames: string[]
  protocols: string[]
  drive_types: string[]
}

export interface TestRunFilters {
  hostnames?: string[]
  protocols?: string[]
  drive_types?: string[]
  drive_models?: string[]
  patterns?: string[]
  block_sizes?: Array<string | number>
  syncs?: number[]
  queue_depths?: number[]
  directs?: number[]
  num_jobs?: number[]
  test_sizes?: string[]
  durations?: number[]
}

interface ApiErrorResponse {
  detail?: string
  error?: string
  message?: string
}

function buildUrl(endpoint: string): string {
  if (!API_BASE_URL) {
    return endpoint
  }

  if (API_BASE_URL.endsWith('/') && endpoint.startsWith('/')) {
    return `${API_BASE_URL}${endpoint.slice(1)}`
  }

  if (!API_BASE_URL.endsWith('/') && !endpoint.startsWith('/')) {
    return `${API_BASE_URL}/${endpoint}`
  }

  return `${API_BASE_URL}${endpoint}`
}

function readStoredCredentials(): string | null {
  const storedAuth = localStorage.getItem(AUTH_STORAGE_KEY)
  if (!storedAuth) return null

  try {
    const parsed = JSON.parse(storedAuth) as { credentials?: string }
    return parsed.credentials ?? null
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY)
    return null
  }
}

class ApiClient {
  private getAuthHeaders(): Record<string, string> {
    const credentials = readStoredCredentials()
    if (!credentials) return {}
    return { Authorization: `Basic ${credentials}` }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = buildUrl(endpoint)
    const headers = new Headers(options.headers ?? {})

    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json')
    }

    // Only set content-type for non-FormData payloads
    const isFormData = options.body instanceof FormData
    if (!isFormData && options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }

    Object.entries(this.getAuthHeaders()).forEach(([key, value]) => {
      if (!headers.has(key)) {
        headers.set(key, value)
      }
    })

    const response = await fetch(url, {
      ...options,
      headers,
    })

    if (response.status === 401) {
      localStorage.removeItem(AUTH_STORAGE_KEY)
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
      throw new Error('Authentication required')
    }

    const contentType = response.headers.get('content-type') ?? ''

    if (!response.ok) {
      let message = response.statusText

      if (contentType.includes('application/json')) {
        const payload = (await response.json().catch(() => ({}))) as ApiErrorResponse
        message = payload.detail || payload.error || payload.message || message
      }

      throw new Error(`API Error ${response.status}: ${message}`)
    }

    if (response.status === 204 || !contentType.includes('application/json')) {
      return undefined as T
    }

    return response.json() as Promise<T>
  }

  async getTestRuns(filters?: TestRunFilters): Promise<TestRun[]> {
    const params = new URLSearchParams()

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (!value || (Array.isArray(value) && value.length === 0)) {
          return
        }

        if (Array.isArray(value)) {
          params.set(key, value.map((item) => item.toString()).join(','))
        } else {
          params.set(key, value.toString())
        }
      })
    }

    const query = params.toString()
    const endpoint = `/api/test-runs${query ? `?${query}` : ''}`
    const data = await this.request<TestRun[]>(endpoint)

    return data.map((run) => ({
      ...run,
      block_size: typeof run.block_size === 'number' ? run.block_size.toString() : run.block_size,
    }))
  }

  async getFilterOptions(): Promise<FilterOptions> {
    return this.request<FilterOptions>('/api/filters')
  }

  async uploadFile(file: File): Promise<{ message: string; imported_count: number }> {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(buildUrl('/api/import'), {
      method: 'POST',
      body: formData,
      headers: this.getAuthHeaders(),
    })

    if (response.status === 401) {
      localStorage.removeItem(AUTH_STORAGE_KEY)
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
      throw new Error('Authentication required')
    }

    if (!response.ok) {
      const contentType = response.headers.get('content-type') ?? ''
      let message = response.statusText

      if (contentType.includes('application/json')) {
        const payload = (await response.json().catch(() => ({}))) as ApiErrorResponse
        message = payload.detail || payload.error || payload.message || message
      }

      throw new Error(`Upload failed: ${message}`)
    }

    return response.json() as Promise<{ message: string; imported_count: number }>
  }

  async healthCheck(): Promise<{ status: string }> {
    return this.request<{ status: string }>('/api/health')
  }
}

export const apiClient = new ApiClient()
export default apiClient
