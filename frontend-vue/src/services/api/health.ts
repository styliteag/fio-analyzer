import { apiClient } from './client'
import type { HealthCheckResponse } from '@/types'

// Extended health check response types
interface DetailedHealthResponse extends HealthCheckResponse {
  services?: {
    api: ServiceHealth
    database: ServiceHealth
    file_storage: ServiceHealth
    authentication: ServiceHealth
  }
  metrics?: {
    uptime_seconds: number
    total_requests: number
    active_connections: number
    memory_usage_mb: number
    cpu_usage_percent: number
  }
  version_info?: {
    api_version: string
    database_version?: string
    python_version: string
    fastapi_version: string
  }
  features?: string[]
  endpoints?: Record<string, {
    method: string
    description: string
    requires_auth: boolean
  }>
}

interface ServiceHealth {
  status: 'online' | 'offline' | 'degraded' | 'unknown'
  response_time_ms?: number
  message?: string
  last_check: string
  version?: string
  details?: Record<string, unknown>
}

interface SystemInfoResponse {
  name: string
  version: string
  description: string
  features: string[]
  supported_formats: string[]
  authentication: string
  documentation: string
  endpoints_count: number
  uptime_seconds: number
  environment: string
}

// Health API service
export class HealthApiService {
  private baseUrl = '/health'

  /**
   * Get basic health status
   */
  async getHealth(): Promise<HealthCheckResponse> {
    try {
      const response = await apiClient.get<HealthCheckResponse>(this.baseUrl)
      return response
    } catch (error) {
      console.error('Failed to fetch health status:', error)
      throw error
    }
  }

  /**
   * Get detailed health information including all services
   */
  async getDetailedHealth(): Promise<DetailedHealthResponse> {
    try {
      const response = await apiClient.get<DetailedHealthResponse>(`${this.baseUrl}/detailed`)
      return response
    } catch (error) {
      console.error('Failed to fetch detailed health:', error)
      // Fallback to basic health if detailed endpoint doesn't exist
      const basicHealth = await this.getHealth()
      return {
        ...basicHealth,
        services: undefined,
        metrics: undefined,
        version_info: undefined,
      }
    }
  }

  /**
   * Get system information and capabilities
   */
  async getSystemInfo(): Promise<SystemInfoResponse> {
    try {
      const response = await apiClient.get<SystemInfoResponse>('/api/info')
      return response
    } catch (error) {
      console.error('Failed to fetch system info:', error)
      throw error
    }
  }

  /**
   * Check database connectivity
   */
  async checkDatabase(): Promise<ServiceHealth> {
    try {
      const response = await apiClient.get<ServiceHealth>(`${this.baseUrl}/database`)
      return response
    } catch (error) {
      console.error('Failed to check database health:', error)
      return {
        status: 'offline',
        message: 'Database check failed',
        last_check: new Date().toISOString(),
      }
    }
  }

  /**
   * Check file storage connectivity
   */
  async checkFileStorage(): Promise<ServiceHealth> {
    try {
      const response = await apiClient.get<ServiceHealth>(`${this.baseUrl}/storage`)
      return response
    } catch (error) {
      console.error('Failed to check file storage health:', error)
      return {
        status: 'offline',
        message: 'File storage check failed',
        last_check: new Date().toISOString(),
      }
    }
  }

  /**
   * Check authentication service
   */
  async checkAuthentication(): Promise<ServiceHealth> {
    try {
      const response = await apiClient.get<ServiceHealth>(`${this.baseUrl}/auth`)
      return response
    } catch (error) {
      console.error('Failed to check authentication health:', error)
      return {
        status: 'offline',
        message: 'Authentication check failed',
        last_check: new Date().toISOString(),
      }
    }
  }

