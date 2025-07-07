import type { PerformanceData } from '../types';

export interface Configuration {
  id: string;
  block_size: string | number;
  read_write_pattern: string;
  queue_depth: number;
  direct: number;
  sync: number;
  num_jobs: number;
  test_size: string;
  duration: number;
}

export interface ConfigurationGroup {
  config: Configuration;
  runs: PerformanceData[];
  hostCount: number;
  hosts: string[];
}

export interface HostComparisonData {
  hostname: string;
  run: PerformanceData;
  metrics: {
    iops?: number;
    bandwidth?: number;
    p95_latency?: number;
    p99_latency?: number;
    avg_latency?: number;
  };
}

export interface ConfigurationComparison {
  config: Configuration;
  hostData: HostComparisonData[];
  hasAllHosts: boolean;
  coverage: number; // percentage of selected hosts that have this config
}

export function createConfigurationId(run: PerformanceData): string {
  return [
    run.block_size,
    run.read_write_pattern,
    run.queue_depth,
    (run as any).direct || 0,
    (run as any).sync || 0,
    (run as any).num_jobs || 1,
    (run as any).test_size || 'unknown',
    (run as any).duration || 0
  ].join('|');
}

export function extractConfiguration(run: PerformanceData): Configuration {
  return {
    id: createConfigurationId(run),
    block_size: run.block_size,
    read_write_pattern: run.read_write_pattern,
    queue_depth: run.queue_depth,
    direct: (run as any).direct || 0,
    sync: (run as any).sync || 0,
    num_jobs: (run as any).num_jobs || 1,
    test_size: (run as any).test_size || 'unknown',
    duration: (run as any).duration || 0
  };
}

export function groupRunsByConfiguration(runs: PerformanceData[]): ConfigurationGroup[] {
  const configMap = new Map<string, ConfigurationGroup>();

  for (const run of runs) {
    const config = extractConfiguration(run);
    const configId = config.id;

    if (!configMap.has(configId)) {
      configMap.set(configId, {
        config,
        runs: [],
        hostCount: 0,
        hosts: []
      });
    }

    const group = configMap.get(configId)!;
    group.runs.push(run);
    
    const hostname = run.hostname || 'unknown';
    if (!group.hosts.includes(hostname)) {
      group.hosts.push(hostname);
      group.hostCount++;
    }
  }

  return Array.from(configMap.values()).sort((a, b) => b.hostCount - a.hostCount);
}

export function createComparableConfigurations(
  runs: PerformanceData[], 
  selectedHostHardwareCombinations: number,
  minHostCoverage: number = 0.3 // At least 30% of hosts must have this configuration
): ConfigurationComparison[] {
  const groups = groupRunsByConfiguration(runs);
  const comparisons: ConfigurationComparison[] = [];

  for (const group of groups) {
    const hostData: HostComparisonData[] = [];
    
    // Use the actual runs from the group instead of trying to find by hostname
    // This ensures we get the exact runs that were filtered for specific hardware
    for (const run of group.runs) {
      hostData.push({
        hostname: run.hostname || 'unknown',
        run,
        metrics: {
          iops: run.metrics.iops?.value,
          bandwidth: run.metrics.bandwidth?.value,
          p95_latency: run.metrics.p95_latency?.value,
          p99_latency: run.metrics.p99_latency?.value,
          avg_latency: run.metrics.avg_latency?.value
        }
      });
    }

    // Calculate coverage based on the number of host-hardware combinations that have this config
    const coverage = hostData.length / selectedHostHardwareCombinations;
    
    // Skip configs that don't meet minimum coverage
    if (coverage < minHostCoverage) continue;

    if (hostData.length >= 2) { // Need at least 2 hosts to compare
      comparisons.push({
        config: group.config,
        hostData,
        hasAllHosts: hostData.length === selectedHostHardwareCombinations,
        coverage
      });
    }
  }

  return comparisons.sort((a, b) => {
    // Sort by coverage first, then by number of hosts
    if (b.coverage !== a.coverage) return b.coverage - a.coverage;
    return b.hostData.length - a.hostData.length;
  });
}

export function formatConfigurationLabel(config: Configuration): string {
  const parts = [
    `${config.block_size}`,
    config.read_write_pattern,
    `QD${config.queue_depth}`,
    config.direct === 1 ? 'Direct' : null,
    config.sync === 1 ? 'Sync' : null,
    config.num_jobs > 1 ? `${config.num_jobs} jobs` : null,
    config.test_size !== 'unknown' ? config.test_size : null,
    config.duration > 0 ? `${config.duration}s` : null
  ].filter(Boolean);

  return parts.join(' | ');
}

export function getConfigurationSummary(config: Configuration): {
  primary: string;
  secondary: string;
} {
  return {
    primary: `${config.block_size} ${config.read_write_pattern} QD${config.queue_depth}`,
    secondary: [
      config.direct === 1 ? 'Direct' : null,
      config.sync === 1 ? 'Sync' : null,
      config.num_jobs > 1 ? `${config.num_jobs} jobs` : null,
      config.test_size !== 'unknown' ? config.test_size : null,
      config.duration > 0 ? `${config.duration}s` : null
    ].filter(Boolean).join(', ') || 'Standard'
  };
}