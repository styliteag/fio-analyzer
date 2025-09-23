/**
 * Data Transformation Utilities
 * Functions to transform raw performance data into visualization-ready formats
 */

import type { PerformanceData } from '@/types/performance'
import type { FilterState } from '@/types/filters'

/**
 * Filter performance data based on active filters
 */
export function applyFiltersToPerformanceData(
  data: PerformanceData[],
  filters: FilterState
): PerformanceData[] {
  return data.filter(item => {
    // Block size filter
    if (filters.selectedBlockSizes.length > 0 &&
        !filters.selectedBlockSizes.includes(item.block_size)) {
      return false
    }

    // Pattern filter
    if (filters.selectedPatterns.length > 0 &&
        !filters.selectedPatterns.includes(item.read_write_pattern)) {
      return false
    }

    // Queue depth filter
    if (filters.selectedQueueDepths.length > 0 &&
        !filters.selectedQueueDepths.includes(item.queue_depth)) {
      return false
    }

    // Number of jobs filter
    if (filters.selectedNumJobs.length > 0 &&
        (item.num_jobs === null || item.num_jobs === undefined ||
         !filters.selectedNumJobs.includes(item.num_jobs))) {
      return false
    }

    // Protocol filter
    if (filters.selectedProtocols.length > 0 &&
        (!item.protocol || !filters.selectedProtocols.includes(item.protocol))) {
      return false
    }

    return true
  })
}

/**
 * Transform performance data for chart series
 */
export function transformToChartSeries(
  data: PerformanceData[],
  xField: keyof PerformanceData,
  yField: keyof PerformanceData,
  groupBy?: keyof PerformanceData
): Array<{
  name: string
  data: Array<{ x: string | number | null; y: number | null }>
}> {
  if (!groupBy) {
    // Single series
    return [{
      name: 'Performance Data',
      data: data.map(item => ({
        x: item[xField],
        y: typeof item[yField] === 'number' ? item[yField] as number : null
      }))
    }]
  }

  // Grouped series
  const groups = new Map<string, Array<{ x: string | number | null; y: number | null }>>()

  data.forEach(item => {
    const groupKey = String(item[groupBy] || 'Unknown')
    const point = {
      x: item[xField],
      y: typeof item[yField] === 'number' ? item[yField] as number : null
    }

    if (!groups.has(groupKey)) {
      groups.set(groupKey, [])
    }
    groups.get(groupKey)!.push(point)
  })

  return Array.from(groups.entries()).map(([name, data]) => ({
    name,
    data
  }))
}

/**
 * Transform data for IOPS comparison chart
 */
export function transformForIOPSComparison(
  data: PerformanceData[],
  filters: FilterState
): Array<{
  blockSize: string
  patterns: Array<{
    pattern: string
    iops: number | null
  }>
}> {
  const filteredData = applyFiltersToPerformanceData(data, filters)

  // Group by block size
  const blockSizeGroups = new Map<string, PerformanceData[]>()

  filteredData.forEach(item => {
    const blockSize = item.block_size
    if (!blockSizeGroups.has(blockSize)) {
      blockSizeGroups.set(blockSize, [])
    }
    blockSizeGroups.get(blockSize)!.push(item)
  })

  // Transform to chart format
  return Array.from(blockSizeGroups.entries()).map(([blockSize, items]) => {
    // Group by pattern within each block size
    const patternMap = new Map<string, number | null>()

    items.forEach(item => {
      const pattern = item.read_write_pattern
      const iops = item.iops
      patternMap.set(pattern, iops)
    })

    return {
      blockSize,
      patterns: Array.from(patternMap.entries()).map(([pattern, iops]) => ({
        pattern,
        iops
      }))
    }
  })
}

/**
 * Transform data for latency analysis chart
 */
export function transformForLatencyAnalysis(
  data: PerformanceData[],
  filters: FilterState
): Array<{
  blockSize: string
  latency: number | null
  p95Latency: number | null
  p99Latency: number | null
}> {
  const filteredData = applyFiltersToPerformanceData(data, filters)

  // Group by block size and aggregate latency metrics
  const blockSizeGroups = new Map<string, PerformanceData[]>()

  filteredData.forEach(item => {
    const blockSize = item.block_size
    if (!blockSizeGroups.has(blockSize)) {
      blockSizeGroups.set(blockSize, [])
    }
    blockSizeGroups.get(blockSize)!.push(item)
  })

  return Array.from(blockSizeGroups.entries()).map(([blockSize, items]) => {
    // Calculate averages for latency metrics
    const validLatencies = items.filter(item => item.avg_latency !== null && item.avg_latency !== undefined)
    const validP95 = items.filter(item => item.p95_latency !== null && item.p95_latency !== undefined)
    const validP99 = items.filter(item => item.p99_latency !== null && item.p99_latency !== undefined)

    const avgLatency = validLatencies.length > 0
      ? validLatencies.reduce((sum, item) => sum + (item.avg_latency || 0), 0) / validLatencies.length
      : null

    const avgP95 = validP95.length > 0
      ? validP95.reduce((sum, item) => sum + (item.p95_latency || 0), 0) / validP95.length
      : null

    const avgP99 = validP99.length > 0
      ? validP99.reduce((sum, item) => sum + (item.p99_latency || 0), 0) / validP99.length
      : null

    return {
      blockSize,
      latency: avgLatency,
      p95Latency: avgP95,
      p99Latency: avgP99
    }
  })
}

