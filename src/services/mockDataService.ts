import {
  TestRun,
  PerformanceData,
  FilterOptions,
  ChartTemplate,
} from "../types";

// Mock test runs with realistic FIO benchmark scenarios
export const mockTestRuns: TestRun[] = [
  {
    id: 1,
    timestamp: "2024-01-15T10:30:00Z",
    drive_model: "Samsung 980 PRO 1TB",
    drive_type: "NVMe SSD",
    test_name: "Random Read 4K",
    block_size: 4,
    read_write_pattern: "random_read",
    queue_depth: 32,
    duration: 300,
  },
  {
    id: 2,
    timestamp: "2024-01-15T11:00:00Z",
    drive_model: "Samsung 980 PRO 1TB",
    drive_type: "NVMe SSD",
    test_name: "Random Write 4K",
    block_size: 4,
    read_write_pattern: "random_write",
    queue_depth: 32,
    duration: 300,
  },
  {
    id: 3,
    timestamp: "2024-01-15T11:30:00Z",
    drive_model: "Samsung 980 PRO 1TB",
    drive_type: "NVMe SSD",
    test_name: "Sequential Read 1M",
    block_size: 1024,
    read_write_pattern: "sequential_read",
    queue_depth: 8,
    duration: 300,
  },
  {
    id: 4,
    timestamp: "2024-01-15T12:00:00Z",
    drive_model: "WD Black SN850X 1TB",
    drive_type: "NVMe SSD",
    test_name: "Random Read 4K",
    block_size: 4,
    read_write_pattern: "random_read",
    queue_depth: 32,
    duration: 300,
  },
  {
    id: 5,
    timestamp: "2024-01-15T12:30:00Z",
    drive_model: "WD Black SN850X 1TB",
    drive_type: "NVMe SSD",
    test_name: "Random Write 4K",
    block_size: 4,
    read_write_pattern: "random_write",
    queue_depth: 32,
    duration: 300,
  },
  {
    id: 6,
    timestamp: "2024-01-15T13:00:00Z",
    drive_model: "Crucial MX4 1TB",
    drive_type: "SATA SSD",
    test_name: "Random Read 4K",
    block_size: 4,
    read_write_pattern: "random_read",
    queue_depth: 32,
    duration: 300,
  },
  {
    id: 7,
    timestamp: "2024-01-15T13:30:00Z",
    drive_model: "Crucial MX4 1TB",
    drive_type: "SATA SSD",
    test_name: "Random Write 4K",
    block_size: 4,
    read_write_pattern: "random_write",
    queue_depth: 32,
    duration: 300,
  },
  {
    id: 8,
    timestamp: "2024-01-15T14:00:00Z",
    drive_model: "Seagate Barracuda 1TB",
    drive_type: "HDD",
    test_name: "Random Read 4K",
    block_size: 4,
    read_write_pattern: "random_read",
    queue_depth: 32,
    duration: 300,
  },
  {
    id: 9,
    timestamp: "2024-01-15T14:30:00Z",
    drive_model: "Seagate Barracuda 1TB",
    drive_type: "HDD",
    test_name: "Sequential Read 1M",
    block_size: 1024,
    read_write_pattern: "sequential_read",
    queue_depth: 8,
    duration: 300,
  },
  {
    id: 10,
    timestamp: "2024-01-15T15:00:00Z",
    drive_model: "Intel Optane 905P",
    drive_type: "NVMe SSD",
    test_name: "Random Read 4K",
    block_size: 4,
    read_write_pattern: "random_read",
    queue_depth: 64,
    duration: 300,
  },
];

// Mock filter options derived from test runs
export const mockFilters: FilterOptions = {
  drive_types: ["NVMe SSD", "SATA SSD", "HDD"],
  drive_models: [
    "Samsung 980 PRO 1TB",
    "WD Black SN850X 1TB",
    "Crucial MX4 1TB",
    "Seagate Barracuda 1TB",
    "Intel Optane 905P",
  ],
  patterns: [
    "random_read",
    "random_write",
    "sequential_read",
    "sequential_write",
  ],
  block_sizes: [4, 8, 16, 32, 64, 128, 256, 512, 1024],
};

