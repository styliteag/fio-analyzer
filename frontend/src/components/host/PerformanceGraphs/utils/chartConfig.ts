/**
 * Chart configuration utilities for Performance Graphs
 *
 * This module provides Chart.js configuration generation with theme integration,
 * responsive design, and accessibility features.
 */

import type { ChartType, ThemeConfig, ChartDataset } from '../types';
import { formatIOPS, formatBandwidth, formatLatency } from './dataTransform';

/**
 * Chart.js Options interface (simplified for our use case)
 */
export interface ChartOptions {
  responsive: boolean;
  maintainAspectRatio: boolean;
  plugins: {
    title: {
      display: boolean;
      text: string;
      font?: {
        size: number;
        weight: string;
      };
      color?: string;
    };
    legend: {
      display: boolean;
      position: 'top' | 'bottom' | 'left' | 'right';
      labels: {
        usePointStyle: boolean;
        padding: number;
        color: string;
        font: {
          size: number;
        };
      };
    };
    tooltip: {
      enabled: boolean;
      mode: 'index' | 'dataset' | 'point' | 'nearest' | 'x' | 'y';
      intersect: boolean;
      backgroundColor: string;
      titleColor: string;
      bodyColor: string;
      borderColor: string;
      borderWidth: number;
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
        color?: string;
        font?: {
          size: number;
        };
      };
      grid: {
        display: boolean;
        color: string;
      };
      ticks: {
        color: string;
      };
    };
    y: {
      display: boolean;
      title: {
        display: boolean;
        text: string;
        color?: string;
        font?: {
          size: number;
        };
      };
      grid: {
        display: boolean;
        color: string;
      };
      ticks: {
        color: string;
        callback?: (value: any) => string;
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
        color?: string;
      };
      grid: {
        drawOnChartArea: boolean;
      };
      ticks: {
        color: string;
      };
    };
  };
  animation: {
    duration: number;
    easing: 'linear' | 'easeInQuad' | 'easeOutQuad' | 'easeInOutQuad';
  };
  interaction: {
    mode: 'index' | 'dataset' | 'point' | 'nearest' | 'x' | 'y';
    intersect: boolean;
  };
  elements?: {
    point: {
      radius: number;
      hoverRadius: number;
    };
    line: {
      tension: number;
    };
  };
}

/**
 * Default color palettes for light and dark themes
 */
export const CHART_COLORS = {
  light: {
    primary: ['#2563EB', '#059669', '#D97706', '#DC2626', '#7C3AED', '#DB2777'],
    secondary: ['#60A5FA', '#34D399', '#FBBF24', '#F87171', '#A78BFA', '#F472B6'],
    accent: ['#DBEAFE', '#D1FAE5', '#FEF3C7', '#FEE2E2', '#EDE9FE', '#FCE7F3'],
    text: '#111827',
    grid: '#E5E7EB',
    surface: '#FFFFFF',
    tooltip: {
      background: '#1F2937',
      text: '#F9FAFB',
      border: '#374151'
    }
  },
  dark: {
    primary: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'],
    secondary: ['#1D4ED8', '#047857', '#B45309', '#B91C1C', '#6D28D9', '#BE185D'],
    accent: ['#1E3A8A', '#064E3B', '#78350F', '#7F1D1D', '#581C87', '#9D174D'],
    text: '#F9FAFB',
    grid: '#374151',
    surface: '#1F2937',
    tooltip: {
      background: '#374151',
      text: '#F9FAFB',
      border: '#6B7280'
    }
  }
};

/**
 * Create theme configuration
 */
export const createThemeConfig = (isDark: boolean): ThemeConfig => {
  const colors = isDark ? CHART_COLORS.dark : CHART_COLORS.light;

  return {
    isDark,
    theme: {
      backgroundColor: colors.surface,
      borderColor: colors.primary[0],
      textColor: colors.text,
      gridColor: colors.grid,
      tooltipBackground: colors.tooltip.background,
      tooltipBorder: colors.tooltip.border,
      tooltipText: colors.tooltip.text
    },
    colors: {
      primary: colors.primary,
      secondary: colors.secondary,
      accent: colors.accent
    }
  };
};

