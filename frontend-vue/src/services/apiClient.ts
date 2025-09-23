// API Client for FIO Analyzer Vue Frontend
// Preserves same API contracts as React frontend

export interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
}

export interface TestRun {
  id: number
  timestamp: string
  drive_model?: string
  drive_type?: string
  test_name?: string
  description?: string
  block_size: string | number
  read_write_pattern: string
  queue_depth: number
  duration?: number
  fio_version?: string
  job_runtime?: number
  rwmixread?: number
  total_ios_read?: number
  total_ios_write?: number
  usr_cpu?: number
  sys_cpu?: number
  hostname?: string
  protocol?: string
  output_file?: string
  num_jobs?: number
  direct?: number
  test_size?: string
  sync?: number
  iodepth?: number
  is_latest?: number
  iops?: number | null
  avg_latency?: number | null
  bandwidth?: number | null
  p95_latency?: number | null
  p99_latency?: number | null
}

export interface FilterOptions {
  hostnames: string[]
  drive_types: string[]
  test_types: string[]
}

export interface TimeSeriesData {
  timestamps: string[]
  values: number[]
  metric: string
  hostname: string
}

export interface TestRunFilters {
  hostnames?: string[]
  protocols?: string[]
  drive_types?: string[]
  drive_models?: string[]
  patterns?: string[]
  block_sizes?: (string | number)[]
  syncs?: number[]
  queue_depths?: number[]
  directs?: number[]
  num_jobs?: number[]
  test_sizes?: string[]
  durations?: number[]
}

class ApiClient {
  private baseUrl = '/api'

  private getAuthHeaders(): Record<string, string> {
    const storedAuth = localStorage.getItem('fio-auth')
    if (storedAuth) {
      try {
        const { credentials } = JSON.parse(storedAuth)
        return {
          'Authorization': `Basic ${credentials}`,
        }
      } catch {
        // If parsing fails, remove invalid auth data
        localStorage.removeItem('fio-auth')
      }
    }
    return {}
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`

    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
        ...options.headers,
      },
      ...options,
    }

    // Handle 401 responses by clearing auth and reloading
    const response = await fetch(url, config)

    if (response.status === 401) {
      localStorage.removeItem('fio-auth')
      window.location.reload()
      throw new Error('Authentication required')
    }

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  // Test Runs API
  async getTestRuns(filters?: TestRunFilters): Promise<{ data: TestRun[]; total: number; limit: number; offset: number }> {
    const params = new URLSearchParams()

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach(item => params.append(key, item.toString()))
        } else if (value !== undefined && value !== null) {
          params.append(key, value.toString())
        }
      })
    }

    const endpoint = `/test-runs${params.toString() ? `?${params.toString()}` : ''}`
    return this.request<{ data: TestRun[]; total: number; limit: number; offset: number }>(endpoint)
  }

  // Filters API
  async getFilterOptions(): Promise<FilterOptions> {
    return this.request<FilterOptions>('/filters')
  }


  // File Upload API
  async uploadFile(file: File): Promise<{ message: string; imported_count: number }> {
    const formData = new FormData()
    formData.append('file', file)

    return this.request<{ message: string; imported_count: number }>('/import', {
      method: 'POST',
      body: formData,
      headers: {
        // Don't set Content-Type for FormData, let browser set it with boundary
      },
    })
  }


  // Health Check
  async healthCheck(): Promise<{ status: string }> {
    return this.request<{ status: string }>('/health')
  }
}

export const apiClient = new ApiClient()
export default apiClient