  /**
   * Run comprehensive health check on all services
   */
  async runFullHealthCheck(): Promise<{
    overall_status: 'healthy' | 'degraded' | 'unhealthy'
    timestamp: string
    services: {
      api: ServiceHealth
      database: ServiceHealth
      file_storage: ServiceHealth
      authentication: ServiceHealth
    }
    issues: string[]
    recommendations: string[]
  }> {
    try {
      const [
        apiHealth,
        databaseHealth,
        fileStorageHealth,
        authHealth,
      ] = await Promise.allSettled([
        this.getHealth(),
        this.checkDatabase(),
        this.checkFileStorage(),
        this.checkAuthentication(),
      ])

      const services = {
        api: apiHealth.status === 'fulfilled'
          ? { status: 'online' as const, last_check: new Date().toISOString() }
          : { status: 'offline' as const, message: 'API unreachable', last_check: new Date().toISOString() },
        database: databaseHealth.status === 'fulfilled' ? databaseHealth.value : databaseHealth.reason,
        file_storage: fileStorageHealth.status === 'fulfilled' ? fileStorageHealth.value : fileStorageHealth.reason,
        authentication: authHealth.status === 'fulfilled' ? authHealth.value : authHealth.reason,
      }

      const issues: string[] = []
      const recommendations: string[] = []

      // Analyze service statuses
      Object.entries(services).forEach(([service, health]) => {
        if (health.status !== 'online') {
          issues.push(`${service} service is ${health.status}`)
          recommendations.push(`Check ${service} service configuration and connectivity`)
        }
      })

      // Determine overall status
      const hasOffline = Object.values(services).some(s => s.status === 'offline')
      const hasDegraded = Object.values(services).some(s => s.status === 'degraded')

      let overall_status: 'healthy' | 'degraded' | 'unhealthy'
      if (hasOffline) {
        overall_status = 'unhealthy'
      } else if (hasDegraded) {
        overall_status = 'degraded'
      } else {
        overall_status = 'healthy'
      }

      return {
        overall_status,
        timestamp: new Date().toISOString(),
        services,
        issues,
        recommendations,
      }
    } catch (error) {
      console.error('Failed to run full health check:', error)
      throw error
    }
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(): Promise<{
    uptime_seconds: number
    total_requests: number
    active_connections: number
    memory_usage_mb: number
    cpu_usage_percent: number
    average_response_time_ms: number
    requests_per_second: number
  }> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/metrics`)
      return response
    } catch (error) {
      console.error('Failed to fetch performance metrics:', error)
      throw error
    }
  }

  /**
   * Get API endpoint documentation
   */
  async getApiDocumentation(): Promise<{
    endpoints: Record<string, {
      method: string
      description: string
      parameters?: Array<{
        name: string
        type: string
        required: boolean
        description: string
      }>
      responses: Record<string, {
        description: string
        schema?: unknown
      }>
    }>
    schemas: Record<string, unknown>
  }> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/docs`)
      return response
    } catch (error) {
      console.error('Failed to fetch API documentation:', error)
      throw error
    }
  }

  /**
   * Ping the service for basic connectivity
   */
  async ping(): Promise<{ pong: boolean; timestamp: string }> {
    try {
      const startTime = Date.now()
      const response = await apiClient.get<{ pong: boolean; timestamp: string }>(`${this.baseUrl}/ping`)
      const endTime = Date.now()

      return {
        ...response,
        response_time_ms: endTime - startTime,
      }
    } catch (error) {
      console.error('Failed to ping service:', error)
      return {
        pong: false,
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Get service logs (admin only)
   */
  async getServiceLogs(lines = 100): Promise<{
    logs: Array<{
      timestamp: string
      level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL'
      message: string
      module?: string
    }>
    total_lines: number
  }> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/logs?lines=${lines}`)
      return response
    } catch (error) {
      console.error('Failed to fetch service logs:', error)
      throw error
    }
  }

  /**
   * Test external service connectivity
   */
  async testExternalConnectivity(): Promise<{
    internet_access: boolean
    dns_resolution: boolean
    external_services: Record<string, boolean>
  }> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/connectivity`)
      return response
    } catch (error) {
      console.error('Failed to test external connectivity:', error)
      throw error
    }
  }

  /**
   * Get configuration status
   */
  async getConfigurationStatus(): Promise<{
    environment: string
    debug_mode: boolean
    database_configured: boolean
    storage_configured: boolean
    authentication_configured: boolean
    features_enabled: string[]
    warnings: string[]
  }> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/config`)
      return response
    } catch (error) {
      console.error('Failed to fetch configuration status:', error)
      throw error
    }
  }

  /**
   * Get dependency versions
   */
  async getDependencyVersions(): Promise<{
    python: string
    fastapi: string
    uvicorn: string
    sqlalchemy?: string
    databases?: string[]
    external_services?: Record<string, string>
  }> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/versions`)
      return response
    } catch (error) {
      console.error('Failed to fetch dependency versions:', error)
      throw error
    }
  }

  /**
   * Trigger garbage collection (development only)
   */
  async triggerGarbageCollection(): Promise<{ message: string; collected: number }> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/gc`, {})
      return response
    } catch (error) {
      console.error('Failed to trigger garbage collection:', error)
      throw error
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStatistics(): Promise<{
    enabled: boolean
    total_entries: number
    total_size_bytes: number
    hit_rate_percent: number
    miss_rate_percent: number
    eviction_count: number
  }> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/cache`)
      return response
    } catch (error) {
      console.error('Failed to fetch cache statistics:', error)
      // Return default values if cache stats not available
      return {
        enabled: false,
        total_entries: 0,
        total_size_bytes: 0,
        hit_rate_percent: 0,
        miss_rate_percent: 0,
        eviction_count: 0,
      }
    }
  }
}

// Create and export singleton instance
export const healthApi = new HealthApiService()
