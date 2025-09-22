# Quickstart Guide: Performance Graphs Visualization

## Overview

This guide provides step-by-step instructions for implementing and using the Performance Graphs visualization feature in the FIO Analyzer application.

## Prerequisites

### Development Environment
- Node.js 16+ with npm or yarn
- TypeScript 5.0+
- React 19.1.0+
- Chart.js 4.5.0 (already installed)
- React Chart.js 2 5.3.0 (already installed)

### Knowledge Requirements
- Familiarity with React TypeScript development
- Understanding of Chart.js configuration
- Basic knowledge of FIO Analyzer codebase structure

## Quick Start Implementation

### Step 1: Update Visualization Controls (5 minutes)

```bash
# Edit the visualization controls component
cd frontend/src/components/host/
```

**File**: `HostVisualizationControls.tsx`

```typescript
// Add to VisualizationView type
export type VisualizationView = 'overview' | 'heatmap' | 'graphs' | 'radar' | /* existing types */;

// Add new button after Performance Heatmap button
<Button
    variant={activeView === 'graphs' ? 'primary' : 'outline'}
    onClick={() => onViewChange('graphs')}
    className="flex items-center gap-2"
>
    <BarChart3 className="w-4 h-4" />
    Performance Graphs
</Button>
```

### Step 2: Create Main Component (15 minutes)

**File**: `frontend/src/components/host/PerformanceGraphs.tsx`

```typescript
import React, { useState } from 'react';
import type { DriveAnalysis } from '../../services/api/hostAnalysis';
import { useTheme } from '../../contexts/ThemeContext';

interface PerformanceGraphsProps {
  drives: DriveAnalysis[];
}

const PerformanceGraphs: React.FC<PerformanceGraphsProps> = ({ drives }) => {
  const { actualTheme } = useTheme();

  return (
    <div className="w-full space-y-6">
      <div className="mb-6">
        <h4 className="text-xl font-bold theme-text-primary mb-2">
          Performance Graphs
        </h4>
        <p className="text-sm theme-text-secondary mb-4">
          Interactive chart-based visualization of storage performance metrics.
        </p>
      </div>

      {/* Chart implementation will go here */}
      <div className="text-center py-8">
        <p className="theme-text-secondary">
          Charts will be implemented here - {drives.length} drives available
        </p>
      </div>
    </div>
  );
};

export default PerformanceGraphs;
```

### Step 3: Integrate with Host Component (2 minutes)

**File**: `frontend/src/pages/Host.tsx`

```typescript
// Add import
import PerformanceGraphs from '../components/host/PerformanceGraphs';

// Add to the visualization switch statement
{activeView === 'graphs' && (
    <PerformanceGraphs drives={filteredDrives} />
)}
```

### Step 4: Test Basic Integration (2 minutes)

```bash
# Start the development server
npm run dev

# Navigate to host analysis page
# Click "Performance Graphs" button
# Verify component loads without errors
```

## Full Implementation Roadmap

### Phase 1: Basic Chart Implementation (2-4 hours)

1. **IOPS Comparison Chart**
   - Line chart with Chart.js
   - Multiple series for different hosts
   - X-axis: Block sizes
   - Y-axis: IOPS values

2. **Chart Controls**
   - Chart type selector
   - Basic filtering options
   - Theme integration

### Phase 2: Advanced Charts (4-6 hours)

1. **Latency Analysis Chart**
   - Multi-axis line chart
   - Average, P95, P99 latency metrics
   - Interactive legend

2. **Bandwidth Trends Chart**
   - Area chart with stacking options
   - Read/write operation separation

3. **Responsiveness Chart**
   - Horizontal bar chart
   - Host comparison view

### Phase 3: Polish and Testing (2-3 hours)

1. **Export functionality**
2. **Accessibility improvements**
3. **Performance optimization**
4. **Unit and integration tests**

## Development Guidelines

### Code Organization

```
frontend/src/components/host/PerformanceGraphs/
├── index.tsx                    # Main component
├── components/
│   ├── IOPSComparisonChart.tsx
│   ├── LatencyAnalysisChart.tsx
│   ├── BandwidthTrendsChart.tsx
│   ├── ResponsivenessChart.tsx
│   └── ChartControls.tsx
├── hooks/
│   ├── useChartData.ts
│   ├── useChartTheme.ts
│   └── useChartExport.ts
├── utils/
│   ├── dataTransform.ts
│   ├── chartConfig.ts
│   └── colorSchemes.ts
└── types.ts
```

### TypeScript Best Practices

