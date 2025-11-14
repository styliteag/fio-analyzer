export interface TestRun {
  id: number
  timestamp: string
  test_date: string | null
  drive_model: string
  drive_type: string
  test_name: string
  block_size: string
  read_write_pattern: string
  queue_depth: number
  duration: number

  // FIO metadata
  fio_version: string | null
  job_runtime: number | null
  rwmixread: number | null
  total_ios_read: number | null
  total_ios_write: number | null
  usr_cpu: number | null
  sys_cpu: number | null

  // System info
  hostname: string | null
  protocol: string | null
  description: string | null
  uploaded_file_path: string | null

  // Job configuration
  output_file: string | null
  num_jobs: number | null
  direct: number | null
  test_size: string | null
  sync: number | null
  iodepth: number | null
  is_latest: number | null

  // Performance metrics
  avg_latency: number | null
  bandwidth: number | null
  iops: number | null
  p95_latency: number | null
  p99_latency: number | null
}

export interface FilterOptions {
  hostnames: string[]
  protocols: string[]
  drive_types: string[]
  drive_models: string[]
  block_sizes: string[]
  patterns: string[]
  queue_depths: number[]
  num_jobs: number[]
  directs: number[]
  syncs: number[]
  test_sizes: string[]
  durations: number[]
}

export interface ActiveFilters {
  hostnames: string[]
  protocols: string[]
  drive_types: string[]
  drive_models: string[]
  block_sizes: string[]
  patterns: string[]
  queue_depths: number[]
  num_jobs: number[]
  directs: number[]
  syncs: number[]
  test_sizes: string[]
  durations: number[]
}

export type MetricType = 'iops' | 'avg_latency' | 'bandwidth' | 'p95_latency' | 'p99_latency'

export interface ChartDataset {
  label: string
  data: number[]
  backgroundColor: string
  borderColor?: string
  borderWidth?: number
}

export interface ChartData {
  labels: string[]
  datasets: ChartDataset[]
}
