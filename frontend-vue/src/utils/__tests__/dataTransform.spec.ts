/**
 * Unit tests for data transformation utilities
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  applyFiltersToPerformanceData,
  transformToChartSeries,
  transformForIOPSComparison,
  transformForLatencyAnalysis,
  transformForBandwidthTrends,
  transformForResponsiveness,
  transformForHeatmap,
  normalizeValues,
  sortBlockSizes
} from '../dataTransform'
import type { PerformanceData, FilterState } from '@/types'

describe('applyFiltersToPerformanceData', () => {
  let mockData: PerformanceData[]
  let mockFilters: FilterState

  beforeEach(() => {
    mockData = [
      {
        id: 1,
        drive_model: 'Drive1',
        drive_type: 'SSD',
        test_name: 'Test1',
        description: 'Test description',
        block_size: '4k',
        read_write_pattern: 'read',
        timestamp: '2023-01-01T00:00:00Z',
        queue_depth: 1,
        hostname: 'host1',
        protocol: 'tcp',
        metrics: {},
        iops: 1000,
        avg_latency: 1.5,
        bandwidth: 4000,
        responsiveness: 666.67
      },
      {
        id: 2,
        drive_model: 'Drive2',
        drive_type: 'HDD',
        test_name: 'Test2',
        description: 'Test description 2',
        block_size: '8k',
        read_write_pattern: 'write',
        timestamp: '2023-01-02T00:00:00Z',
        queue_depth: 2,
        hostname: 'host1',
        protocol: 'rdma',
        metrics: {},
        iops: 500,
        avg_latency: 3.0,
        bandwidth: 2000,
        responsiveness: 333.33
      }
    ]

    mockFilters = {
      selectedHostnames: [],
      selectedDriveTypes: [],
      selectedDriveModels: [],
      selectedPatterns: [],
      selectedBlockSizes: [],
      selectedProtocols: [],
      selectedQueueDepths: [],
      selectedNumJobs: [],
      selectedDirects: [],
      selectedSyncs: [],
      selectedTestSizes: [],
      selectedDurations: [],
      selectedHostDiskCombinations: [],
      dateRange: null,
      activeFilters: {}
    }
  })

  it('should return all data when no filters are applied', () => {
    const result = applyFiltersToPerformanceData(mockData, mockFilters)
    expect(result).toEqual(mockData)
  })

  it('should filter by block size', () => {
    mockFilters.selectedBlockSizes = ['4k']
    const result = applyFiltersToPerformanceData(mockData, mockFilters)
    expect(result).toHaveLength(1)
    expect(result[0].block_size).toBe('4k')
  })

  it('should filter by read/write pattern', () => {
    mockFilters.selectedPatterns = ['write']
    const result = applyFiltersToPerformanceData(mockData, mockFilters)
    expect(result).toHaveLength(1)
    expect(result[0].read_write_pattern).toBe('write')
  })

  it('should filter by queue depth', () => {
    mockFilters.selectedQueueDepths = [2]
    const result = applyFiltersToPerformanceData(mockData, mockFilters)
    expect(result).toHaveLength(1)
    expect(result[0].queue_depth).toBe(2)
  })

  it('should filter by protocol', () => {
    mockFilters.selectedProtocols = ['tcp']
    const result = applyFiltersToPerformanceData(mockData, mockFilters)
    expect(result).toHaveLength(1)
    expect(result[0].protocol).toBe('tcp')
  })

  it('should handle null protocol values', () => {
    const dataWithNullProtocol = [
      { ...mockData[0], protocol: null }
    ]
    mockFilters.selectedProtocols = ['tcp']
    const result = applyFiltersToPerformanceData(dataWithNullProtocol, mockFilters)
    expect(result).toHaveLength(0)
  })
})

describe('transformToChartSeries', () => {
  let mockData: PerformanceData[]

  beforeEach(() => {
    mockData = [
      {
        id: 1,
        drive_model: 'Drive1',
        drive_type: 'SSD',
        test_name: 'Test1',
        description: '',
        block_size: '4k',
        read_write_pattern: 'read',
        timestamp: '2023-01-01T00:00:00Z',
        queue_depth: 1,
        hostname: 'host1',
        protocol: 'tcp',
        metrics: {},
        iops: 1000,
        avg_latency: 1.5,
        bandwidth: 4000,
        responsiveness: 666.67
      },
      {
        id: 2,
        drive_model: 'Drive2',
        drive_type: 'SSD',
        test_name: 'Test2',
        description: '',
        block_size: '8k',
        read_write_pattern: 'write',
        timestamp: '2023-01-02T00:00:00Z',
        queue_depth: 1,
        hostname: 'host1',
        protocol: 'tcp',
        metrics: {},
        iops: 500,
        avg_latency: 3.0,
        bandwidth: 2000,
        responsiveness: 333.33
      }
    ]
  })

  it('should create single series when no groupBy is specified', () => {
    const result = transformToChartSeries(mockData, 'block_size', 'iops')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Performance Data')
    expect(result[0].data).toHaveLength(2)
  })

  it('should group data by specified field', () => {
    const result = transformToChartSeries(mockData, 'queue_depth', 'iops', 'drive_type')
    expect(result).toHaveLength(1) // Both have same drive_type
    expect(result[0].name).toBe('SSD')
  })

  it('should handle null values correctly', () => {
    const dataWithNulls = [
      { ...mockData[0], iops: null }
    ]
    const result = transformToChartSeries(dataWithNulls, 'block_size', 'iops')
    expect(result[0].data[0].y).toBeNull()
  })
})

describe('transformForIOPSComparison', () => {
  let mockData: PerformanceData[]
  let mockFilters: FilterState

  beforeEach(() => {
    mockData = [
      {
        id: 1,
        drive_model: 'Drive1',
        drive_type: 'SSD',
        test_name: 'Test1',
        description: '',
        block_size: '4k',
        read_write_pattern: 'read',
        timestamp: '2023-01-01T00:00:00Z',
        queue_depth: 1,
        hostname: 'host1',
        protocol: 'tcp',
        metrics: {},
        iops: 1000,
        avg_latency: 1.5,
        bandwidth: 4000,
        responsiveness: 666.67
      },
      {
        id: 2,
        drive_model: 'Drive1',
        drive_type: 'SSD',
        test_name: 'Test2',
        description: '',
        block_size: '4k',
        read_write_pattern: 'write',
        timestamp: '2023-01-02T00:00:00Z',
        queue_depth: 1,
        hostname: 'host1',
        protocol: 'tcp',
        metrics: {},
        iops: 800,
        avg_latency: 2.0,
        bandwidth: 3200,
        responsiveness: 500
      }
    ]

    mockFilters = {
      selectedHostnames: [],
      selectedDriveTypes: [],
      selectedDriveModels: [],
      selectedPatterns: [],
      selectedBlockSizes: [],
      selectedProtocols: [],
      selectedQueueDepths: [],
      selectedNumJobs: [],
      selectedDirects: [],
      selectedSyncs: [],
      selectedTestSizes: [],
      selectedDurations: [],
      selectedHostDiskCombinations: [],
      dateRange: null,
      activeFilters: {}
    }
  })

  it('should group data by block size and pattern', () => {
    const result = transformForIOPSComparison(mockData, mockFilters)
    expect(result).toHaveLength(1) // One block size
    expect(result[0].blockSize).toBe('4k')
    expect(result[0].patterns).toHaveLength(2) // Two patterns
  })

  it('should handle filters correctly', () => {
    mockFilters.selectedPatterns = ['read']
    const result = transformForIOPSComparison(mockData, mockFilters)
    expect(result[0].patterns).toHaveLength(1)
    expect(result[0].patterns[0].pattern).toBe('read')
  })
})

describe('transformForLatencyAnalysis', () => {
  let mockData: PerformanceData[]
  let mockFilters: FilterState

  beforeEach(() => {
    mockData = [
      {
        id: 1,
        drive_model: 'Drive1',
        drive_type: 'SSD',
        test_name: 'Test1',
        description: '',
        block_size: '4k',
        read_write_pattern: 'read',
        timestamp: '2023-01-01T00:00:00Z',
        queue_depth: 1,
        hostname: 'host1',
        protocol: 'tcp',
        metrics: {},
        iops: 1000,
        avg_latency: 1.5,
        bandwidth: 4000,
        responsiveness: 666.67,
        p95_latency: 2.0,
        p99_latency: 3.0
      }
    ]

    mockFilters = {
      selectedHostnames: [],
      selectedDriveTypes: [],
      selectedDriveModels: [],
      selectedPatterns: [],
      selectedBlockSizes: [],
      selectedProtocols: [],
      selectedQueueDepths: [],
      selectedNumJobs: [],
      selectedDirects: [],
      selectedSyncs: [],
      selectedTestSizes: [],
      selectedDurations: [],
      selectedHostDiskCombinations: [],
      dateRange: null,
      activeFilters: {}
    }
  })

  it('should aggregate latency metrics by block size', () => {
    const result = transformForLatencyAnalysis(mockData, mockFilters)
    expect(result).toHaveLength(1)
    expect(result[0].blockSize).toBe('4k')
    expect(result[0].latency).toBe(1.5)
    expect(result[0].p95Latency).toBe(2.0)
    expect(result[0].p99Latency).toBe(3.0)
  })

  it('should handle null latency values', () => {
    const dataWithNulls = [
      { ...mockData[0], avg_latency: null, p95_latency: null, p99_latency: null }
    ]
    const result = transformForLatencyAnalysis(dataWithNulls, mockFilters)
    expect(result[0].latency).toBeNull()
    expect(result[0].p95Latency).toBeNull()
    expect(result[0].p99Latency).toBeNull()
  })
})

describe('transformForBandwidthTrends', () => {
  let mockData: PerformanceData[]
  let mockFilters: FilterState

  beforeEach(() => {
    mockData = [
      {
        id: 1,
        drive_model: 'Drive1',
        drive_type: 'SSD',
        test_name: 'Test1',
        description: '',
        block_size: '4k',
        read_write_pattern: 'read',
        timestamp: '2023-01-01T00:00:00Z',
        queue_depth: 1,
        hostname: 'host1',
        protocol: 'tcp',
        metrics: {},
        iops: 1000,
        avg_latency: 1.5,
        bandwidth: 4000,
        responsiveness: 666.67
      }
    ]

    mockFilters = {
      selectedHostnames: [],
      selectedDriveTypes: [],
      selectedDriveModels: [],
      selectedPatterns: [],
      selectedBlockSizes: [],
      selectedProtocols: [],
      selectedQueueDepths: [],
      selectedNumJobs: [],
      selectedDirects: [],
      selectedSyncs: [],
      selectedTestSizes: [],
      selectedDurations: [],
      selectedHostDiskCombinations: [],
      dateRange: null,
      activeFilters: {}
    }
  })

  it('should aggregate bandwidth by block size', () => {
    const result = transformForBandwidthTrends(mockData, mockFilters)
    expect(result).toHaveLength(1)
    expect(result[0].blockSize).toBe('4k')
    expect(result[0].bandwidth).toBe(4000)
  })

  it('should handle null bandwidth values', () => {
    const dataWithNulls = [
      { ...mockData[0], bandwidth: null }
    ]
    const result = transformForBandwidthTrends(dataWithNulls, mockFilters)
    expect(result[0].bandwidth).toBeNull()
  })
})

describe('normalizeValues', () => {
  it('should normalize using min-max scaling', () => {
    const values = [10, 20, 30, null]
    const result = normalizeValues(values, 'min-max')
    expect(result[0]).toBe(0) // 10 -> 0
    expect(result[1]).toBe(50) // 20 -> 50
    expect(result[2]).toBe(100) // 30 -> 100
    expect(result[3]).toBeNull() // null stays null
  })

  it('should handle all same values', () => {
    const values = [5, 5, 5]
    const result = normalizeValues(values, 'min-max')
    expect(result).toEqual([50, 50, 50]) // All map to 50
  })

  it('should handle empty array', () => {
    const values: (number | null)[] = []
    const result = normalizeValues(values)
    expect(result).toEqual([])
  })

  it('should normalize using z-score', () => {
    const values = [10, 20, 30]
    const result = normalizeValues(values, 'z-score')
    // Check that we get valid numbers (exact values depend on calculation)
    expect(typeof result[0]).toBe('number')
    expect(typeof result[1]).toBe('number')
    expect(typeof result[2]).toBe('number')
  })
})

describe('sortBlockSizes', () => {
  it('should sort block sizes numerically', () => {
    const blockSizes = ['16k', '4k', '8k', '2k']
    const result = sortBlockSizes(blockSizes)
    expect(result).toEqual(['2k', '4k', '8k', '16k'])
  })

  it('should handle mixed formats', () => {
    const blockSizes = ['8k', '4M', '1k', '512']
    const result = sortBlockSizes(blockSizes)
    expect(result).toEqual(['512', '1k', '8k', '4M'])
  })

  it('should handle empty array', () => {
    const result = sortBlockSizes([])
    expect(result).toEqual([])
  })
})

describe('transformForResponsiveness', () => {
  let mockData: PerformanceData[]
  let mockFilters: FilterState

  beforeEach(() => {
    mockData = [
      {
        id: 1,
        drive_model: 'Drive1',
        drive_type: 'SSD',
        test_name: 'Test1',
        description: '',
        block_size: '4k',
        read_write_pattern: 'read',
        timestamp: '2023-01-01T00:00:00Z',
        queue_depth: 1,
        hostname: 'host1',
        protocol: 'tcp',
        metrics: {},
        iops: 1000,
        avg_latency: 1.5,
        bandwidth: 4000,
        responsiveness: 666.67
      }
    ]

    mockFilters = {
      selectedHostnames: [],
      selectedDriveTypes: [],
      selectedDriveModels: [],
      selectedPatterns: [],
      selectedBlockSizes: [],
      selectedProtocols: [],
      selectedQueueDepths: [],
      selectedNumJobs: [],
      selectedDirects: [],
      selectedSyncs: [],
      selectedTestSizes: [],
      selectedDurations: [],
      selectedHostDiskCombinations: [],
      dateRange: null,
      activeFilters: {}
    }
  })

  it('should calculate responsiveness as 1000/latency', () => {
    const result = transformForResponsiveness(mockData, mockFilters)
    expect(result).toHaveLength(1)
    expect(result[0].blockSize).toBe('4k')
    expect(result[0].responsiveness).toBeCloseTo(666.67, 2) // 1000/1.5
  })

  it('should handle zero or null latency', () => {
    const dataWithBadLatency = [
      { ...mockData[0], avg_latency: 0 },
      { ...mockData[0], avg_latency: null }
    ]
    const result = transformForResponsiveness(dataWithBadLatency, mockFilters)
    expect(result[0].responsiveness).toBeNull()
  })
})

describe('transformForHeatmap', () => {
  let mockData: PerformanceData[]
  let mockFilters: FilterState

  beforeEach(() => {
    mockData = [
      {
        id: 1,
        drive_model: 'Drive1',
        drive_type: 'SSD',
        test_name: 'Test1',
        description: '',
        block_size: '4k',
        read_write_pattern: 'read',
        timestamp: '2023-01-01T00:00:00Z',
        queue_depth: 1,
        hostname: 'host1',
        protocol: 'tcp',
        metrics: {},
        iops: 1000,
        avg_latency: 1.5,
        bandwidth: 4000,
        responsiveness: 666.67
      }
    ]

    mockFilters = {
      selectedHostnames: [],
      selectedDriveTypes: [],
      selectedDriveModels: [],
      selectedPatterns: [],
      selectedBlockSizes: [],
      selectedProtocols: [],
      selectedQueueDepths: [],
      selectedNumJobs: [],
      selectedDirects: [],
      selectedSyncs: [],
      selectedTestSizes: [],
      selectedDurations: [],
      selectedHostDiskCombinations: [],
      dateRange: null,
      activeFilters: {}
    }
  })

  it('should transform data for heatmap visualization', () => {
    const result = transformForHeatmap(mockData, mockFilters)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      blockSize: '4k',
      hostname: 'host1',
      pattern: 'read',
      iops: 1000,
      bandwidth: 4000,
      responsiveness: 666.6666666666666 // 1000/1.5
    })
  })

  it('should handle null hostname', () => {
    const dataWithNullHostname = [
      { ...mockData[0], hostname: null }
    ]
    const result = transformForHeatmap(dataWithNullHostname, mockFilters)
    expect(result[0].hostname).toBe('Unknown')
  })
})
