import { ref, computed } from 'vue'
import type { TestRun, TestRunFilters, FilterOptions } from '@/services/apiClient'
import { apiClient } from '@/services/apiClient'

const testRuns = ref<TestRun[]>([])
const filterOptions = ref<FilterOptions>({
  drive_models: [],
  host_disk_combinations: [],
  block_sizes: [],
  patterns: [],
  syncs: [],
  queue_depths: [],
  directs: [],
  num_jobs: [],
  test_sizes: [],
  durations: [],
  hostnames: [],
  protocols: [],
  drive_types: [],
})
const loading = ref(false)
const error = ref<string | null>(null)

export function useTestRuns() {
  const filteredTestRuns = computed(() => testRuns.value)

  const fetchTestRuns = async (filters?: TestRunFilters): Promise<TestRun[]> => {
    loading.value = true
    error.value = null

    try {
      const data = await apiClient.getTestRuns(filters)
      testRuns.value = data
      return data
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch test runs'
      console.error('Error fetching test runs:', err)
      return []
    } finally {
      loading.value = false
    }
  }

  const fetchFilterOptions = async (): Promise<void> => {
    try {
      const options = await apiClient.getFilterOptions()
      filterOptions.value = options
    } catch (err) {
      console.error('Error fetching filter options:', err)
    }
  }

  const refreshData = async (): Promise<void> => {
    await Promise.all([
      fetchTestRuns(),
      fetchFilterOptions()
    ])
  }

  const getTestRunById = (id: number): TestRun | undefined => {
    return testRuns.value.find(run => run.id === id)
  }

  const getTestRunsByHostname = (hostname: string): TestRun[] => {
    return testRuns.value.filter(run => run.hostname === hostname)
  }

  const getUniqueHostnames = computed(() => {
    const hostnames = new Set(
      testRuns.value
        .map(run => run.hostname)
        .filter((hostname): hostname is string => Boolean(hostname))
    )
    return Array.from(hostnames).sort((a, b) => a.localeCompare(b))
  })

  const getUniqueDriveTypes = computed(() => {
    const driveTypes = new Set(
      testRuns.value
        .map(run => run.drive_type)
        .filter((type): type is string => Boolean(type))
    )
    return Array.from(driveTypes).sort((a, b) => a.localeCompare(b))
  })

  const getUniqueTestTypes = computed(() => {
    const testTypes = new Set(
      testRuns.value
        .map(run => run.test_name ?? run.read_write_pattern)
        .filter((value): value is string => Boolean(value))
    )
    return Array.from(testTypes).sort((a, b) => a.localeCompare(b))
  })

  const getLatestTestRuns = computed(() => {
    // Group by hostname and get the latest test run for each
    const latestByHost = new Map<string, TestRun>()

    testRuns.value.forEach(run => {
      const existing = latestByHost.get(run.hostname)
      if (!existing || new Date(run.timestamp) > new Date(existing.timestamp)) {
        latestByHost.set(run.hostname, run)
      }
    })

    return Array.from(latestByHost.values()).sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
  })

  const getPerformanceMetrics = (testRun: TestRun) => {
    return {
      iops: {
        read: testRun.iops ?? 0,
        write: null,
        total: testRun.iops ?? 0,
      },
      latency: {
        read: {
          avg: testRun.avg_latency ?? 0,
          p95: testRun.p95_latency ?? 0,
          p99: testRun.p99_latency ?? 0,
        },
        write: {
          avg: null,
          p95: null,
          p99: null,
        },
      },
      bandwidth: {
        read: testRun.bandwidth ?? 0,
        write: null,
        total: testRun.bandwidth ?? 0,
      },
    }
  }

  return {
    // State
    testRuns: filteredTestRuns,
    filterOptions,
    loading,
    error,

    // Actions
    fetchTestRuns,
    fetchFilterOptions,
    refreshData,

    // Computed/Getters
    getTestRunById,
    getTestRunsByHostname,
    getUniqueHostnames,
    getUniqueDriveTypes,
    getUniqueTestTypes,
    getLatestTestRuns,
    getPerformanceMetrics
  }
}
