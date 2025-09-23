/**
 * Host Analysis API Service
 * Provides API methods for host-specific performance analysis
 */

import { apiClient } from '../apiClient'
import type { TestRun, HostAnalysisData } from '@/types'

export interface HostAnalysisFilters {
  hostname?: string
  drive_types?: string[]
  drive_models?: string[]
  patterns?: string[]
  block_sizes?: (string | number)[]
  queue_depths?: number[]
  protocols?: string[]
  date_range?: {
    start: string
    end: string
  }
}

export interface HostAnalysisResponse {
  hostname: string
  test_runs: TestRun[]
  summary: {
    total_tests: number
    avg_iops: number
    avg_latency: number
    avg_bandwidth: number
    drive_types: string[]
    test_patterns: string[]
    block_sizes: (string | number)[]
    queue_depths: number[]
    date_range: {
      earliest: string
      latest: string
    }
  }
}

/**
 * Fetch performance data for a specific host with optional filters
 */
export const fetchHostAnalysis = async (
  hostname: string,
  filters?: HostAnalysisFilters
): Promise<HostAnalysisResponse> => {
  try {
    // Build query parameters
    const params = new URLSearchParams()

    if (filters?.drive_types?.length) {
      filters.drive_types.forEach(type => params.append('drive_type', type))
    }

    if (filters?.drive_models?.length) {
      filters.drive_models.forEach(model => params.append('drive_model', model))
    }

    if (filters?.patterns?.length) {
      filters.patterns.forEach(pattern => params.append('read_write_pattern', pattern))
    }

    if (filters?.block_sizes?.length) {
      filters.block_sizes.forEach(size => params.append('block_size', size.toString()))
    }

    if (filters?.queue_depths?.length) {
      filters.queue_depths.forEach(depth => params.append('queue_depth', depth.toString()))
    }

    if (filters?.protocols?.length) {
      filters.protocols.forEach(protocol => params.append('protocol', protocol))
    }

    if (filters?.date_range) {
      params.append('start_date', filters.date_range.start)
      params.append('end_date', filters.date_range.end)
    }

    const queryString = params.toString()
    const url = queryString ? `/api/test-runs?hostname=${hostname}&${queryString}` : `/api/test-runs?hostname=${hostname}`

    const response = await apiClient.get(url)

    // Transform the response to match our expected format
    const testRuns: TestRun[] = response.data || []

    // Calculate summary statistics
    const summary = calculateHostSummary(testRuns)

    return {
      hostname,
      test_runs: testRuns,
      summary
    }
  } catch (error) {
    console.error('Error fetching host analysis:', error)
    throw new Error(`Failed to fetch host analysis for ${hostname}: ${(error as Error).message}`)
  }
}

/**
 * Fetch available filter options for a specific host
 */
export const fetchHostFilterOptions = async (hostname: string): Promise<{
  drive_types: string[]
  drive_models: string[]
  patterns: string[]
  block_sizes: (string | number)[]
  queue_depths: number[]
  protocols: string[]
  date_range: {
    earliest: string
    latest: string
  }
}> => {
  try {
    const response = await apiClient.get(`/api/test-runs?hostname=${hostname}`)

    const testRuns: TestRun[] = response.data || []

    // Extract unique values for each filter category
    const drive_types = [...new Set(testRuns.map(run => run.drive_type).filter(Boolean))]
    const drive_models = [...new Set(testRuns.map(run => run.drive_model).filter(Boolean))]
    const patterns = [...new Set(testRuns.map(run => run.read_write_pattern).filter(Boolean))]
    const block_sizes = [...new Set(testRuns.map(run => run.block_size).filter(Boolean))]
    const queue_depths = [...new Set(testRuns.map(run => run.queue_depth).filter(Boolean))]
    const protocols = [...new Set(testRuns.map(run => run.protocol).filter(Boolean))]

    // Calculate date range
    const timestamps = testRuns.map(run => new Date(run.timestamp).getTime()).filter(t => !isNaN(t))
    const earliest = timestamps.length > 0 ? new Date(Math.min(...timestamps)).toISOString() : ''
    const latest = timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : ''

    return {
      drive_types,
      drive_models,
      patterns,
      block_sizes,
      queue_depths,
      protocols,
      date_range: {
        earliest,
        latest
      }
    }
  } catch (error) {
    console.error('Error fetching host filter options:', error)
    throw new Error(`Failed to fetch filter options for ${hostname}: ${(error as Error).message}`)
  }
}

/**
 * Fetch performance comparison between multiple hosts
 */
export const fetchHostsComparison = async (
  hostnames: string[],
  filters?: Omit<HostAnalysisFilters, 'hostname'>
): Promise<HostAnalysisData[]> => {
  try {
    const results = await Promise.all(
      hostnames.map(hostname => fetchHostAnalysis(hostname, filters))
    )

    return results.map(result => ({
      hostname: result.hostname,
      drives: groupTestsByDrive(result.test_runs)
    }))
  } catch (error) {
    console.error('Error fetching hosts comparison:', error)
    throw new Error(`Failed to fetch hosts comparison: ${(error as Error).message}`)
  }
}