```typescript
// Always use strict typing
interface ComponentProps {
  data: DriveAnalysis[];
  onDataChange?: (data: ProcessedData) => void;
}

// Use proper error boundaries
const ChartWithErrorBoundary: React.FC<Props> = (props) => (
  <ErrorBoundary fallback={<ChartError />}>
    <Chart {...props} />
  </ErrorBoundary>
);

// Implement proper memoization
const processedData = useMemo(() =>
  transformData(drives, filters),
  [drives, filters]
);
```

### Performance Guidelines

```typescript
// Memoize expensive computations
const chartData = useMemo(() => ({
  labels: blockSizes,
  datasets: processDatasets(drives, theme)
}), [blockSizes, drives, theme]);

// Use React.memo for chart components
export const IOPSChart = React.memo<IOPSChartProps>(({ data, options }) => {
  return <Line data={data} options={options} />;
});

// Proper cleanup for Chart.js
useEffect(() => {
  return () => {
    if (chartRef.current) {
      chartRef.current.destroy();
    }
  };
}, []);
```

## Testing Strategy

### Unit Tests

```typescript
// Test data transformation utilities
describe('dataTransform', () => {
  test('should process DriveAnalysis correctly', () => {
    const mockDrives = [/* mock data */];
    const result = transformDriveAnalysis(mockDrives, defaultFilters);
    expect(result).toMatchSnapshot();
  });
});

// Test component rendering
describe('PerformanceGraphs', () => {
  test('should render with valid drives data', () => {
    render(<PerformanceGraphs drives={mockDrives} />);
    expect(screen.getByText('Performance Graphs')).toBeInTheDocument();
  });
});
```

### Integration Tests

```typescript
// Test with Host component
describe('Host Integration', () => {
  test('should display graphs when selected', async () => {
    render(<Host />);
    await user.click(screen.getByText('Performance Graphs'));
    expect(screen.getByText('Interactive chart-based')).toBeInTheDocument();
  });
});
```

## Common Issues and Solutions

### Issue 1: Chart Not Rendering

**Problem**: Chart appears blank or throws errors

**Solutions**:
```typescript
// Ensure data is properly structured
if (!data || !data.datasets || data.datasets.length === 0) {
  return <div>No data available</div>;
}

// Check Chart.js registration
import { Chart as ChartJS, registerables } from 'chart.js';
ChartJS.register(...registerables);
```

### Issue 2: Performance Issues

**Problem**: Slow rendering with large datasets

**Solutions**:
```typescript
// Implement data sampling
const sampleData = data.length > 1000
  ? data.filter((_, index) => index % Math.ceil(data.length / 1000) === 0)
  : data;

// Use chart decimation
options.parsing = false;
options.plugins.decimation = {
  enabled: true,
  algorithm: 'min-max-lt'
};
```

### Issue 3: Theme Integration Issues

**Problem**: Charts don't follow dark/light theme

**Solutions**:
```typescript
// Update chart options when theme changes
useEffect(() => {
  setChartOptions(generateChartOptions(chartType, theme));
}, [chartType, theme]);

// Use theme-aware colors
const getThemeColors = (isDark: boolean) => ({
  text: isDark ? '#F9FAFB' : '#111827',
  grid: isDark ? '#374151' : '#E5E7EB'
});
```

## Performance Monitoring

### Metrics to Track

```typescript
// Rendering performance
const startTime = performance.now();
// Chart rendering code
const renderTime = performance.now() - startTime;
console.log(`Chart rendered in ${renderTime}ms`);

// Memory usage monitoring
const observer = new PerformanceObserver((list) => {
  list.getEntries().forEach((entry) => {
    console.log(`${entry.name}: ${entry.duration}ms`);
  });
});
observer.observe({ entryTypes: ['measure'] });
```

## Deployment Checklist

- [ ] All TypeScript errors resolved
- [ ] ESLint warnings addressed
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Performance benchmarks met
- [ ] Accessibility requirements satisfied
- [ ] Dark/light theme compatibility verified
- [ ] Export functionality tested
- [ ] Mobile responsiveness confirmed
- [ ] Browser compatibility validated

## Next Steps

1. **Follow the tasks.md** for detailed implementation steps
2. **Review data-model.md** for complete type definitions
3. **Check component-interfaces.ts** for contractual requirements
4. **Implement constitutional compliance** as specified
5. **Add comprehensive testing** following the testing strategy

## Support and Resources

- **Codebase Documentation**: See existing chart components for patterns
- **Chart.js Documentation**: https://www.chartjs.org/docs/
- **React Chart.js 2**: https://react-chartjs-2.js.org/
- **TypeScript Guidelines**: Follow existing project patterns
- **Performance Testing**: Use browser dev tools and React DevTools

This quickstart guide provides a foundation for implementing the Performance Graphs visualization feature efficiently while maintaining code quality and constitutional compliance.