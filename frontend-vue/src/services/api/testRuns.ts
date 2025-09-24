import { apiClient, ApiClientError } from './client'
import type { TestRun } from '@/types'

// API response types
interface TestRunsResponse {
  data: TestRun[]
  total?: number
  page?: number
  pageSize?: number
  hasMore?: boolean
}

interface SingleTestRunResponse {
  data: TestRun
}

interface PerformanceDataResponse {
  data: Array<{
    id: number
    drive_model: string
    test_name: string
    block_size: string
    read_write_pattern: string
    timestamp: string
    hostname: string
    metrics: {
      iops: { value: number; unit: string }
      avg_latency: { value: number; unit: string }
      bandwidth: { value: number; unit: string }
      p95_latency?: { value: number; unit: string }
      p99_latency?: { value: number; unit: string }
    }
  }>
}

interface UploadResponse {
  message: string
  imported: number
  failed: number
  test_run_ids: number[]
}

// Query parameters for test runs
export interface TestRunsQuery {
  // Filter parameters
  hostnames?: string
  drive_types?: string
  drive_models?: string
  protocols?: string
  patterns?: string
  block_sizes?: string
  syncs?: string
  queue_depths?: string
  directs?: string
  num_jobs?: string
  test_sizes?: string
  durations?: string

  // Pagination
  limit?: number
  offset?: number
}

// Test runs API service
export class TestRunsApiService {
  private baseUrl = '/api/test-runs'

  /**
   * Get test runs with optional filtering and pagination
   */
  async getTestRuns(query?: TestRunsQuery): Promise<TestRun[]> {
    try {
      let url = this.baseUrl

      // Build query string from filters
      if (query) {
        const params = new URLSearchParams()

        // Add filter parameters
        Object.entries(query).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            if (typeof value === 'number') {
              params.append(key, value.toString())
            } else if (typeof value === 'string') {
              params.append(key, value)
            }
          }
        })

