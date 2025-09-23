import { ref, computed } from 'vue'
import type { TestRun, TestRunFilters, FilterOptions } from '@/services/apiClient'
import { apiClient } from '@/services/apiClient'

const testRuns = ref<TestRun[]>([])
const filterOptions = ref<FilterOptions>({
  hostnames: [],
  drive_types: [],
  test_types: []
})
const loading = ref(false)
const error = ref<string | null>(null)

export function useTestRuns() {
  const filteredTestRuns = computed(() => testRuns.value)

  const fetchTestRuns = async (filters?: TestRunFilters): Promise<void> => {
    loading.value = true
    error.value = null

    try {
      const data = await apiClient.getTestRuns(filters)
      testRuns.value = data
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch test runs'
      console.error('Error fetching test runs:', err)
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
    const hostnames = new Set(testRuns.value.map(run => run.hostname))
    return Array.from(hostnames).sort()
  })

  const getUniqueDriveTypes = computed(() => {
    const driveTypes = new Set(testRuns.value.map(run => run.drive_type))
    return Array.from(driveTypes).sort()
  })

  const getUniqueTestTypes = computed(() => {
    const testTypes = new Set(testRuns.value.map(run => run.test_type))
    return Array.from(testTypes).sort()
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
        read: testRun.iops_read,
        write: testRun.iops_write,
        total: testRun.iops_read + testRun.iops_write
      },
      latency: {
        read: {
          avg: testRun.latency_read_avg,
          p95: testRun.latency_read_p95,
          p99: testRun.latency_read_p99
        },
        write: {
          avg: testRun.latency_write_avg,
          p95: testRun.latency_write_p95,
          p99: testRun.latency_write_p99
        }
      },
      bandwidth: {
        read: testRun.bandwidth_read,
        write: testRun.bandwidth_write,
        total: testRun.bandwidth_read + testRun.bandwidth_write
      }
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