/**
 * Get color for series by index
 */
export const getSeriesColor = (index: number, theme: ThemeConfig): string => {
  const colors = theme.colors.primary;
  return colors[index % colors.length];
};

/**
 * Generate base chart options
 */
const generateBaseOptions = (
  title: string,
  theme: ThemeConfig,
  yAxisLabel: string,
  tooltipFormatter?: (context: any) => string
): ChartOptions => {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: title,
        font: {
          size: 16,
          weight: 'bold' as const
        },
        color: theme.theme.textColor
      },
      legend: {
        display: true,
        position: 'top',
        labels: {
          usePointStyle: true,
          padding: 15,
          color: theme.theme.textColor,
          font: {
            size: 12
          }
        }
      },
      tooltip: {
        enabled: true,
        mode: 'index',
        intersect: false,
        backgroundColor: theme.theme.tooltipBackground,
        titleColor: theme.theme.tooltipText,
        bodyColor: theme.theme.tooltipText,
        borderColor: theme.theme.tooltipBorder,
        borderWidth: 1,
        callbacks: {
          title: (context: any[]) => {
            return context[0]?.label || '';
          },
          label: (context: any) => {
            if (tooltipFormatter) {
              return tooltipFormatter(context);
            }
            return `${context.dataset.label}: ${context.parsed.y}`;
          }
        }
      }
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Block Size',
          color: theme.theme.textColor,
          font: {
            size: 12
          }
        },
        grid: {
          display: true,
          color: theme.theme.gridColor
        },
        ticks: {
          color: theme.theme.textColor
        }
      },
      y: {
        display: true,
        title: {
          display: true,
          text: yAxisLabel,
          color: theme.theme.textColor,
          font: {
            size: 12
          }
        },
        grid: {
          display: true,
          color: theme.theme.gridColor
        },
        ticks: {
          color: theme.theme.textColor
        },
        beginAtZero: true
      }
    },
    animation: {
      duration: 750,
      easing: 'easeInOutQuad'
    },
    interaction: {
      mode: 'index',
      intersect: false
    },
    elements: {
      point: {
        radius: 4,
        hoverRadius: 6
      },
      line: {
        tension: 0.1
      }
    }
  };
};

/**
 * Generate chart options for IOPS comparison
 */
export const generateIOPSComparisonOptions = (theme: ThemeConfig): ChartOptions => {
  return generateBaseOptions(
    'IOPS Performance Comparison',
    theme,
    'IOPS (Operations/Second)',
    (context: any) => {
      const value = context.parsed.y;
      return `${context.dataset.label}: ${formatIOPS(value)}`;
    }
  );
};

/**
 * Generate chart options for latency analysis
 */
export const generateLatencyAnalysisOptions = (theme: ThemeConfig): ChartOptions => {
  const options = generateBaseOptions(
    'Latency Analysis',
    theme,
    'Latency (ms)',
    (context: any) => {
      const value = context.parsed.y;
      return `${context.dataset.label}: ${formatLatency(value)}`;
    }
  );

  // Add second Y-axis for percentile latencies
  options.scales.y1 = {
    type: 'linear',
    display: true,
    position: 'right',
    title: {
      display: true,
      text: 'Percentile Latency (ms)',
      color: theme.theme.textColor
    },
    grid: {
      drawOnChartArea: false
    },
    ticks: {
      color: theme.theme.textColor
    }
  };

  return options;
};

/**
 * Generate chart options for bandwidth trends
 */
export const generateBandwidthTrendsOptions = (theme: ThemeConfig): ChartOptions => {
  return generateBaseOptions(
    'Bandwidth Performance Trends',
    theme,
    'Bandwidth (MB/s)',
    (context: any) => {
      const value = context.parsed.y;
      return `${context.dataset.label}: ${formatBandwidth(value)}`;
    }
  );
};

/**
 * Generate chart options for responsiveness
 */
export const generateResponsivenessOptions = (theme: ThemeConfig): ChartOptions => {
  const options = generateBaseOptions(
    'System Responsiveness Comparison',
    theme,
    'Responsiveness (ops/ms)',
    (context: any) => {
      const value = context.parsed.y;
      return `${context.dataset.label}: ${value.toFixed(1)} ops/ms`;
    }
  );

  // Modify for horizontal bar chart layout
  options.scales.x.title.text = 'Responsiveness (ops/ms)';
  options.scales.y.title.text = 'Host Configuration';

  return options;
};

