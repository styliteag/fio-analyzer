/**
 * useChartTheme Hook
 *
 * Custom hook for theme management and chart styling
 */

import { useMemo } from 'react';
import { useTheme } from '../../../../contexts/ThemeContext';
import type { ChartType, ThemeConfig, ChartConfig } from '../types';
import {
  createThemeConfig,
  getSeriesColor,
  generateChartOptions,
  getPerformanceOptimizedOptions
} from '../utils/chartConfig';
import { getColorPalette } from '../utils/colorSchemes';
import type { ChartOptions } from '../utils/chartConfig';

// Import icons (assuming they're available from lucide-react)
import { TrendingUp, Activity, BarChart, Zap } from 'lucide-react';

/**
 * Chart configuration definitions
 */
const CHART_CONFIGS: Record<ChartType, ChartConfig> = {
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

/**
 * Return type for useChartTheme hook
 */
export interface UseChartThemeReturn {
  theme: ThemeConfig;
  chartOptions: ChartOptions;
  getSeriesColor: (index: number) => string;
  getChartConfig: (chartType: ChartType) => ChartConfig;
  getColorPalette: (seriesCount: number, chartType?: 'iops' | 'latency' | 'bandwidth' | 'responsiveness' | 'mixed') => string[];
  isDark: boolean;
}

/**
 * Custom hook for chart theme management
 */
export const useChartTheme = (
  chartType: ChartType,
  _seriesCount: number = 1, // eslint-disable-line @typescript-eslint/no-unused-vars
  dataPointCount: number = 0
): UseChartThemeReturn => {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';

  // Create theme configuration
  const theme = useMemo(() => {
    return createThemeConfig(isDark);
  }, [isDark]);

  // Generate chart options with performance optimizations
  const chartOptions = useMemo(() => {
    const baseOptions = generateChartOptions(chartType, theme);

    // Apply performance optimizations for large datasets
    if (dataPointCount > 500) {
      const performanceOptions = getPerformanceOptimizedOptions(dataPointCount);
      return {
        ...baseOptions,
        ...performanceOptions,
        // Deep merge specific properties
        animation: {
          ...baseOptions.animation,
          ...performanceOptions.animation
        },
        elements: {
          ...baseOptions.elements,
          ...performanceOptions.elements,
          point: {
            radius: 4,
            hoverRadius: 6,
            ...baseOptions.elements?.point,
            ...performanceOptions.elements?.point
          },
          line: {
            tension: 0.1,
            ...baseOptions.elements?.line,
            ...performanceOptions.elements?.line
          }
        },
        plugins: {
          ...baseOptions.plugins,
          ...performanceOptions.plugins
        }
      };
    }

    return baseOptions;
  }, [chartType, theme, dataPointCount]);

  // Series color function
  const getSeriesColorFn = useMemo(() => {
    return (index: number) => getSeriesColor(index, theme);
  }, [theme]);

  // Chart config getter
  const getChartConfigFn = useMemo(() => {
    return (type: ChartType) => CHART_CONFIGS[type];
  }, []);

  // Color palette getter
  const getColorPaletteFn = useMemo(() => {
    return (
      count: number,
      type: 'iops' | 'latency' | 'bandwidth' | 'responsiveness' | 'mixed' = 'mixed'
    ) => getColorPalette(count, theme, type);
  }, [theme]);

  return {
    theme,
    chartOptions,
    getSeriesColor: getSeriesColorFn,
    getChartConfig: getChartConfigFn,
    getColorPalette: getColorPaletteFn,
    isDark
  };
};