/**
 * Fetch time series data for trend analysis
 */
export const fetchHostTimeSeries = async (
  hostname: string,
  metric: 'iops' | 'latency' | 'bandwidth',
  filters?: HostAnalysisFilters
): Promise<Array<{
  timestamp: string
  value: number
  drive_model: string
  test_name: string
}>> => {
  try {
    const response = await fetchHostAnalysis(hostname, filters)

    return response.test_runs
      .filter(run => {
        switch (metric) {
          case 'iops':
            return run.iops !== null && run.iops !== undefined
          case 'latency':
            return run.avg_latency !== null && run.avg_latency !== undefined
          case 'bandwidth':
            return run.bandwidth !== null && run.bandwidth !== undefined
          default:
            return false
        }
      })
      .map(run => ({
        timestamp: run.timestamp,
        value: metric === 'iops' ? (run.iops || 0) :
               metric === 'latency' ? (run.avg_latency || 0) :
               (run.bandwidth || 0),
        drive_model: run.drive_model || 'Unknown',
        test_name: run.test_name || 'Unknown'
      }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  } catch (error) {
    console.error('Error fetching host time series:', error)
    throw new Error(`Failed to fetch time series for ${hostname}: ${(error as Error).message}`)
  }
}

// Helper functions

/**
 * Calculate summary statistics for a host's test runs
 */
function calculateHostSummary(testRuns: TestRun[]) {
  const validTests = testRuns.filter(run => run.iops !== null && run.iops !== undefined)

  const total_tests = testRuns.length
  const avg_iops = validTests.length > 0
    ? validTests.reduce((sum, run) => sum + (run.iops || 0), 0) / validTests.length
    : 0

  const avg_latency = validTests.length > 0
    ? validTests.reduce((sum, run) => sum + (run.avg_latency || 0), 0) / validTests.length
    : 0

  const avg_bandwidth = validTests.length > 0
    ? validTests.reduce((sum, run) => sum + (run.bandwidth || 0), 0) / validTests.length
    : 0

  const drive_types = [...new Set(testRuns.map(run => run.drive_type).filter(Boolean))]
  const test_patterns = [...new Set(testRuns.map(run => run.read_write_pattern).filter(Boolean))]
  const block_sizes = [...new Set(testRuns.map(run => run.block_size).filter(Boolean))]
  const queue_depths = [...new Set(testRuns.map(run => run.queue_depth).filter(Boolean))]

  const timestamps = testRuns.map(run => new Date(run.timestamp).getTime()).filter(t => !isNaN(t))
  const earliest = timestamps.length > 0 ? new Date(Math.min(...timestamps)).toISOString() : ''
  const latest = timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : ''

  return {
    total_tests,
    avg_iops,
    avg_latency,
    avg_bandwidth,
    drive_types,
    test_patterns,
    block_sizes,
    queue_depths,
    date_range: {
      earliest,
      latest
    }
  }
}

/**
 * Group test runs by drive for HostAnalysisData format
 */
function groupTestsByDrive(testRuns: TestRun[]): Array<{
  drive_model: string
  drive_type: string
  configurations: Array<{
    id: number
    drive_model: string
    drive_type: string
    test_name: string
    description: string
    block_size: string | number
    read_write_pattern: string
    timestamp: string
    queue_depth: number
    hostname: string
    protocol: string
    metrics: Record<string, { value: number; unit: string }>
    iops: number | null
    avg_latency: number | null
    bandwidth: number | null
  }>
}> {
  const driveGroups = new Map<string, typeof testRuns>()

  testRuns.forEach(run => {
    const key = `${run.drive_model || 'Unknown'}-${run.drive_type || 'Unknown'}`
    if (!driveGroups.has(key)) {
      driveGroups.set(key, [])
    }
    driveGroups.get(key)!.push(run)
  })

  return Array.from(driveGroups.entries()).map(([key, runs]) => {
    const [drive_model, drive_type] = key.split('-')
    return {
      drive_model,
      drive_type,
      configurations: runs.map(run => ({
        id: run.id,
        drive_model: run.drive_model || 'Unknown',
        drive_type: run.drive_type || 'Unknown',
        test_name: run.test_name || 'Unknown',
        description: run.description || '',
        block_size: run.block_size,
        read_write_pattern: run.read_write_pattern,
        timestamp: run.timestamp,
        queue_depth: run.queue_depth,
        hostname: run.hostname || '',
        protocol: run.protocol || '',
        metrics: {
          iops: { value: run.iops || 0, unit: 'IOPS' },
          avg_latency: { value: run.avg_latency || 0, unit: 'ms' },
          bandwidth: { value: run.bandwidth || 0, unit: 'MB/s' },
          p95_latency: { value: run.p95_latency || 0, unit: 'ms' },
          p99_latency: { value: run.p99_latency || 0, unit: 'ms' }
        },
        iops: run.iops,
        avg_latency: run.avg_latency,
        bandwidth: run.bandwidth
      }))
    }
  })
}
