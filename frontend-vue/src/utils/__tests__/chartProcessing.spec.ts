/**
 * Unit tests for chart processing utilities
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  generateColorPalette,
  createChartDataset,
  processIOPSComparisonData,
  processLatencyAnalysisData,
  processBandwidthTrendsData,
  processResponsivenessData,
  createHeatmapData,
  createChartOptions
} from '../chartProcessing'

describe('generateColorPalette', () => {
  it('should generate correct number of colors for light theme', () => {
    const colors = generateColorPalette(3, 'light')
    expect(colors).toHaveLength(3)
    expect(colors[0]).toBe('#3B82F6') // blue-500
    expect(colors[1]).toBe('#EF4444') // red-500
    expect(colors[2]).toBe('#10B981') // emerald-500
  })

  it('should generate correct number of colors for dark theme', () => {
    const colors = generateColorPalette(3, 'dark')
    expect(colors).toHaveLength(3)
    expect(colors[0]).toBe('#60A5FA') // blue-400
    expect(colors[1]).toBe('#F87171') // red-400
    expect(colors[2]).toBe('#34D399') // emerald-400
  })

  it('should repeat colors when requesting more than available', () => {
    const colors = generateColorPalette(10, 'light')
    expect(colors).toHaveLength(10)
    expect(colors[0]).toBe(colors[8]) // Should repeat
  })

  it('should default to light theme', () => {
    const colors = generateColorPalette(2)
    expect(colors[0]).toBe('#3B82F6')
  })
})

describe('createChartDataset', () => {
  it('should create dataset with correct structure for light theme', () => {
    const dataset = createChartDataset('Test Series', [1, 2, 3], '#3B82F6', 'light')
    expect(dataset.label).toBe('Test Series')
    expect(dataset.data).toEqual([1, 2, 3])
    expect(dataset.borderColor).toBe('#3B82F6')
    expect(dataset.backgroundColor).toBe('#3B82F620') // With transparency
    expect(dataset.borderWidth).toBe(2)
    expect(dataset.fill).toBe(false)
    expect(dataset.tension).toBe(0.1)
  })

  it('should create dataset with correct structure for dark theme', () => {
    const dataset = createChartDataset('Test Series', [1, 2, 3], '#60A5FA', 'dark')
    expect(dataset.backgroundColor).toBe('#60A5FA30') // With transparency
  })
})

describe('processIOPSComparisonData', () => {
  let mockData: Array<{
    blockSize: string
    patterns: Array<{
      pattern: string
      iops: number | null
    }>
  }>

  beforeEach(() => {
    mockData = [
      {
        blockSize: '4k',
        patterns: [
          { pattern: 'read', iops: 1000 },
          { pattern: 'write', iops: 800 }
        ]
      },
      {
        blockSize: '8k',
        patterns: [
          { pattern: 'read', iops: 1200 },
          { pattern: 'write', iops: 900 }
        ]
      }
    ]
  })

  it('should process IOPS data correctly', () => {
    const result = processIOPSComparisonData(mockData, 'light')
    expect(result.labels).toEqual(['4k', '8k']) // Should be sorted
    expect(result.datasets).toHaveLength(2) // Two patterns

    // Check first dataset (read pattern)
    expect(result.datasets[0].label).toBe('READ')
    expect(result.datasets[0].data).toEqual([1000, 1200])

    // Check second dataset (write pattern)
    expect(result.datasets[1].label).toBe('WRITE')
    expect(result.datasets[1].data).toEqual([800, 900])
  })

  it('should handle null values', () => {
    const dataWithNulls = [
      {
        blockSize: '4k',
        patterns: [
          { pattern: 'read', iops: null },
          { pattern: 'write', iops: 800 }
        ]
      }
    ]
    const result = processIOPSComparisonData(dataWithNulls, 'light')
    expect(result.datasets[0].data).toEqual([null])
    expect(result.datasets[1].data).toEqual([800])
  })
})

describe('processLatencyAnalysisData', () => {
  let mockData: Array<{
    blockSize: string
    latency: number | null
    p95Latency: number | null
    p99Latency: number | null
  }>

  beforeEach(() => {
    mockData = [
      {
        blockSize: '4k',
        latency: 1.5,
        p95Latency: 2.0,
        p99Latency: 3.0
      },
      {
        blockSize: '8k',
        latency: 2.5,
        p95Latency: 3.5,
        p99Latency: 4.5
      }
    ]
  })

  it('should process latency data with three datasets', () => {
    const result = processLatencyAnalysisData(mockData, 'light')
    expect(result.labels).toEqual(['4k', '8k'])
    expect(result.datasets).toHaveLength(3)

    expect(result.datasets[0].label).toBe('Average Latency (ms)')
    expect(result.datasets[0].data).toEqual([1.5, 2.5])

    expect(result.datasets[1].label).toBe('95th Percentile (ms)')
    expect(result.datasets[1].data).toEqual([2.0, 3.5])

    expect(result.datasets[2].label).toBe('99th Percentile (ms)')
    expect(result.datasets[2].data).toEqual([3.0, 4.5])
  })

  it('should handle dashed lines for percentiles', () => {
    const result = processLatencyAnalysisData(mockData, 'light')
    expect(result.datasets[1].borderDash).toEqual([5, 5]) // 95th percentile
    expect(result.datasets[2].borderDash).toEqual([10, 5]) // 99th percentile
  })
})

describe('processBandwidthTrendsData', () => {
  let mockData: Array<{
    blockSize: string
    bandwidth: number | null
  }>

  beforeEach(() => {
    mockData = [
      { blockSize: '4k', bandwidth: 1000 },
      { blockSize: '8k', bandwidth: 1500 }
    ]
  })

  it('should process bandwidth data correctly', () => {
    const result = processBandwidthTrendsData(mockData, 'light')
    expect(result.labels).toEqual(['4k', '8k'])
    expect(result.datasets).toHaveLength(1)
    expect(result.datasets[0].label).toBe('Bandwidth (MB/s)')
    expect(result.datasets[0].data).toEqual([1000, 1500])
    expect(result.datasets[0].fill).toBe(true)
  })
})

describe('processResponsivenessData', () => {
  let mockData: Array<{
    blockSize: string
    responsiveness: number | null
  }>

  beforeEach(() => {
    mockData = [
      { blockSize: '4k', responsiveness: 666.67 },
      { blockSize: '8k', responsiveness: 400 }
    ]
  })

  it('should process responsiveness data correctly', () => {
    const result = processResponsivenessData(mockData, 'light')
    expect(result.labels).toEqual(['4k', '8k'])
    expect(result.datasets).toHaveLength(1)
    expect(result.datasets[0].label).toBe('Responsiveness (ops/ms)')
    expect(result.datasets[0].data).toEqual([666.67, 400])
  })
})

describe('createHeatmapData', () => {
  let mockData: Array<{
    blockSize: string
    hostname: string
    pattern: string
    iops: number | null
    bandwidth: number | null
    responsiveness: number | null
  }>

  beforeEach(() => {
    mockData = [
      {
        blockSize: '4k',
        hostname: 'host1',
        pattern: 'read',
        iops: 1000,
        bandwidth: 4000,
        responsiveness: 666.67
      },
      {
        blockSize: '8k',
        hostname: 'host2',
        pattern: 'write',
        iops: 800,
        bandwidth: 3200,
        responsiveness: 500
      }
    ]
  })

  it('should create heatmap data structure', () => {
    const result = createHeatmapData(mockData)
    expect(result.blockSizes).toEqual(['4k', '8k']) // Should be sorted
    expect(result.hostnames).toEqual(['host1', 'host2']) // Should be sorted
    expect(result.patterns).toEqual(['read', 'write']) // Should be sorted
    expect(result.data).toHaveLength(2)
  })

  it('should normalize values', () => {
    const result = createHeatmapData(mockData)
    // Check that normalized values are calculated
    expect(typeof result.data[0].normalizedIops).toBe('number')
    expect(typeof result.data[0].normalizedBandwidth).toBe('number')
    expect(typeof result.data[0].normalizedResponsiveness).toBe('number')
  })

  it('should handle null values in normalization', () => {
    const dataWithNulls = [
      { ...mockData[0], iops: null }
    ]
    const result = createHeatmapData(dataWithNulls)
    expect(result.data[0].normalizedIops).toBe(0) // Default for null
  })
})

describe('createChartOptions', () => {
  it('should create chart options with title', () => {
    const options = createChartOptions('Test Chart', 'light')
    expect(options.plugins?.title?.text).toBe('Test Chart')
    expect(options.plugins?.title?.display).toBe(true)
    expect(options.responsive).toBe(true)
  })

  it('should apply light theme colors', () => {
    const options = createChartOptions('Test', 'light')
    expect(options.plugins?.title?.color).toBe('#1F2937')
    expect(options.plugins?.legend?.labels?.color).toBe('#374151')
    expect(options.scales?.x?.ticks?.color).toBe('#6B7280')
  })

  it('should apply dark theme colors', () => {
    const options = createChartOptions('Test', 'dark')
    expect(options.plugins?.title?.color).toBe('#F9FAFB')
    expect(options.plugins?.legend?.labels?.color).toBe('#D1D5DB')
    expect(options.scales?.x?.ticks?.color).toBe('#9CA3AF')
  })

  it('should merge additional options', () => {
    const additionalOptions = {
      plugins: {
        title: {
          font: { size: 20 }
        }
      }
    }
    const options = createChartOptions('Test', 'light', additionalOptions)
    expect(options.plugins?.title?.font?.size).toBe(20)
    expect(options.plugins?.title?.text).toBe('Test') // Original title preserved
  })

  it('should have proper scale configuration', () => {
    const options = createChartOptions('Test', 'light')
    expect(options.scales?.x?.title?.text).toBe('Block Size')
    expect(options.scales?.y?.title?.text).toBe('Performance')
    expect(options.scales?.x?.display).toBe(true)
    expect(options.scales?.y?.display).toBe(true)
  })
})
