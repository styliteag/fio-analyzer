// TestRun interface for FIO performance test data
export interface TestRun {
  // Identity
  id: number
  timestamp: string // ISO 8601 format

  // System Information
  hostname: string
  drive_model: string
  drive_type: string // "NVMe", "SATA", "SAS"
  protocol: string // "Local", "iSCSI", "NFS"

  // Test Configuration
  test_name: string
  description?: string
  block_size: string // "4K", "8K", "64K", "1M"
  read_write_pattern: string // "randread", "randwrite", "read", "write"
  queue_depth: number
  duration: number // seconds
  num_jobs: number
  direct: 0 | 1 // 0=buffered, 1=direct
  sync: 0 | 1 // 0=async, 1=sync
  test_size: string // "1G", "10G", "100G"

  // Performance Metrics
  iops: number
  avg_latency: number // milliseconds
  bandwidth: number // MB/s
  p95_latency?: number // milliseconds
  p99_latency?: number // milliseconds

  // Additional Fields
  fio_version?: string
  job_runtime?: number
  rwmixread?: number | null
  total_ios_read?: number
  total_ios_write?: number
  usr_cpu?: number
  sys_cpu?: number
  output_file?: string
  is_latest?: boolean
}