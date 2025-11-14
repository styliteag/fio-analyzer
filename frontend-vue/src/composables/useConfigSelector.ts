import type { TestRun } from '../types/testRun'

export interface TestConfig {
  key: string // Unique identifier
  label: string // Display label
  block_size: string
  read_write_pattern: string
  queue_depth: number
  num_jobs: number | null
  direct: number | null
  sync: number | null
  duration: number
  count: number // Number of hosts with this config
}

export function useConfigSelector() {
  // Extract unique test configurations from test runs
  function extractUniqueConfigs(testRuns: TestRun[]): TestConfig[] {
    const configMap = new Map<string, TestConfig>()

    testRuns.forEach((run) => {
      const key = getConfigKey(run)

      if (!configMap.has(key)) {
        configMap.set(key, {
          key,
          label: getConfigLabel(run),
          block_size: run.block_size,
          read_write_pattern: run.read_write_pattern,
          queue_depth: run.queue_depth,
          num_jobs: run.num_jobs,
          direct: run.direct,
          sync: run.sync,
          duration: run.duration,
          count: 0
        })
      }

      // Increment count
      const config = configMap.get(key)!
      config.count++
    })

    // Convert to array and sort by popularity (most common configs first)
    return Array.from(configMap.values()).sort((a, b) => b.count - a.count)
  }

  // Get unique key for a configuration
  function getConfigKey(run: TestRun): string {
    return [
      run.block_size,
      run.read_write_pattern,
      run.queue_depth,
      run.num_jobs ?? 'null',
      run.direct ?? 'null',
      run.sync ?? 'null',
      run.duration
    ].join('|')
  }

  // Get display label for a configuration
  function getConfigLabel(run: TestRun): string {
    const parts = [
      run.block_size,
      run.read_write_pattern,
      `QD${run.queue_depth}`
    ]

    // Add optional details
    const details = []
    if (run.direct !== null) details.push(`direct=${run.direct}`)
    if (run.sync !== null) details.push(`sync=${run.sync}`)
    if (run.num_jobs !== null && run.num_jobs !== 1) details.push(`jobs=${run.num_jobs}`)
    if (run.duration !== 60) details.push(`${run.duration}s`)

    if (details.length > 0) {
      parts.push(`(${details.join(', ')})`)
    }

    return parts.join(' ')
  }

  // Filter test runs by configuration
  function filterByConfig(testRuns: TestRun[], configKey: string): TestRun[] {
    return testRuns.filter((run) => getConfigKey(run) === configKey)
  }

  // Get hosts that have a specific configuration
  function getHostsForConfig(testRuns: TestRun[], configKey: string): string[] {
    const hosts = new Set<string>()

    testRuns.forEach((run) => {
      if (getConfigKey(run) === configKey && run.hostname) {
        hosts.add(run.hostname)
      }
    })

    return Array.from(hosts).sort()
  }

  // Get test run for a specific host and config
  function getTestRun(testRuns: TestRun[], configKey: string, hostname: string): TestRun | null {
    return testRuns.find(
      (run) => getConfigKey(run) === configKey && run.hostname === hostname
    ) || null
  }

  return {
    extractUniqueConfigs,
    getConfigKey,
    getConfigLabel,
    filterByConfig,
    getHostsForConfig,
    getTestRun
  }
}
