import { apiClient, ApiClientError } from './client'
import type { FilterOptions } from '@/types'

// API response types
interface FiltersResponse {
  data: FilterOptions
}

// Filters API service
export class FiltersApiService {
  private baseUrl = '/api/filters'

  /**
   * Get all available filter options
   */
  async getFilters(): Promise<FilterOptions> {
    try {
      const response = await apiClient.get<FiltersResponse>(this.baseUrl)

      if (response.data) {
        return response.data
      }

      // Handle case where response is directly the FilterOptions object
      if (typeof response === 'object' && !Array.isArray(response)) {
        return response as FilterOptions
      }

      throw new ApiClientError(500, 'Invalid response format for filters')
    } catch (error) {
      console.error('Failed to fetch filters:', error)
      throw error
    }
  }

  /**
   * Get filter options for a specific category
   */
  async getFilterCategory(category: keyof FilterOptions): Promise<(string | number)[]> {
    try {
      const response = await apiClient.get<{ data: (string | number)[] }>(
        `${this.baseUrl}/${category}`
      )

      if (response.data && Array.isArray(response.data)) {
        return response.data
      }

      throw new ApiClientError(500, `Invalid response format for ${category} filters`)
    } catch (error) {
      console.error(`Failed to fetch ${category} filters:`, error)
      throw error
    }
  }

  /**
   * Get hostnames filter options
   */
  async getHostnames(): Promise<string[]> {
    const result = await this.getFilterCategory('hostnames')
    return result as string[]
  }

  /**
   * Get drive types filter options
   */
  async getDriveTypes(): Promise<string[]> {
    const result = await this.getFilterCategory('drive_types')
    return result as string[]
  }

  /**
   * Get drive models filter options
   */
  async getDriveModels(): Promise<string[]> {
    const result = await this.getFilterCategory('drive_models')
    return result as string[]
  }

  /**
   * Get protocols filter options
   */
  async getProtocols(): Promise<string[]> {
    const result = await this.getFilterCategory('protocols')
    return result as string[]
  }

  /**
   * Get block sizes filter options
   */
  async getBlockSizes(): Promise<string[]> {
    const result = await this.getFilterCategory('block_sizes')
    return result as string[]
  }

  /**
   * Get I/O patterns filter options
   */
  async getPatterns(): Promise<string[]> {
    const result = await this.getFilterCategory('patterns')
    return result as string[]
  }

  /**
   * Get sync modes filter options
   */
  async getSyncModes(): Promise<number[]> {
    const result = await this.getFilterCategory('syncs')
    return result as number[]
  }

  /**
   * Get queue depths filter options
   */
  async getQueueDepths(): Promise<number[]> {
    const result = await this.getFilterCategory('queue_depths')
    return result as number[]
  }

  /**
   * Get direct I/O modes filter options
   */
  async getDirectModes(): Promise<number[]> {
    const result = await this.getFilterCategory('directs')
    return result as number[]
  }

  /**
   * Get job counts filter options
   */
  async getJobCounts(): Promise<number[]> {
    const result = await this.getFilterCategory('num_jobs')
    return result as number[]
  }

  /**
   * Get test sizes filter options
   */
  async getTestSizes(): Promise<string[]> {
    const result = await this.getFilterCategory('test_sizes')
    return result as string[]
  }

  /**
   * Get durations filter options
   */
  async getDurations(): Promise<number[]> {
    const result = await this.getFilterCategory('durations')
    return result as number[]
  }

  /**
   * Get host-disk combinations filter options
   */
  async getHostDiskCombinations(): Promise<string[]> {
    const result = await this.getFilterCategory('host_disk_combinations')
    return result as string[]
  }

  /**
   * Validate filter values against available options
   */
  async validateFilters(filters: Record<string, any>): Promise<{
    valid: boolean
    invalidFields: string[]
    suggestions: Record<string, (string | number)[]>
  }> {
    try {
      const availableFilters = await this.getFilters()
      const invalidFields: string[] = []
      const suggestions: Record<string, (string | number)[]> = {}

      Object.entries(filters).forEach(([category, values]) => {
        if (!values || (Array.isArray(values) && values.length === 0)) return

        const valueArray = Array.isArray(values) ? values : [values]
        const availableValues = availableFilters[category as keyof FilterOptions]

        if (availableValues) {
          const availableSet = new Set(availableValues)
          const invalidValues = valueArray.filter(val => !availableSet.has(val as never))

          if (invalidValues.length > 0) {
            invalidFields.push(category)
            suggestions[category] = availableValues
          }
        }
      })

      return {
        valid: invalidFields.length === 0,
        invalidFields,
        suggestions,
      }
    } catch (error) {
      console.error('Failed to validate filters:', error)
      return {
        valid: false,
        invalidFields: Object.keys(filters),
        suggestions: {},
      }
    }
  }