// Generate realistic performance data based on drive type and test pattern
const generatePerformanceMetrics = (testRun: TestRun) => {
  const { drive_type, read_write_pattern, block_size, queue_depth } = testRun;

  let baseIOPS = 1000;
  let baseLatency = 10; // milliseconds
  let baseThroughput = 100; // MB/s

  // Drive type multipliers
  if (drive_type === "NVMe SSD") {
    baseIOPS *= 80;
    baseLatency *= 0.1;
    baseThroughput *= 35;
  } else if (drive_type === "SATA SSD") {
    baseIOPS *= 20;
    baseLatency *= 0.2;
    baseThroughput *= 6;
  } else if (drive_type === "HDD") {
    baseIOPS *= 0.1;
    baseLatency *= 10;
    baseThroughput *= 2;
  }

  // Pattern adjustments
  if (read_write_pattern.includes("write")) {
    baseIOPS *= 0.7;
    baseLatency *= 1.5;
    baseThroughput *= 0.8;
  }

  if (read_write_pattern.includes("sequential")) {
    baseIOPS *= 0.3;
    baseLatency *= 0.8;
    baseThroughput *= 3;
  }

  // Block size adjustments
  if (block_size >= 128) {
    baseIOPS *= 0.2;
    baseThroughput *= 2;
  }

  // Queue depth adjustments
  const qdMultiplier = Math.min(queue_depth / 32, 2);
  baseIOPS *= qdMultiplier;
  baseLatency *= 1 + (queue_depth - 1) * 0.1;

  // Add some randomness for realism
  const variance = 0.15;
  const randomize = (value: number) =>
    value * (1 + (Math.random() - 0.5) * variance);

  return {
    iops: {
      value: Math.round(randomize(baseIOPS)),
      unit: "ops/sec",
    },
    avg_latency: {
      value: parseFloat(randomize(baseLatency).toFixed(2)),
      unit: "ms",
    },
    p95_latency: {
      value: parseFloat((randomize(baseLatency) * 2.5).toFixed(2)),
      unit: "ms",
    },
    p99_latency: {
      value: parseFloat((randomize(baseLatency) * 4.2).toFixed(2)),
      unit: "ms",
    },
    throughput: {
      value: parseFloat(randomize(baseThroughput).toFixed(1)),
      unit: "MB/s",
    },
    cpu_usage: {
      value: parseFloat((Math.random() * 30 + 10).toFixed(1)),
      unit: "%",
    },
  };
};

// Generate performance data for selected test runs
export const generateMockPerformanceData = (
  testRunIds: number[],
): PerformanceData[] => {
  return testRunIds
    .map((id) => {
      const testRun = mockTestRuns.find((run) => run.id === id);
      if (!testRun) return null;

      return {
        id: testRun.id,
        drive_model: testRun.drive_model,
        drive_type: testRun.drive_type,
        test_name: testRun.test_name,
        block_size: testRun.block_size,
        read_write_pattern: testRun.read_write_pattern,
        timestamp: testRun.timestamp,
        queue_depth: testRun.queue_depth,
        metrics: generatePerformanceMetrics(testRun),
      };
    })
    .filter(Boolean) as PerformanceData[];
};

// Mock chart templates
export const mockChartTemplates: ChartTemplate[] = [
  {
    id: "iops-comparison",
    name: "IOPS Comparison",
    description: "Compare Input/Output Operations Per Second across drives",
    chartType: "bar",
    xAxis: "drive_model",
    yAxis: "iops",
    metrics: ["iops"],
  },
  {
    id: "latency-analysis",
    name: "Latency Analysis",
    description: "Analyze average and percentile latencies",
    chartType: "bar",
    xAxis: "drive_model",
    yAxis: "avg_latency",
    metrics: ["avg_latency", "p95_latency", "p99_latency"],
  },
  {
    id: "throughput-performance",
    name: "Throughput Performance",
    description: "Compare throughput across different drives",
    chartType: "bar",
    xAxis: "drive_model",
    yAxis: "throughput",
    metrics: ["throughput"],
  },
  {
    id: "performance-overview",
    name: "Performance Overview",
    description: "Complete overview of all key metrics",
    chartType: "line",
    xAxis: "test_name",
    yAxis: "iops",
    groupBy: "drive_model",
    metrics: ["iops", "avg_latency", "throughput"],
  },
];

// Simulate network delays for realism
export const simulateNetworkDelay = (
  minMs: number = 100,
  maxMs: number = 500,
): Promise<void> => {
  const delay = Math.random() * (maxMs - minMs) + minMs;
  return new Promise((resolve) => setTimeout(resolve, delay));
};
