import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { TestRun } from '../types/testRun'
import { useFiltersStore } from './filters'

export const useTestRunsStore = defineStore('testRuns', () => {
  const testRuns = ref<TestRun[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Get unique hostnames from test runs
  const availableHostnames = computed(() => {
    const hostnames = new Set<string>()
    testRuns.value.forEach((run) => {
      if (run.hostname) hostnames.add(run.hostname)
    })
    return Array.from(hostnames).sort()
  })

  // Filter test runs by selected hostnames
  function getTestRunsByHosts(hostnames: string[]): TestRun[] {
    if (hostnames.length === 0) return testRuns.value

    return testRuns.value.filter((run) =>
      run.hostname && hostnames.includes(run.hostname)
    )
  }

  // Group test runs by configuration (excluding hostname)
  function groupByConfiguration(runs: TestRun[]): Map<string, TestRun[]> {
    const groups = new Map<string, TestRun[]>()

    runs.forEach((run) => {
      const key = [
        run.block_size,
        run.read_write_pattern,
        run.queue_depth,
        run.num_jobs,
        run.direct,
        run.sync,
        run.duration
      ].join('|')

      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(run)
    })

    return groups
  }

  // Set test runs data
  function setTestRuns(runs: TestRun[]) {
    testRuns.value = runs
    error.value = null
  }

  // Fetch test runs from API
  async function fetchTestRuns(authHeader: string | null) {
    if (!authHeader) {
      error.value = 'Not authenticated'
      return
    }

    loading.value = true
    error.value = null

    try {
      const filtersStore = useFiltersStore()
      const queryParams = filtersStore.getQueryParams()
      const queryString = new URLSearchParams(queryParams).toString()
      const url = queryString ? `/api/test-runs?${queryString}` : '/api/test-runs'

      const response = await fetch(url, {
        headers: {
          'Authorization': authHeader
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`)
      }

      const data = await response.json()
      setTestRuns(data)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch test runs'
      console.error('Error fetching test runs:', err)
    } finally {
      loading.value = false
    }
  }

  // Clear data
  function clear() {
    testRuns.value = []
    error.value = null
  }

  return {
    testRuns,
    loading,
    error,
    availableHostnames,
    getTestRunsByHosts,
    groupByConfiguration,
    setTestRuns,
    fetchTestRuns,
    clear
  }
})