/**
 * Transform data for bandwidth trends chart
 */
export function transformForBandwidthTrends(
  data: PerformanceData[],
  filters: FilterState
): Array<{
  blockSize: string
  bandwidth: number | null
  readBandwidth: number | null
  writeBandwidth: number | null
}> {
  const filteredData = applyFiltersToPerformanceData(data, filters)

  // Group by block size
  const blockSizeGroups = new Map<string, PerformanceData[]>()

  filteredData.forEach(item => {
    const blockSize = item.block_size
    if (!blockSizeGroups.has(blockSize)) {
      blockSizeGroups.set(blockSize, [])
    }
    blockSizeGroups.get(blockSize)!.push(item)
  })

  return Array.from(blockSizeGroups.entries()).map(([blockSize, items]) => {
    // Calculate average bandwidth
    const validBandwidths = items.filter(item => item.bandwidth !== null && item.bandwidth !== undefined)
    const avgBandwidth = validBandwidths.length > 0
      ? validBandwidths.reduce((sum, item) => sum + (item.bandwidth || 0), 0) / validBandwidths.length
      : null

    // For now, we don't have separate read/write bandwidth in the data structure
    // This could be extended if the backend provides more detailed metrics
    return {
      blockSize,
      bandwidth: avgBandwidth,
      readBandwidth: null,
      writeBandwidth: null
    }
  })
}

/**
 * Transform data for responsiveness chart
 */
export function transformForResponsiveness(
  data: PerformanceData[],
  filters: FilterState
): Array<{
  blockSize: string
  responsiveness: number | null
}> {
  const filteredData = applyFiltersToPerformanceData(data, filters)

  // Group by block size
  const blockSizeGroups = new Map<string, PerformanceData[]>()

  filteredData.forEach(item => {
    const blockSize = item.block_size
    if (!blockSizeGroups.has(blockSize)) {
      blockSizeGroups.set(blockSize, [])
    }
    blockSizeGroups.get(blockSize)!.push(item)
  })

  return Array.from(blockSizeGroups.entries()).map(([blockSize, items]) => {
    // Calculate responsiveness: 1000 / latency (ops per millisecond)
    const validLatencies = items.filter(item => item.avg_latency !== null && item.avg_latency !== undefined && item.avg_latency > 0)
    const avgResponsiveness = validLatencies.length > 0
      ? validLatencies.reduce((sum, item) => sum + (1000 / (item.avg_latency || 1)), 0) / validLatencies.length
      : null

    return {
      blockSize,
      responsiveness: avgResponsiveness
    }
  })
}

/**
 * Transform data for heatmap visualization
 */
export function transformForHeatmap(
  data: PerformanceData[],
  filters: FilterState
): Array<{
  blockSize: string
  hostname: string
  pattern: string
  iops: number | null
  bandwidth: number | null
  responsiveness: number | null
}> {
  const filteredData = applyFiltersToPerformanceData(data, filters)

  return filteredData.map(item => ({
    blockSize: item.block_size,
    hostname: item.hostname || 'Unknown',
    pattern: item.read_write_pattern,
    iops: item.iops,
    bandwidth: item.bandwidth,
    responsiveness: item.avg_latency && item.avg_latency > 0 ? 1000 / item.avg_latency : null
  }))
}

/**
 * Normalize values for fair comparison across different scales
 */
export function normalizeValues(values: (number | null)[], method: 'min-max' | 'z-score' = 'min-max'): (number | null)[] {
  const validValues = values.filter(v => v !== null && v !== undefined) as number[]

  if (validValues.length === 0) return values

  if (method === 'min-max') {
    const min = Math.min(...validValues)
    const max = Math.max(...validValues)
    const range = max - min

    if (range === 0) return values.map(() => 50) // All same value

    return values.map(v => v === null || v === undefined ? null : ((v - min) / range) * 100)
  } else {
    // Z-score normalization
    const mean = validValues.reduce((sum, v) => sum + v, 0) / validValues.length
    const variance = validValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / validValues.length
    const stdDev = Math.sqrt(variance)

    if (stdDev === 0) return values.map(() => 0) // All same value

    return values.map(v => v === null || v === undefined ? null : (v - mean) / stdDev)
  }
}

/**
 * Sort block sizes in logical order (numeric sorting)
 */
export function sortBlockSizes(blockSizes: string[]): string[] {
  return blockSizes.sort((a, b) => {
    // Extract numeric values for sorting
    const aMatch = a.match(/(\d+)/)
    const bMatch = b.match(/(\d+)/)

    if (aMatch && bMatch) {
      const aNum = parseInt(aMatch[1], 10)
      const bNum = parseInt(bMatch[1], 10)
      return aNum - bNum
    }

    return a.localeCompare(b)
  })
}
