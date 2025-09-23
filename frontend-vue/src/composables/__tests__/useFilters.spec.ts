/**
 * Unit tests for filter composables
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useFilters, quickFilters, applyQuickFilter } from '../useFilters'
import type { PerformanceData } from '@/types'

describe('useFilters', () => {
  let filtersComposable: ReturnType<typeof useFilters>
  let mockData: PerformanceData[]

  beforeEach(() => {
    filtersComposable = useFilters()
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
        num_jobs: 1
      },
      {
        id: 2,
        drive_model: 'Drive2',
        drive_type: 'HDD',
        test_name: 'Test2',
        description: '',
        block_size: '8k',
        read_write_pattern: 'write',
        timestamp: '2023-01-02T00:00:00Z',
        queue_depth: 2,
        hostname: 'host2',
        protocol: 'rdma',
        metrics: {},
        iops: 500,
        avg_latency: 3.0,
        bandwidth: 2000,
        responsiveness: 333.33,
        num_jobs: 2
      },
      {
        id: 3,
        drive_model: 'Drive1',
        drive_type: 'SSD',
        test_name: 'Test3',
        description: '',
        block_size: '4k',
        read_write_pattern: 'random_read',
        timestamp: '2023-01-03T00:00:00Z',
        queue_depth: 1,
        hostname: 'host1',
        protocol: 'tcp',
        metrics: {},
        iops: 800,
        avg_latency: 2.0,
        bandwidth: 3200,
        responsiveness: 500,
        num_jobs: 4
      }
    ]
  })

  describe('initial state', () => {
    it('should start with no active filters', () => {
      expect(filtersComposable.isFilterActive).toBe(false)
      expect(filtersComposable.getActiveFilterCount).toBe(0)
    })

    it('should have empty filter arrays initially', () => {
      expect(filtersComposable.filters.selectedBlockSizes).toEqual([])
      expect(filtersComposable.filters.selectedPatterns).toEqual([])
      expect(filtersComposable.filters.selectedQueueDepths).toEqual([])
      expect(filtersComposable.filters.selectedNumJobs).toEqual([])
      expect(filtersComposable.filters.selectedProtocols).toEqual([])
      expect(filtersComposable.filters.selectedHostDiskCombinations).toEqual([])
    })
  })

  describe('applyFilters', () => {
    it('should apply block size filter', () => {
      filtersComposable.applyFilters({ selectedBlockSizes: ['4k'] })
      expect(filtersComposable.filters.selectedBlockSizes).toEqual(['4k'])
      expect(filtersComposable.isFilterActive).toBe(true)
      expect(filtersComposable.getActiveFilterCount).toBe(1)
    })

    it('should apply multiple filters', () => {
      filtersComposable.applyFilters({
        selectedBlockSizes: ['4k'],
        selectedPatterns: ['read']
      })
      expect(filtersComposable.filters.selectedBlockSizes).toEqual(['4k'])
      expect(filtersComposable.filters.selectedPatterns).toEqual(['read'])
      expect(filtersComposable.getActiveFilterCount).toBe(2)
    })

    it('should merge filters with existing state', () => {
      filtersComposable.applyFilters({ selectedBlockSizes: ['4k'] })
      filtersComposable.applyFilters({ selectedPatterns: ['read'] })
      expect(filtersComposable.filters.selectedBlockSizes).toEqual(['4k'])
      expect(filtersComposable.filters.selectedPatterns).toEqual(['read'])
    })
  })

  describe('clearFilters and resetFilters', () => {
    beforeEach(() => {
      filtersComposable.applyFilters({
        selectedBlockSizes: ['4k'],
        selectedPatterns: ['read']
      })
    })

    it('should clear all filters', () => {
      filtersComposable.clearFilters()
      expect(filtersComposable.isFilterActive).toBe(false)
      expect(filtersComposable.getActiveFilterCount).toBe(0)
      expect(filtersComposable.filters.selectedBlockSizes).toEqual([])
      expect(filtersComposable.filters.selectedPatterns).toEqual([])
    })

    it('should reset all filters', () => {
      filtersComposable.resetFilters()
      expect(filtersComposable.isFilterActive).toBe(false)
      expect(filtersComposable.getActiveFilterCount).toBe(0)
    })
  })

  describe('matchesFilters', () => {
    it('should match all items when no filters are active', () => {
      expect(filtersComposable.matchesFilters(mockData[0])).toBe(true)
      expect(filtersComposable.matchesFilters(mockData[1])).toBe(true)
      expect(filtersComposable.matchesFilters(mockData[2])).toBe(true)
    })

    it('should filter by block size', () => {
      filtersComposable.applyFilters({ selectedBlockSizes: ['4k'] })
      expect(filtersComposable.matchesFilters(mockData[0])).toBe(true) // 4k
      expect(filtersComposable.matchesFilters(mockData[1])).toBe(false) // 8k
      expect(filtersComposable.matchesFilters(mockData[2])).toBe(true) // 4k
    })

    it('should filter by IO pattern', () => {
      filtersComposable.applyFilters({ selectedPatterns: ['read'] })
      expect(filtersComposable.matchesFilters(mockData[0])).toBe(true) // read
      expect(filtersComposable.matchesFilters(mockData[1])).toBe(false) // write
      expect(filtersComposable.matchesFilters(mockData[2])).toBe(false) // random_read
    })

    it('should filter by queue depth', () => {
      filtersComposable.applyFilters({ selectedQueueDepths: [1] })
      expect(filtersComposable.matchesFilters(mockData[0])).toBe(true) // QD 1
      expect(filtersComposable.matchesFilters(mockData[1])).toBe(false) // QD 2
      expect(filtersComposable.matchesFilters(mockData[2])).toBe(true) // QD 1
    })

    it('should filter by protocol', () => {
      filtersComposable.applyFilters({ selectedProtocols: ['tcp'] })
      expect(filtersComposable.matchesFilters(mockData[0])).toBe(true) // tcp
      expect(filtersComposable.matchesFilters(mockData[1])).toBe(false) // rdma
      expect(filtersComposable.matchesFilters(mockData[2])).toBe(true) // tcp
    })

    it('should filter by number of jobs', () => {
      filtersComposable.applyFilters({ selectedNumJobs: [1, 2] })
      expect(filtersComposable.matchesFilters(mockData[0])).toBe(true) // 1 job
      expect(filtersComposable.matchesFilters(mockData[1])).toBe(true) // 2 jobs
      expect(filtersComposable.matchesFilters(mockData[2])).toBe(false) // 4 jobs
    })

    it('should filter by host-disk combination', () => {
      filtersComposable.applyFilters({ selectedHostDiskCombinations: ['host1 - Drive1'] })
      expect(filtersComposable.matchesFilters(mockData[0])).toBe(true) // host1 - Drive1
      expect(filtersComposable.matchesFilters(mockData[1])).toBe(false) // host2 - Drive2
      expect(filtersComposable.matchesFilters(mockData[2])).toBe(true) // host1 - Drive1
    })

    it('should combine multiple filters (AND logic)', () => {
      filtersComposable.applyFilters({
        selectedBlockSizes: ['4k'],
        selectedPatterns: ['read']
      })
      expect(filtersComposable.matchesFilters(mockData[0])).toBe(true) // 4k + read
      expect(filtersComposable.matchesFilters(mockData[1])).toBe(false) // 8k + write
      expect(filtersComposable.matchesFilters(mockData[2])).toBe(false) // 4k + random_read
    })

    it('should handle null/undefined values gracefully', () => {
      const itemWithNulls = {
        ...mockData[0],
        block_size: null,
        read_write_pattern: null,
        protocol: null,
        num_jobs: null
      }
      filtersComposable.applyFilters({
        selectedBlockSizes: ['4k'],
        selectedPatterns: ['read'],
        selectedProtocols: ['tcp']
      })
      expect(filtersComposable.matchesFilters(itemWithNulls)).toBe(false)
    })
  })

  describe('getFilteredData', () => {
    it('should return filtered data array', () => {
      filtersComposable.applyFilters({ selectedBlockSizes: ['4k'] })
      const result = filtersComposable.getFilteredData(mockData)
      expect(result).toHaveLength(2)
      expect(result[0].block_size).toBe('4k')
      expect(result[1].block_size).toBe('4k')
    })

    it('should return all data when no filters active', () => {
      const result = filtersComposable.getFilteredData(mockData)
      expect(result).toEqual(mockData)
    })
  })

  describe('getActiveFilterTags', () => {
    it('should generate filter tags for block sizes', () => {
      filtersComposable.applyFilters({ selectedBlockSizes: ['4k', '8k'] })
      const tags = filtersComposable.getActiveFilterTags
      expect(tags).toHaveLength(2)
      expect(tags[0]).toEqual({
        id: 'blocksize-4k',
        label: 'Block: 4k',
        category: 'block-size'
      })
      expect(tags[1]).toEqual({
        id: 'blocksize-8k',
        label: 'Block: 8k',
        category: 'block-size'
      })
    })

    it('should generate filter tags for IO patterns', () => {
      filtersComposable.applyFilters({ selectedPatterns: ['random_read'] })
      const tags = filtersComposable.getActiveFilterTags
      expect(tags).toHaveLength(1)
      expect(tags[0]).toEqual({
        id: 'pattern-random_read',
        label: 'Pattern: random read',
        category: 'io-pattern'
      })
    })

    it('should generate filter tags for protocols', () => {
      filtersComposable.applyFilters({ selectedProtocols: ['tcp'] })
      const tags = filtersComposable.getActiveFilterTags
      expect(tags).toHaveLength(1)
      expect(tags[0]).toEqual({
        id: 'protocol-tcp',
        label: 'Protocol: TCP',
        category: 'protocol'
      })
    })

    it('should generate filter tags for multiple categories', () => {
      filtersComposable.applyFilters({
        selectedBlockSizes: ['4k'],
        selectedPatterns: ['read'],
        selectedQueueDepths: [1]
      })
      const tags = filtersComposable.getActiveFilterTags
      expect(tags).toHaveLength(3)
      expect(tags.map(t => t.category)).toEqual(
        expect.arrayContaining(['block-size', 'io-pattern', 'queue-depth'])
      )
    })
  })

  describe('getFilterSummary', () => {
    it('should return filter summary structure', () => {
      filtersComposable.applyFilters({ selectedBlockSizes: ['4k'] })
      const summary = filtersComposable.getFilterSummary()
      expect(summary.activeFilters).toBe(1)
      expect(summary.totalItems).toBe(0) // Not set by composable
      expect(summary.filteredItems).toBe(0) // Not set by composable
    })
  })
})

describe('quickFilters', () => {
  it('should have predefined filter presets', () => {
    expect(quickFilters['high-performance']).toBeDefined()
    expect(quickFilters['low-latency']).toBeDefined()
    expect(quickFilters['sequential']).toBeDefined()
    expect(quickFilters['random']).toBeDefined()
  })

  it('should have correct filter configurations', () => {
    expect(quickFilters['high-performance'].filters.selectedPatterns).toEqual(['random_read', 'random_write'])
    expect(quickFilters['low-latency'].filters.selectedPatterns).toEqual(['random_read'])
    expect(quickFilters['sequential'].filters.selectedPatterns).toEqual(['sequential_read', 'sequential_write'])
    expect(quickFilters['random'].filters.selectedPatterns).toEqual(['random_read', 'random_write'])
  })

  it('should have descriptive labels', () => {
    expect(quickFilters['high-performance'].label).toBe('High IOPS')
    expect(quickFilters['low-latency'].label).toBe('Low Latency')
    expect(quickFilters['sequential'].label).toBe('Sequential IO')
    expect(quickFilters['random'].label).toBe('Random IO')
  })
})

describe('applyQuickFilter', () => {
  let filtersComposable: ReturnType<typeof useFilters>

  beforeEach(() => {
    filtersComposable = useFilters()
  })

  it('should apply high-performance quick filter', () => {
    applyQuickFilter('high-performance')
    expect(filtersComposable.filters.selectedPatterns).toEqual(['random_read', 'random_write'])
  })

  it('should apply low-latency quick filter', () => {
    applyQuickFilter('low-latency')
    expect(filtersComposable.filters.selectedPatterns).toEqual(['random_read'])
  })

  it('should apply sequential quick filter', () => {
    applyQuickFilter('sequential')
    expect(filtersComposable.filters.selectedPatterns).toEqual(['sequential_read', 'sequential_write'])
  })

  it('should apply random quick filter', () => {
    applyQuickFilter('random')
    expect(filtersComposable.filters.selectedPatterns).toEqual(['random_read', 'random_write'])
  })

  it('should handle invalid filter key gracefully', () => {
    // @ts-expect-error Testing invalid key
    applyQuickFilter('invalid-key')
    expect(filtersComposable.isFilterActive).toBe(false)
  })
})
