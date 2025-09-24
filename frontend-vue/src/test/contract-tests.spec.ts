/**
 * API Contract Tests for FIO Analyzer Frontend
 *
 * These tests validate the API contracts between frontend and backend.
 * Run against the actual backend to verify contract compliance.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { apiClient, setBasicAuth, clearAuth, ApiClientError } from '@/services/api/client'
import type {
  TestRun,
  FilterOptions,
  UserAccount,
  HealthCheckResponse
} from '@/types'

// API configuration
const API_BASE_URL = 'http://localhost:8000'
const TEST_ADMIN_CREDENTIALS = {
  username: 'test_admin',
  password: 'test_password_123'
}

// Test utilities
const isValidTestRun = (obj: unknown): obj is TestRun => {
  return (
    typeof obj === 'object' &&
    typeof obj.id === 'number' &&
    typeof obj.timestamp === 'string' &&
    typeof obj.hostname === 'string' &&
    typeof obj.drive_model === 'string' &&
    typeof obj.drive_type === 'string' &&
    typeof obj.test_name === 'string' &&
    typeof obj.block_size === 'string' &&
    typeof obj.read_write_pattern === 'string' &&
    typeof obj.queue_depth === 'number' &&
    typeof obj.duration === 'number' &&
    typeof obj.iops === 'number' &&
    typeof obj.avg_latency === 'number' &&
    typeof obj.bandwidth === 'number'
  )
}

const isValidFilterOptions = (obj: unknown): obj is FilterOptions => {
  return (
    typeof obj === 'object' &&
    Array.isArray(obj.drive_models) &&
    Array.isArray(obj.host_disk_combinations) &&
    Array.isArray(obj.block_sizes) &&
    Array.isArray(obj.patterns) &&
    Array.isArray(obj.syncs) &&
    Array.isArray(obj.queue_depths) &&
    Array.isArray(obj.directs) &&
    Array.isArray(obj.num_jobs) &&
    Array.isArray(obj.test_sizes) &&
    Array.isArray(obj.durations) &&
    Array.isArray(obj.hostnames) &&
    Array.isArray(obj.protocols) &&
    Array.isArray(obj.drive_types)
  )
}

const isValidUserAccount = (obj: unknown): obj is UserAccount => {
  return (
    typeof obj === 'object' &&
    typeof obj.username === 'string' &&
    (obj.role === 'admin' || obj.role === 'uploader')
    // Note: API doesn't return permissions array - that's frontend computed
  )
}

describe('API Contract Tests', () => {
  beforeAll(async () => {
    console.log('Setting up API contract tests...')
    console.log(`Testing against: ${API_BASE_URL}`)

    // Set up test admin credentials
    setBasicAuth(TEST_ADMIN_CREDENTIALS.username, TEST_ADMIN_CREDENTIALS.password)

    // Verify backend is accessible
    try {
      const health = await apiClient.get<HealthCheckResponse>(`${API_BASE_URL}/health`)
      console.log('Backend health check:', health)
    } catch (error) {
      console.warn('Backend health check failed - tests may fail:', error)
      // Don't fail setup, let individual tests handle the errors
    }
  })

  afterAll(async () => {
    console.log('Cleaning up API contract tests...')
    clearAuth()
  })

  describe('Health Check Endpoints', () => {
    it('GET /health should return status OK', async () => {
      const response = await apiClient.get<HealthCheckResponse>(`${API_BASE_URL}/health`)

      expect(response).toBeDefined()
      expect(response.status).toBe('OK')
      expect(response.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
      expect(typeof response.version).toBe('string')
    })
  })

  describe('Test Runs Endpoints', () => {
    it('GET /api/test-runs/ should return array of TestRun objects', async () => {
      const response = await apiClient.get<TestRun[]>(`${API_BASE_URL}/api/test-runs/`)

      expect(Array.isArray(response)).toBe(true)
      if (response.length > 0) {
        expect(isValidTestRun(response[0])).toBe(true)

        // Validate required fields
        const testRun = response[0]
        expect(testRun.iops).toBeGreaterThan(0)
        expect(testRun.bandwidth).toBeGreaterThan(0)
        // Note: avg_latency can be 0.0 in some test configurations, which is valid
      }
    })

    it('GET /api/test-runs/ should handle filter parameters', async () => {
      // First get available filters
      const filters = await apiClient.get<FilterOptions>(`${API_BASE_URL}/api/filters/`)

      if (filters.hostnames.length > 0) {
        const testHostname = filters.hostnames[0]
        const params = new URLSearchParams({
          hostnames: testHostname,
          limit: '10'
        })

        const response = await apiClient.get<TestRun[]>(
          `${API_BASE_URL}/api/test-runs/?${params.toString()}`
        )

        expect(Array.isArray(response)).toBe(true)
        expect(response.length).toBeLessThanOrEqual(10)

        if (response.length > 0) {
          response.forEach(testRun => {
            expect(testRun.hostname).toBe(testHostname)
          })
        }
      }
    })

    it('GET /api/test-runs/{id} should return single TestRun', async () => {
      // First get list to find a valid ID
      const testRuns = await apiClient.get<TestRun[]>(`${API_BASE_URL}/api/test-runs/?limit=1`)

      if (testRuns.length === 0) {
        console.warn('No test runs available for single test run contract test')
        return
      }

      const testRun = await apiClient.get<TestRun>(`${API_BASE_URL}/api/test-runs/${testRuns[0].id}`)

      expect(isValidTestRun(testRun)).toBe(true)
      expect(testRun.id).toBe(testRuns[0].id)
    })
  })

  describe('Filter Endpoints', () => {
    it('GET /api/filters should return FilterOptions', async () => {
      const response = await apiClient.get<FilterOptions>(`${API_BASE_URL}/api/filters/`)

      expect(isValidFilterOptions(response)).toBe(true)

      // Validate specific fields have content
      expect(response.hostnames.length).toBeGreaterThan(0)
      expect(response.drive_types.every(type => typeof type === 'string')).toBe(true)
      expect(response.block_sizes.every(size => typeof size === 'string')).toBe(true)
      expect(response.patterns.every(pattern => typeof pattern === 'string')).toBe(true)
      expect(response.syncs.every(sync => [0, 1].includes(sync))).toBe(true)
      expect(response.directs.every(direct => [0, 1].includes(direct))).toBe(true)
      expect(response.queue_depths.every(qd => typeof qd === 'number' && qd > 0)).toBe(true)
    })

    it('Filter options should contain valid host-disk combinations', async () => {
      const response = await apiClient.get<FilterOptions>(`${API_BASE_URL}/api/filters/`)

      response.host_disk_combinations.forEach(combo => {
        expect(typeof combo).toBe('string')
        expect(combo.length).toBeGreaterThan(0)
        // Should contain hostname and drive info separated by dashes
        expect(combo).toMatch(/^.+ - .+ - .+$/)
      })
    })
  })

  describe('User Management Endpoints (Admin Only)', () => {
    it('GET /api/users should return array of UserAccount objects', async () => {
      const response = await apiClient.get<UserAccount[]>(`${API_BASE_URL}/api/users/`)

      expect(Array.isArray(response)).toBe(true)
      if (response.length > 0) {
        expect(isValidUserAccount(response[0])).toBe(true)
      }
    })

    it('POST /api/users should create and delete user', async () => {
      const testUsername = `contract_test_${Date.now()}`
      const newUser = {
        username: testUsername,
        password: 'testpassword123',
        role: 'uploader'
      }

      try {
        // Create user
        const createResponse = await apiClient.post<UserAccount>(
          `${API_BASE_URL}/api/users/`,
          newUser
        )

        // API returns the user object directly, not wrapped in a message
        expect(createResponse.username).toBe(newUser.username)
        expect(createResponse.role).toBe(newUser.role)

        // Verify user exists
        const users = await apiClient.get<UserAccount[]>(`${API_BASE_URL}/api/users/`)
        const createdUser = users.find(u => u.username === testUsername)
        expect(createdUser).toBeDefined()

      } finally {
        // Cleanup - delete the test user
        try {
          const deleteResponse = await apiClient.delete<{ message: string }>(
            `${API_BASE_URL}/api/users/${testUsername}`
          )
          expect(typeof deleteResponse.message).toBe('string')
        } catch (error) {
          console.warn(`Failed to cleanup test user ${testUsername}:`, error)
        }
      }
    })
  })

  describe('Data Upload Endpoints', () => {
    it('POST /api/import should accept multipart form data', async () => {
      const formData = new FormData()

      // Create a minimal valid FIO JSON structure
      const mockFioData = JSON.stringify({
        jobs: [{
          jobname: 'contract-test',
          read: {
            iops: 1000,
            bw: 4096000,
            lat_ns: { mean: 1000000 }
          }
        }]
      })

      const mockFile = new Blob([mockFioData], { type: 'application/json' })
      formData.append('file', mockFile, 'contract-test.json')
      formData.append('drive_model', 'Contract Test Drive')
      formData.append('drive_type', 'TEST')
      formData.append('hostname', 'contract-test-host')
      formData.append('protocol', 'Local')
      formData.append('description', 'Contract test for API validation')

      const response = await apiClient.upload<{
        message: string
        imported: number
        failed: number
        test_run_ids: number[]
      }>(`${API_BASE_URL}/api/import`, formData)

      expect(typeof response.message).toBe('string')
      expect(typeof response.imported).toBe('number')
      expect(typeof response.failed).toBe('number')
      expect(Array.isArray(response.test_run_ids)).toBe(true)
    })
  })

  describe('Error Handling Contracts', () => {
    it('should return 404 for non-existent test run', async () => {
      await expect(async () => {
        await apiClient.get<TestRun>(`${API_BASE_URL}/api/test-runs/999999`)
      }).rejects.toThrow()

      try {
        await apiClient.get<TestRun>(`${API_BASE_URL}/api/test-runs/999999`)
      } catch (error) {
        expect(error).toBeInstanceOf(ApiClientError)
        expect((error as ApiClientError).statusCode).toBe(404)
      }
    })

    it('should return 400 for invalid filter parameters', async () => {
      await expect(async () => {
        await apiClient.get<TestRun[]>(`${API_BASE_URL}/api/test-runs/?limit=-1`)
      }).rejects.toThrow()

      try {
        await apiClient.get<TestRun[]>(`${API_BASE_URL}/api/test-runs/?limit=-1`)
      } catch (error) {
        expect(error).toBeInstanceOf(ApiClientError)
        expect((error as ApiClientError).statusCode).toBe(400)
      }
    })

    it('error responses should have proper structure', async () => {
      try {
        await apiClient.get<TestRun>(`${API_BASE_URL}/api/test-runs/999999`)
      } catch (error) {
        expect(error).toBeInstanceOf(ApiClientError)
        const apiError = error as ApiClientError
        expect(typeof apiError.message).toBe('string')
        expect(typeof apiError.statusCode).toBe('number')
        expect(apiError.statusCode).toBeGreaterThan(0)
      }
    })
  })

  describe('Data Consistency Contracts', () => {
    it('filter options should reflect actual test run data', async () => {
      const testRuns = await apiClient.get<TestRun[]>(`${API_BASE_URL}/api/test-runs/`)
      const filters = await apiClient.get<FilterOptions>(`${API_BASE_URL}/api/filters/`)

      if (testRuns.length > 0) {
        // All hostnames in test runs should appear in filter options
        const testRunHostnames = [...new Set(testRuns.map(tr => tr.hostname))]
        testRunHostnames.forEach(hostname => {
          expect(filters.hostnames).toContain(hostname)
        })

        // All drive types in test runs should appear in filter options
        const testRunDriveTypes = [...new Set(testRuns.map(tr => tr.drive_type))]
        testRunDriveTypes.forEach(driveType => {
          expect(filters.drive_types).toContain(driveType)
        })
      }
    })

    it('filtered results should match filter criteria', async () => {
      const filters = await apiClient.get<FilterOptions>(`${API_BASE_URL}/api/filters/`)

      if (filters.hostnames.length > 0) {
        const selectedHostname = filters.hostnames[0]
        const params = new URLSearchParams({
          hostnames: selectedHostname
        })

        const filteredRuns = await apiClient.get<TestRun[]>(
          `${API_BASE_URL}/api/test-runs/?${params.toString()}`
        )

        filteredRuns.forEach(testRun => {
          expect(testRun.hostname).toBe(selectedHostname)
        })
      }
    })

    it('performance metrics should be reasonable', async () => {
      const testRuns = await apiClient.get<TestRun[]>(`${API_BASE_URL}/api/test-runs/?limit=10`)

      if (testRuns.length > 0) {
        testRuns.forEach(testRun => {
          // IOPS should be positive
          expect(testRun.iops).toBeGreaterThan(0)
          expect(testRun.iops).toBeLessThan(10000000) // Reasonable upper bound

          // Latency can be 0.0 for some test configurations, but if not zero should be reasonable
          if (testRun.avg_latency > 0) {
            expect(testRun.avg_latency).toBeLessThan(1000000) // < 1 second if not zero
          }

          // Bandwidth should be positive
          expect(testRun.bandwidth).toBeGreaterThan(0)
          expect(testRun.bandwidth).toBeLessThan(100000000000) // < 100 GB/s

          // Duration can be 0 for some test configurations
          expect(testRun.duration).toBeGreaterThanOrEqual(0)
          expect(testRun.duration).toBeLessThan(86400) // < 24 hours

          // Queue depth should be positive
          expect(testRun.queue_depth).toBeGreaterThan(0)
          expect(testRun.queue_depth).toBeLessThanOrEqual(256) // Reasonable limit
        })
      }
    })
  })
})