        const queryString = params.toString()
        if (queryString) {
          url += `?${queryString}`
        }
      }

      const response = await apiClient.get<TestRunsResponse>(url)

      // Handle both array and object responses
      if (Array.isArray(response)) {
        return response
      }

      return response.data || []
    } catch (error) {
      console.error('Failed to fetch test runs:', error)
      throw error
    }
  }

  /**
   * Get a single test run by ID
   */
  async getTestRun(id: number): Promise<TestRun> {
    try {
      const response = await apiClient.get<SingleTestRunResponse>(`${this.baseUrl}/${id}`)

      if (response.data) {
        return response.data
      }

      throw new ApiClientError(500, 'Invalid response format')
    } catch (error) {
      console.error(`Failed to fetch test run ${id}:`, error)
      throw error
    }
  }

  /**
   * Get performance data for specific test runs
   */
  async getPerformanceData(testRunIds: number[]): Promise<PerformanceDataResponse['data']> {
    if (!testRunIds || testRunIds.length === 0) {
      return []
    }

    try {
      const idsParam = testRunIds.join(',')
      const response = await apiClient.get<PerformanceDataResponse>(
        `${this.baseUrl}/performance-data?test_run_ids=${idsParam}`
      )

      return response.data || []
    } catch (error) {
      console.error('Failed to fetch performance data:', error)
      throw error
    }
  }

  /**
   * Update a test run (partial update)
   */
  async updateTestRun(id: number, updates: Partial<TestRun>): Promise<TestRun> {
    try {
      const response = await apiClient.put<SingleTestRunResponse>(
        `${this.baseUrl}/${id}`,
        updates
      )

      if (response.data) {
        return response.data
      }

      throw new ApiClientError(500, 'Invalid response format')
    } catch (error) {
      console.error(`Failed to update test run ${id}:`, error)
      throw error
    }
  }

  /**
   * Bulk update test runs
   */
  async bulkUpdateTestRuns(updates: Array<{ id: number; data: Partial<TestRun> }>): Promise<TestRun[]> {
    try {
      const response = await apiClient.put<TestRunsResponse>(
        `${this.baseUrl}/bulk`,
        updates
      )

      if (response.data) {
        return response.data
      }

      throw new ApiClientError(500, 'Invalid response format')
    } catch (error) {
      console.error('Failed to bulk update test runs:', error)
      throw error
    }
  }

  /**
   * Delete a test run
   */
  async deleteTestRun(id: number): Promise<void> {
    try {
      await apiClient.delete(`${this.baseUrl}/${id}`)
    } catch (error) {
      console.error(`Failed to delete test run ${id}:`, error)
      throw error
    }
  }

  /**
   * Upload test run data
   */
  async uploadTestRuns(file: File): Promise<UploadResponse> {
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await apiClient.upload<UploadResponse>('/api/import', formData)
      return response
    } catch (error) {
      console.error('Failed to upload test runs:', error)
      throw error
    }
  }

  /**
   * Bulk upload test run data from multiple files
   */
  async bulkUploadTestRuns(files: File[]): Promise<UploadResponse> {
    try {
      const formData = new FormData()

      files.forEach((file) => {
        formData.append('files', file)
      })

      const response = await apiClient.upload<UploadResponse>('/api/import/bulk', formData)
      return response
    } catch (error) {
      console.error('Failed to bulk upload test runs:', error)
      throw error
    }
  }

  /**
   * Get test runs statistics
   */
  async getStatistics(query?: TestRunsQuery): Promise<{
    total: number
    average_iops: number
    average_latency: number
    average_bandwidth: number
    hostnames: string[]
    drive_types: string[]
    date_range: { start: string; end: string }
  }> {
    try {
      let url = `${this.baseUrl}/statistics`

      if (query) {
        const params = new URLSearchParams()

        Object.entries(query).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            if (typeof value === 'number') {
              params.append(key, value.toString())
            } else if (typeof value === 'string') {
              params.append(key, value)
            }
          }
        })

        const queryString = params.toString()
        if (queryString) {
          url += `?${queryString}`
        }
      }

      const response = await apiClient.get(url)
      return response
    } catch (error) {
      console.error('Failed to fetch test runs statistics:', error)
      throw error
    }
  }

  /**
   * Search test runs by text query
   */
  async searchTestRuns(query: string, filters?: TestRunsQuery): Promise<TestRun[]> {
    try {
      const params = new URLSearchParams()
      params.append('q', query)

      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            if (typeof value === 'number') {
              params.append(key, value.toString())
            } else if (typeof value === 'string') {
              params.append(key, value)
            }
          }
        })
      }

      const url = `${this.baseUrl}/search?${params.toString()}`
      const response = await apiClient.get<TestRunsResponse>(url)

      if (Array.isArray(response)) {
        return response
      }

      return response.data || []
    } catch (error) {
      console.error('Failed to search test runs:', error)
      throw error
    }
  }

  /**
   * Get test runs grouped by various criteria
   */
  async getGroupedTestRuns(
    groupBy: 'hostname' | 'drive_type' | 'drive_model' | 'protocol' | 'block_size',
    filters?: TestRunsQuery
  ): Promise<Record<string, TestRun[]>> {
    try {
      const params = new URLSearchParams()
      params.append('group_by', groupBy)

      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            if (typeof value === 'number') {
              params.append(key, value.toString())
            } else if (typeof value === 'string') {
              params.append(key, value)
            }
          }
        })
      }

      const url = `${this.baseUrl}/grouped?${params.toString()}`
      const response = await apiClient.get(url)
      return response
    } catch (error) {
      console.error('Failed to fetch grouped test runs:', error)
      throw error
    }
  }

  /**
   * Export test runs to various formats
   */
  async exportTestRuns(
    format: 'json' | 'csv' | 'excel',
    filters?: TestRunsQuery
  ): Promise<Blob> {
    try {
      const params = new URLSearchParams()
      params.append('format', format)

      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            if (typeof value === 'number') {
              params.append(key, value.toString())
            } else if (typeof value === 'string') {
              params.append(key, value)
            }
          }
        })
      }

      const url = `${this.baseUrl}/export?${params.toString()}`

      // For binary responses, we need to handle differently
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': format === 'json' ? 'application/json' :
                   format === 'csv' ? 'text/csv' :
                   'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      })

      if (!response.ok) {
        throw new ApiClientError(response.status, `Export failed: ${response.statusText}`)
      }

      return await response.blob()
    } catch (error) {
      console.error('Failed to export test runs:', error)
      throw error
    }
  }
}

// Create and export singleton instance
export const testRunsApi = new TestRunsApiService()
