# Data Model: Frontend Visualization Features

**Date**: December 23, 2025
**Scope**: Vue frontend data structures for performance visualizations

## Overview

The frontend implements complex data transformations to support multiple visualization types without backend modifications. All data processing happens client-side using Vue 3 Composition API patterns.

## Core Entities

### PerformanceData
Raw performance metrics received from existing backend APIs.

**Fields**:
- `iops`: number - I/O operations per second
- `avg_latency`: number - Average latency in microseconds
- `bandwidth`: number - Data transfer rate in MB/s
- `block_size`: string - I/O block size (e.g., "4k", "64k")
- `read_write_pattern`: string - "random_read" | "random_write" | "sequential_read" | "sequential_write"
- `queue_depth`: number - I/O queue depth
- `num_jobs`: number - Number of parallel jobs
- `hostname`: string - Server hostname
- `drive_model`: string - Storage device model
- `protocol`: string - I/O protocol (e.g., "tcp", "rdma")
- `drive_type`: string - "ssd" | "hdd" | "nvme"
- `timestamp`: string - Test execution timestamp

**Validation Rules**:
- `iops`, `bandwidth` must be >= 0
- `avg_latency` must be > 0 when present
- `block_size` must match format: /^\d+[kmgt]?$/i
- `read_write_pattern` must be one of allowed values

### FilterState
Current user-selected filter criteria applied across all visualizations.

**Fields**:
- `selectedBlockSizes`: string[] - Active block size filters
- `selectedPatterns`: string[] - Active read/write pattern filters
- `selectedQueueDepths`: number[] - Active queue depth filters
- `selectedNumJobs`: number[] - Active job count filters
- `selectedProtocols`: string[] - Active protocol filters
- `selectedHostDiskCombinations`: string[] - Active host-disk combination filters

**Relationships**:
- Applied to `PerformanceData[]` to produce filtered datasets
- Shared across all visualization components

### VisualizationConfig
Settings for chart display and interaction behavior.

**Fields**:
- `chartType`: string - Active chart type ("graphs" | "heatmap" | "radar" | "scatter" | "parallel")
- `theme`: "light" | "dark" | "system" - UI theme preference
- `height`: number - Chart container height in pixels
- `responsive`: boolean - Whether charts should be responsive
- `animations`: boolean - Whether to enable chart animations

**Default Values**:
- `chartType`: "graphs"
- `theme`: "system"
- `height`: 400
- `responsive`: true
- `animations`: true

### ProcessedChartData
Transformed data structures optimized for specific chart types.

**Fields** (varies by chart type)**:
- `series`: ChartSeries[] - Data series for rendering
- `categories`: string[] - X-axis categories/labels
- `blockSizes`: string[] - Available block sizes for filtering
- `patterns`: string[] - Available patterns for filtering

**ChartSeries Structure**:
```typescript
interface ChartSeries {
  name: string           // Series label (e.g., "Host A - SSD")
  data: number[]         // Y-axis values
  color?: string         // Series color
  metadata?: object      // Additional series info
}
```

## Data Flow Patterns

### 1. Raw Data Ingestion
```
API Response → PerformanceData[] → Validation → Storage
```

### 2. Filtering Pipeline
```
PerformanceData[] + FilterState → FilteredData[] → Grouping → ChartData
```

### 3. Chart Transformation
```
FilteredData[] + ChartConfig → ProcessedChartData → Chart.js Rendering
```

## State Management

### Reactive Data Flow
```typescript
// Vue 3 Composition API pattern
const rawData = ref<PerformanceData[]>([])
const filters = ref<FilterState>(defaultFilters)
const chartConfig = ref<VisualizationConfig>(defaultConfig)

// Reactive transformations
const filteredData = computed(() =>
  applyFilters(rawData.value, filters.value)
)

const chartData = computed(() =>
  transformForChart(filteredData.value, chartConfig.value)
)
```

### Filter Synchronization
- Filters are shared across all visualization components
- Filter changes trigger re-computation of all dependent data
- Reset functionality clears all filters simultaneously

## Data Validation Rules

### Performance Metrics
- **IOPS**: Must be numeric, >= 0, finite
- **Latency**: Must be numeric, > 0, reasonable upper bound (< 1e6 μs)
- **Bandwidth**: Must be numeric, >= 0, finite
- **Queue Depth**: Must be integer, > 0, reasonable range (1-1024)

### Categorical Data
- **Block Sizes**: Must match regex pattern, sorted numerically
- **Patterns**: Must be from allowed enumeration
- **Hostnames**: Non-empty strings, reasonable length (< 256 chars)
- **Protocols**: From allowed protocol list

## Error Handling Data Structures

### ChartError
Error information for chart rendering failures.

**Fields**:
- `type`: "data" | "render" | "network" | "validation"
- `message`: string - User-friendly error message
- `details`: object - Technical error details for debugging
- `retryable`: boolean - Whether error can be retried

### PartialDataState
Information about partially loaded datasets.

**Fields**:
- `totalExpected`: number - Expected number of data points
- `loadedCount`: number - Successfully loaded count
- `failedRequests`: string[] - Failed API endpoint identifiers
- `canRenderPartial`: boolean - Whether partial data is usable

## Performance Considerations

### Data Volume Limits
- **Maximum Dataset Size**: 10,000 data points (from NFR-001)
- **Recommended Sampling**: >1,000 points → sample to 500 for scatter plots
- **Memory Budget**: < 50MB for processed chart data

### Computation Optimization
- Use `computed()` for reactive transformations
- Implement data caching for expensive operations
- Debounce filter changes to prevent excessive re-computation
- Use shallow refs for large datasets

## Migration Notes

### From React Implementation
- Maintain functional equivalence while adapting to Vue patterns
- Preserve data transformation logic from existing React components
- Adapt component communication patterns (props → provide/inject)
- Ensure same filtering behavior and performance characteristics

### API Contract Compatibility
- Work with existing backend response formats
- Handle API versioning gracefully
- Support both current and legacy response structures
- Implement client-side data normalization for format inconsistencies
