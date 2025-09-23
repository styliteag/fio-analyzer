// API Client for FIO Analyzer Vue Frontend
// Preserves same API contracts as React frontend

export interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
}

export interface TestRun {
  id: number
  hostname: string
  drive_type: string
  test_type: string
  timestamp: string
  iops_read: number
  iops_write: number
  latency_read_avg: number
  latency_write_avg: number
  latency_read_p95: number
  latency_write_p95: number
  latency_read_p99: number
  latency_write_p99: number
  bandwidth_read: number
  bandwidth_write: number
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
  hostname?: string
  drive_type?: string
  test_type?: string
  start_date?: string
  end_date?: string
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
  async getTestRuns(filters?: TestRunFilters): Promise<TestRun[]> {
    const params = new URLSearchParams()

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          params.append(key, value)
        }
      })
    }

    const endpoint = `/test-runs${params.toString() ? `?${params.toString()}` : ''}`
    return this.request<TestRun[]>(endpoint)
  }

  // Filters API
  async getFilterOptions(): Promise<FilterOptions> {
    return this.request<FilterOptions>('/filters')
  }

  // Time Series APIs
  async getIOPSTimeSeries(hostname: string, metric: 'read' | 'write'): Promise<TimeSeriesData> {
    return this.request<TimeSeriesData>(`/time-series/iops?hostname=${hostname}&metric=${metric}`)
  }

  async getLatencyTimeSeries(
    hostname: string,
    metric: 'read_avg' | 'write_avg' | 'read_p95' | 'write_p95' | 'read_p99' | 'write_p99'
  ): Promise<TimeSeriesData> {
    return this.request<TimeSeriesData>(`/time-series/latency?hostname=${hostname}&metric=${metric}`)
  }

  async getBandwidthTimeSeries(hostname: string, metric: 'read' | 'write'): Promise<TimeSeriesData> {
    return this.request<TimeSeriesData>(`/time-series/bandwidth?hostname=${hostname}&metric=${metric}`)
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