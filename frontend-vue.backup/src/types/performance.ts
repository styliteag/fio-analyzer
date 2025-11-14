/**
 * Performance Data Types
 * Based on data-model.md specifications
 */

// Performance metrics with appropriate units and statistical summaries
export interface PerformanceMetrics {
  iops: {
    value: number
    unit: 'IOPS'
  }
  avg_latency: {
    value: number
    unit: 'ms'
  }
  bandwidth: {
    value: number
    unit: 'MB/s'
  }
  p95_latency?: {
    value: number
    unit: 'ms'
  }
  p99_latency?: {
    value: number
    unit: 'ms'
  }
}

export interface PerformanceData {
  iops: number | null | undefined
  avg_latency: number | null | undefined
  bandwidth: number | null | undefined
  block_size: string
  read_write_pattern: string
  queue_depth: number
  num_jobs: number | null | undefined
  hostname: string
  drive_model: string | undefined
  drive_type: string | undefined
  protocol: string | undefined
  timestamp: string
  p95_latency?: number | null
  p99_latency?: number | null
}

export interface TestConfiguration {
  block_size: string
  read_write_pattern: string
  queue_depth: number
  num_jobs: number | null | undefined
  iops: number | null | undefined
  avg_latency: number | null | undefined
  bandwidth: number | null | undefined
  p95_latency?: number | null | undefined
  p99_latency?: number | null | undefined
  timestamp: string
}

export interface DriveAnalysis {
  drive_model: string
  drive_type: string | undefined
  protocol: string | undefined
  hostname: string
  testCount: number
  configurations: TestConfiguration[]
  topPerformance: {
    maxIOPS: number
    minLatency: number
    maxBandwidth: number
  }
}

export interface TestCoverage {
  blockSizes: string[]
  patterns: string[]
  queueDepths: number[]
  numJobs: number[]
  protocols: string[]
  hostDiskCombinations: string[]
}

export interface PerformanceSummary {
  avgIOPS: number
  avgLatency: number
  avgBandwidth: number
  bestDrive: string
  worstDrive: string
}

export interface HostAnalysisData {
  hostname: string
  totalTests: number
  drives: DriveAnalysis[]
  testCoverage: TestCoverage
  performanceSummary: PerformanceSummary
}

// Validation functions
export function validatePerformanceData(data: PerformanceData): boolean {
  return (
    typeof data.iops === 'number' || data.iops === null || data.iops === undefined
  ) && (
    typeof data.avg_latency === 'number' || data.avg_latency === null || data.avg_latency === undefined
  ) && (
    typeof data.bandwidth === 'number' || data.bandwidth === null || data.bandwidth === undefined
  ) && typeof data.block_size === 'string' &&
  typeof data.read_write_pattern === 'string' &&
  typeof data.queue_depth === 'number' &&
  typeof data.hostname === 'string' &&
  typeof data.timestamp === 'string'
}

export function normalizePerformanceMetrics(data: PerformanceData[]): {
  maxIOPS: number
  maxBandwidth: number
  maxResponsiveness: number
} {
  let maxIOPS = 0
  let maxBandwidth = 0
  let maxResponsiveness = 0

  data.forEach(item => {
    if (item.iops && item.iops > maxIOPS) maxIOPS = item.iops
    if (item.bandwidth && item.bandwidth > maxBandwidth) maxBandwidth = item.bandwidth

    // Responsiveness = 1000 / latency (ops/ms)
    if (item.avg_latency && item.avg_latency > 0) {
      const responsiveness = 1000 / item.avg_latency
      if (responsiveness > maxResponsiveness) maxResponsiveness = responsiveness
    }
  })

  return { maxIOPS, maxBandwidth, maxResponsiveness }
}
