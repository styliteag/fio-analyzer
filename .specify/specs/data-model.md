# Data Model: Performance Graphs Visualization

## Overview

This document defines the TypeScript interfaces, data structures, and contracts required for the Performance Graphs visualization feature. All types are designed to ensure strict type safety and constitutional compliance.

## Core Interfaces

### Main Component Props

```typescript
interface PerformanceGraphsProps {
  drives: DriveAnalysis[];
}

interface PerformanceGraphsState {
  activeChart: ChartType;
  selectedMetrics: MetricType[];
  selectedPatterns: PatternType[];
  selectedHosts: string[];
  loading: boolean;
  error: string | null;
}
```

### Chart Configuration Types

```typescript
type ChartType = 'iops-comparison' | 'latency-analysis' | 'bandwidth-trends' | 'responsiveness';

type MetricType = 'iops' | 'avg_latency' | 'p95_latency' | 'p99_latency' | 'bandwidth' | 'responsiveness';

type PatternType = 'random_read' | 'random_write' | 'sequential_read' | 'sequential_write';

interface ChartConfig {
  type: ChartType;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  supportedMetrics: MetricType[];
  defaultMetrics: MetricType[];
}
```

### Chart Data Structures

```typescript
interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  tension?: number;
  fill?: boolean;
  pointRadius?: number;
  pointHoverRadius?: number;
}

interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

interface ProcessedChartData {
  iopsComparison: ChartData;
  latencyAnalysis: {
    avgLatency: ChartData;
    percentileLatency: ChartData;
  };
  bandwidthTrends: ChartData;
  responsiveness: ChartData;
}
```

### Data Processing Types

```typescript
interface DataPoint {
  hostname: string;
  driveModel: string;
  driveType: string;
  protocol: string;
  blockSize: string;
  pattern: PatternType;
  iops: number;
  avgLatency: number | null;
  p95Latency: number | null;
  p99Latency: number | null;
  bandwidth: number | null;
  responsiveness: number | null; // calculated as 1000 / avgLatency
  queueDepth: number;
  timestamp: string;
}

interface SeriesDefinition {
  id: string;
  hostname: string;
  driveModel: string;
  protocol: string;
  driveType: string;
  label: string;
  color: string;
  data: DataPoint[];
}

interface AggregatedData {
  blockSizes: string[];
  patterns: PatternType[];
  hosts: string[];
  series: SeriesDefinition[];
  maxValues: Record<MetricType, number>;
}
```

### Chart Options and Configuration

```typescript
interface ChartOptions {
  responsive: boolean;
  maintainAspectRatio: boolean;
  plugins: {
    title: {
      display: boolean;
      text: string;
    };
    legend: {
      display: boolean;
      position: 'top' | 'bottom' | 'left' | 'right';
      onClick?: (event: any, legendItem: any) => void;
    };
    tooltip: {
      enabled: boolean;
      mode: 'index' | 'dataset' | 'point' | 'nearest' | 'x' | 'y';
      intersect: boolean;
      callbacks: {
        title: (context: any[]) => string;
        label: (context: any) => string;
        footer?: (context: any[]) => string;
      };
    };
  };
  scales: {
    x: {
      display: boolean;
      title: {
        display: boolean;
        text: string;
      };
      grid: {
        color: string;
      };
    };
    y: {
      display: boolean;
      title: {
        display: boolean;
        text: string;
      };
      grid: {
        color: string;
      };
      beginAtZero?: boolean;
    };
    y1?: {
      type: 'linear';
      display: boolean;
      position: 'right';
      title: {
        display: boolean;
        text: string;
      };
      grid: {
        drawOnChartArea: boolean;
      };
    };
  };
  animation: {
    duration: number;
  };
  interaction: {
    mode: 'index' | 'dataset' | 'point' | 'nearest' | 'x' | 'y';
    intersect: boolean;
  };
}
```

### Theme Integration Types

```typescript
interface ChartTheme {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  gridColor: string;
  tooltipBackground: string;
  tooltipBorder: string;
  tooltipText: string;
}

interface ColorPalette {
  primary: string[];
  secondary: string[];
  accent: string[];
  gradient: {
    start: string;
    end: string;
  }[];
}

interface ThemeConfig {
  isDark: boolean;
  theme: ChartTheme;
  colors: ColorPalette;
}
```

### Filter and Control Types

```typescript
interface ChartFilters {
  selectedPatterns: PatternType[];
  selectedHosts: string[];
  selectedMetrics: MetricType[];
  selectedBlockSizes: string[];
}

interface ChartControls {
  filters: ChartFilters;
  onFilterChange: (filters: Partial<ChartFilters>) => void;
  onChartTypeChange: (chartType: ChartType) => void;
  onExport: (format: 'png' | 'csv') => void;
  onReset: () => void;
}
```

### Export Types

```typescript
interface ExportOptions {
  format: 'png' | 'csv';
  filename: string;
  width?: number;
  height?: number;
  backgroundColor?: string;
}

interface ExportData {
  chartType: ChartType;
  filters: ChartFilters;
  data: ChartData;
  metadata: {
    generatedAt: string;
    totalDataPoints: number;
    selectedHosts: string[];
    selectedPatterns: PatternType[];
  };
}
```