  /**
   * Get filter statistics (usage counts, etc.)
   */
  async getFilterStatistics(): Promise<{
    totalHosts: number
    totalDriveTypes: number
    totalDriveModels: number
    totalProtocols: number
    totalBlockSizes: number
    totalPatterns: number
    mostCommonHost: string | null
    mostCommonDriveType: string | null
    mostCommonBlockSize: string | null
  }> {
    try {
      const filters = await this.getFilters()

      return {
        totalHosts: filters.hostnames?.length || 0,
        totalDriveTypes: filters.drive_types?.length || 0,
        totalDriveModels: filters.drive_models?.length || 0,
        totalProtocols: filters.protocols?.length || 0,
        totalBlockSizes: filters.block_sizes?.length || 0,
        totalPatterns: filters.patterns?.length || 0,
        mostCommonHost: filters.hostnames?.[0] || null,
        mostCommonDriveType: filters.drive_types?.[0] || null,
        mostCommonBlockSize: filters.block_sizes?.[0] || null,
      }
    } catch (error) {
      console.error('Failed to get filter statistics:', error)
      throw error
    }
  }

  /**
   * Refresh filter options (force cache invalidation)
   */
  async refreshFilters(): Promise<FilterOptions> {
    try {
      // Add cache-busting parameter
      const response = await apiClient.get<FiltersResponse>(
        `${this.baseUrl}?t=${Date.now()}`
      )

      if (response.data) {
        return response.data
      }

      if (typeof response === 'object' && !Array.isArray(response)) {
        return response as FilterOptions
      }

      throw new ApiClientError(500, 'Invalid response format for refreshed filters')
    } catch (error) {
      console.error('Failed to refresh filters:', error)
      throw error
    }
  }

  /**
   * Search filter options
   */
  async searchFilters(query: string, category?: keyof FilterOptions): Promise<{
    results: Record<string, (string | number)[]>
    totalMatches: number
  }> {
    try {
      const params = new URLSearchParams()
      params.append('q', query)

      if (category) {
        params.append('category', category)
      }

      const response = await apiClient.get<{
        results: Record<string, (string | number)[]>
        totalMatches: number
      }>(`${this.baseUrl}/search?${params.toString()}`)

      return response
    } catch (error) {
      console.error('Failed to search filters:', error)
      throw error
    }
  }

  /**
   * Get filter suggestions based on partial input
   */
  async getFilterSuggestions(
    partial: string,
    category: keyof FilterOptions,
    limit = 10
  ): Promise<(string | number)[]> {
    try {
      const params = new URLSearchParams()
      params.append('partial', partial)
      params.append('category', category)
      params.append('limit', limit.toString())

      const response = await apiClient.get<{ suggestions: (string | number)[] }>(
        `${this.baseUrl}/suggestions?${params.toString()}`
      )

      return response.suggestions || []
    } catch (error) {
      console.error('Failed to get filter suggestions:', error)
      return []
    }
  }

  /**
   * Get recently used filter values
   */
  async getRecentFilters(): Promise<{
    hostnames: string[]
    drive_types: string[]
    block_sizes: string[]
    patterns: string[]
  }> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/recent`)
      return response
    } catch (error) {
      console.error('Failed to get recent filters:', error)
      // Return empty defaults if endpoint doesn't exist
      return {
        hostnames: [],
        drive_types: [],
        block_sizes: [],
        patterns: [],
      }
    }
  }

  /**
   * Get filter combinations that exist in the data
   */
  async getValidCombinations(): Promise<{
    hostname_drive_model: Array<{ hostname: string; drive_model: string; count: number }>
    drive_model_block_size: Array<{ drive_model: string; block_size: string; count: number }>
    hostname_protocol: Array<{ hostname: string; protocol: string; count: number }>
  }> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/combinations`)
      return response
    } catch (error) {
      console.error('Failed to get valid combinations:', error)
      // Return empty defaults if endpoint doesn't exist
      return {
        hostname_drive_model: [],
        drive_model_block_size: [],
        hostname_protocol: [],
      }
    }
  }
}

// Create and export singleton instance
export const filtersApi = new FiltersApiService()
