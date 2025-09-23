/**
 * Test Runs API Service
 * Provides high-level functions for fetching test run data for visualizations
 */

import { apiClient, TestRun, TestRunFilters } from '../apiClient'

export interface TestRunsResponse {
  data: TestRun[]
  total: number
  limit: number
  offset: number
}

/**
 * Fetch test runs with optional filtering
 * This is the main API function used by visualization components
 */
export const fetchTestRuns = async (filters?: TestRunFilters): Promise<TestRunsResponse> => {
  try {
    return await apiClient.getTestRuns(filters)
  } catch (error) {
    console.error('Failed to fetch test runs:', error)
    throw new Error(`Failed to fetch test runs: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Fetch test runs for specific hostnames
 * Used by host analysis components
 */
export const fetchTestRunsByHostnames = async (hostnames: string[]): Promise<TestRunsResponse> => {
  return fetchTestRuns({ hostnames })
}

/**
 * Fetch test runs with block size filtering
 * Used by performance visualization components
 */
export const fetchTestRunsByBlockSizes = async (blockSizes: (string | number)[]): Promise<TestRunsResponse> => {
  return fetchTestRuns({ block_sizes: blockSizes })
}

/**
 * Fetch test runs with pattern filtering
 * Used by performance comparison components
 */
export const fetchTestRunsByPatterns = async (patterns: string[]): Promise<TestRunsResponse> => {
  return fetchTestRuns({ patterns })
}

/**
 * Validate TestRun data structure
 * Ensures the API response contains expected fields
 */
export const validateTestRun = (testRun: TestRun): boolean => {
  // Required fields
  if (typeof testRun.id !== 'number') return false
  if (typeof testRun.timestamp !== 'string') return false
  if (typeof testRun.block_size !== 'string' && typeof testRun.block_size !== 'number') return false
  if (typeof testRun.read_write_pattern !== 'string') return false
  if (typeof testRun.queue_depth !== 'number') return false

  // Optional performance fields (can be null)
  if (testRun.iops !== null && testRun.iops !== undefined && typeof testRun.iops !== 'number') return false
  if (testRun.avg_latency !== null && testRun.avg_latency !== undefined && typeof testRun.avg_latency !== 'number') return false
  if (testRun.bandwidth !== null && testRun.bandwidth !== undefined && typeof testRun.bandwidth !== 'number') return false

  return true
}

/**
 * Filter valid test runs from API response
 * Removes entries with invalid or missing required data
 */
export const filterValidTestRuns = (testRuns: TestRun[]): TestRun[] => {
  return testRuns.filter(testRun => validateTestRun(testRun))
}

/**
 * Get unique values for filter options from test runs
 */
export const extractFilterOptions = (testRuns: TestRun[]) => {
  const hostnames = [...new Set(testRuns.map(tr => tr.hostname).filter(Boolean))] as string[]
  const driveModels = [...new Set(testRuns.map(tr => tr.drive_model).filter(Boolean))] as string[]
  const driveTypes = [...new Set(testRuns.map(tr => tr.drive_type).filter(Boolean))] as string[]
  const protocols = [...new Set(testRuns.map(tr => tr.protocol).filter(Boolean))] as string[]
  const patterns = [...new Set(testRuns.map(tr => tr.read_write_pattern).filter(Boolean))] as string[]
  const blockSizes = [...new Set(testRuns.map(tr => tr.block_size).filter(Boolean))] as (string | number)[]
  const queueDepths = [...new Set(testRuns.map(tr => tr.queue_depth).filter(Boolean))] as number[]
  const numJobs = [...new Set(testRuns.map(tr => tr.num_jobs).filter(Boolean))] as number[]

  return {
    hostnames: hostnames.sort(),
    driveModels: driveModels.sort(),
    driveTypes: driveTypes.sort(),
    protocols: protocols.sort(),
    patterns: patterns.sort(),
    blockSizes: blockSizes.sort(),
    queueDepths: queueDepths.sort((a, b) => a - b),
    numJobs: numJobs.sort((a, b) => a - b)
  }
}