/**
 * Generate chart options by chart type
 */
export const generateChartOptions = (
  chartType: ChartType,
  theme: ThemeConfig,
  customOptions?: Partial<ChartOptions>
): ChartOptions => {
  let baseOptions: ChartOptions;

  switch (chartType) {
    case 'iops-comparison':
      baseOptions = generateIOPSComparisonOptions(theme);
      break;
    case 'latency-analysis':
      baseOptions = generateLatencyAnalysisOptions(theme);
      break;
    case 'bandwidth-trends':
      baseOptions = generateBandwidthTrendsOptions(theme);
      break;
    case 'responsiveness':
      baseOptions = generateResponsivenessOptions(theme);
      break;
    default:
      baseOptions = generateBaseOptions('Performance Chart', theme, 'Value');
  }

  // Merge custom options if provided
  if (customOptions) {
    return mergeChartOptions(baseOptions, customOptions);
  }

  return baseOptions;
};

/**
 * Deep merge chart options
 */
const mergeChartOptions = (base: ChartOptions, custom: Partial<ChartOptions>): ChartOptions => {
  const merged = { ...base };

  Object.keys(custom).forEach(key => {
    const customValue = (custom as any)[key];
    if (customValue && typeof customValue === 'object' && !Array.isArray(customValue)) {
      (merged as any)[key] = { ...(merged as any)[key], ...customValue };
    } else {
      (merged as any)[key] = customValue;
    }
  });

  return merged;
};

/**
 * Create dataset with theme-appropriate styling
 */
export const createDataset = (
  data: number[],
  label: string,
  colorIndex: number,
  theme: ThemeConfig,
  chartType: ChartType = 'iops-comparison'
): ChartDataset => {
  const primaryColor = getSeriesColor(colorIndex, theme);
  const secondaryColor = theme.colors.secondary[colorIndex % theme.colors.secondary.length];

  const baseDataset: ChartDataset = {
    label,
    data,
    backgroundColor: chartType === 'bandwidth-trends' ? `${primaryColor}33` : primaryColor,
    borderColor: primaryColor,
    borderWidth: 2
  };

  // Chart-specific styling
  switch (chartType) {
    case 'iops-comparison':
    case 'latency-analysis':
      return {
        ...baseDataset,
        fill: false,
        tension: 0.1,
        pointRadius: 4,
        pointHoverRadius: 6
      };

    case 'bandwidth-trends':
      return {
        ...baseDataset,
        fill: true,
        tension: 0.2,
        pointRadius: 3,
        pointHoverRadius: 5
      };

    case 'responsiveness':
      return {
        ...baseDataset,
        backgroundColor: primaryColor,
        borderColor: secondaryColor,
        borderWidth: 1
      };

    default:
      return baseDataset;
  }
};

/**
 * Get accessibility configuration for charts
 */
export const getAccessibilityConfig = (): any => {
  return {
    // Chart.js accessibility plugin configuration
    accessibility: {
      enabled: true,
      announceNewData: {
        enabled: true
      }
    }
  };
};

/**
 * Performance-optimized chart options for large datasets
 */
export const getPerformanceOptimizedOptions = (dataPointCount: number): Partial<ChartOptions> => {
  const isLargeDataset = dataPointCount > 500;

  return {
    animation: {
      duration: isLargeDataset ? 0 : 750,
      easing: 'linear'
    },
    elements: {
      point: {
        radius: isLargeDataset ? 1 : 4,
        hoverRadius: isLargeDataset ? 3 : 6
      },
      line: {
        tension: isLargeDataset ? 0 : 0.1
      }
    },
    plugins: {
      tooltip: {
        enabled: true,
        mode: isLargeDataset ? 'point' : 'index',
        intersect: isLargeDataset,
        callbacks: {
          title: () => '',
          label: (context: any) => `${context.dataset.label}: ${context.parsed.y}`
        }
      } as any
    } as any
  };
};