### Error Handling Types

```typescript
interface ChartError {
  type: 'data' | 'rendering' | 'export' | 'configuration';
  message: string;
  details?: any;
  timestamp: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: ChartError | null;
}
```

### Hook Types

```typescript
interface UseChartDataReturn {
  processedData: ProcessedChartData;
  aggregatedData: AggregatedData;
  loading: boolean;
  error: ChartError | null;
  refetch: () => void;
}

interface UseChartThemeReturn {
  theme: ThemeConfig;
  chartOptions: ChartOptions;
  getSeriesColor: (index: number) => string;
  getChartConfig: (chartType: ChartType) => ChartConfig;
}

interface UseChartExportReturn {
  exportChart: (options: ExportOptions) => Promise<void>;
  exportData: (options: ExportOptions) => Promise<void>;
  isExporting: boolean;
  exportError: string | null;
}
```

## Data Transformation Utilities

### Type Guards

```typescript
const isValidDataPoint = (point: any): point is DataPoint => {
  return (
    typeof point.hostname === 'string' &&
    typeof point.iops === 'number' &&
    point.iops >= 0 &&
    (point.avgLatency === null || typeof point.avgLatency === 'number')
  );
};

const isValidChartType = (type: string): type is ChartType => {
  return ['iops-comparison', 'latency-analysis', 'bandwidth-trends', 'responsiveness'].includes(type);
};
```

### Validation Functions

```typescript
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

const validateDriveAnalysis = (drives: DriveAnalysis[]): ValidationResult => {
  // Implementation validates data integrity
  // Returns detailed validation results
};

const validateChartData = (data: ChartData): ValidationResult => {
  // Implementation validates chart data structure
  // Ensures data completeness and consistency
};
```

## Constants and Defaults

```typescript
const DEFAULT_CHART_CONFIG: Record<ChartType, ChartConfig> = {
  'iops-comparison': {
    type: 'iops-comparison',
    title: 'IOPS Comparison',
    description: 'Compare IOPS performance across block sizes and test patterns',
    icon: TrendingUp,
    supportedMetrics: ['iops'],
    defaultMetrics: ['iops']
  },
  'latency-analysis': {
    type: 'latency-analysis',
    title: 'Latency Analysis',
    description: 'Analyze latency metrics including average and percentiles',
    icon: Activity,
    supportedMetrics: ['avg_latency', 'p95_latency', 'p99_latency'],
    defaultMetrics: ['avg_latency', 'p95_latency']
  },
  'bandwidth-trends': {
    type: 'bandwidth-trends',
    title: 'Bandwidth Trends',
    description: 'Visualize bandwidth performance trends',
    icon: BarChart,
    supportedMetrics: ['bandwidth'],
    defaultMetrics: ['bandwidth']
  },
  'responsiveness': {
    type: 'responsiveness',
    title: 'Responsiveness',
    description: 'Compare system responsiveness (1000/latency)',
    icon: Zap,
    supportedMetrics: ['responsiveness'],
    defaultMetrics: ['responsiveness']
  }
};

const DEFAULT_FILTERS: ChartFilters = {
  selectedPatterns: ['random_read', 'random_write', 'sequential_read', 'sequential_write'],
  selectedHosts: [],
  selectedMetrics: ['iops'],
  selectedBlockSizes: []
};

const CHART_COLORS = {
  light: {
    primary: ['#2563EB', '#059669', '#D97706', '#DC2626', '#7C3AED', '#DB2777'],
    secondary: ['#60A5FA', '#34D399', '#FBBF24', '#F87171', '#A78BFA', '#F472B6'],
    accent: ['#DBEAFE', '#D1FAE5', '#FEF3C7', '#FEE2E2', '#EDE9FE', '#FCE7F3']
  },
  dark: {
    primary: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'],
    secondary: ['#1D4ED8', '#047857', '#B45309', '#B91C1C', '#6D28D9', '#BE185D'],
    accent: ['#1E3A8A', '#064E3B', '#78350F', '#7F1D1D', '#581C87', '#9D174D']
  }
};
```

## Constitutional Compliance

This data model ensures compliance with all constitutional principles:

- ✅ **Type Safety and Data Integrity**: Strict TypeScript interfaces with validation
- ✅ **Performance-First Development**: Optimized data structures for chart rendering
- ✅ **Documentation and Observability**: Comprehensive error handling and logging types
- ✅ **Test Coverage and Quality Assurance**: Validation functions and type guards included

## Usage Examples

```typescript
// Component usage
const PerformanceGraphs: React.FC<PerformanceGraphsProps> = ({ drives }) => {
  const [activeChart, setActiveChart] = useState<ChartType>('iops-comparison');
  const [filters, setFilters] = useState<ChartFilters>(DEFAULT_FILTERS);

  // Hook usage examples will be provided in implementation
};

// Data processing example
const processedData: ProcessedChartData = transformDriveAnalysis(drives, filters);

// Theme integration example
const { theme, chartOptions } = useChartTheme(activeChart);
```

This data model provides a complete foundation for type-safe implementation of the Performance Graphs visualization feature.