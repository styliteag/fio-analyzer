/**
 * Color scheme utilities for Performance Graphs
 *
 * Provides consistent, accessible color palettes for chart visualization
 * with support for light and dark themes.
 */

import type { ThemeConfig } from '../types';

/**
 * Extended color palettes for various chart types
 */
export const COLOR_PALETTES = {
  light: {
    // Primary colors for main data series
    primary: [
      '#2563EB', // Blue
      '#059669', // Green
      '#D97706', // Orange
      '#DC2626', // Red
      '#7C3AED', // Purple
      '#DB2777', // Pink
      '#0891B2', // Cyan
      '#65A30D', // Lime
      '#C2410C', // Orange Red
      '#9333EA'  // Violet
    ],
    // Secondary colors for highlights/accents
    secondary: [
      '#60A5FA', // Light Blue
      '#34D399', // Light Green
      '#FBBF24', // Light Orange
      '#F87171', // Light Red
      '#A78BFA', // Light Purple
      '#F472B6', // Light Pink
      '#22D3EE', // Light Cyan
      '#A3E635', // Light Lime
      '#FB923C', // Light Orange Red
      '#C084FC'  // Light Violet
    ],
    // Background/fill colors with transparency
    background: [
      '#DBEAFE', // Blue bg
      '#D1FAE5', // Green bg
      '#FEF3C7', // Orange bg
      '#FEE2E2', // Red bg
      '#EDE9FE', // Purple bg
      '#FCE7F3', // Pink bg
      '#CFFAFE', // Cyan bg
      '#ECFCCB', // Lime bg
      '#FED7AA', // Orange Red bg
      '#E9D5FF'  // Violet bg
    ],
    // UI colors
    text: '#111827',
    grid: '#E5E7EB',
    gridSubtle: '#F3F4F6',
    surface: '#FFFFFF',
    border: '#D1D5DB'
  },
  dark: {
    // Primary colors for main data series (brighter for dark mode)
    primary: [
      '#3B82F6', // Blue
      '#10B981', // Green
      '#F59E0B', // Orange
      '#EF4444', // Red
      '#8B5CF6', // Purple
      '#EC4899', // Pink
      '#06B6D4', // Cyan
      '#84CC16', // Lime
      '#F97316', // Orange Red
      '#A855F7'  // Violet
    ],
    // Secondary colors for highlights/accents
    secondary: [
      '#1D4ED8', // Dark Blue
      '#047857', // Dark Green
      '#B45309', // Dark Orange
      '#B91C1C', // Dark Red
      '#6D28D9', // Dark Purple
      '#BE185D', // Dark Pink
      '#0E7490', // Dark Cyan
      '#4D7C0F', // Dark Lime
      '#C2410C', // Dark Orange Red
      '#7C2D12'  // Dark Violet
    ],
    // Background/fill colors with transparency
    background: [
      '#1E3A8A', // Blue bg
      '#064E3B', // Green bg
      '#78350F', // Orange bg
      '#7F1D1D', // Red bg
      '#581C87', // Purple bg
      '#9D174D', // Pink bg
      '#164E63', // Cyan bg
      '#365314', // Lime bg
      '#9A3412', // Orange Red bg
      '#6B21A8'  // Violet bg
    ],
    // UI colors
    text: '#F9FAFB',
    grid: '#374151',
    gridSubtle: '#4B5563',
    surface: '#1F2937',
    border: '#6B7280'
  }
};

/**
 * Specialized color schemes for different chart types
 */
export const CHART_TYPE_COLORS = {
  iops: {
    light: ['#2563EB', '#1D4ED8', '#1E40AF'], // Blues
    dark: ['#3B82F6', '#2563EB', '#1D4ED8']
  },
  latency: {
    light: ['#DC2626', '#B91C1C', '#991B1B'], // Reds
    dark: ['#EF4444', '#DC2626', '#B91C1C']
  },
  bandwidth: {
    light: ['#059669', '#047857', '#065F46'], // Greens
    dark: ['#10B981', '#059669', '#047857']
  },
  responsiveness: {
    light: ['#7C3AED', '#6D28D9', '#5B21B6'], // Purples
    dark: ['#8B5CF6', '#7C3AED', '#6D28D9']
  },
  mixed: {
    light: ['#2563EB', '#059669', '#D97706', '#DC2626'], // Blue, Green, Orange, Red
    dark: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444']
  }
};

/**
 * Performance tier colors for responsiveness visualization
 */
export const PERFORMANCE_TIERS = {
  excellent: { light: '#059669', dark: '#10B981' }, // Green
  good: { light: '#84CC16', dark: '#84CC16' },      // Lime
  average: { light: '#D97706', dark: '#F59E0B' },   // Orange
  poor: { light: '#DC2626', dark: '#EF4444' }       // Red
};

/**
 * Generate color palette for a specific number of series
 */
export const getColorPalette = (
  seriesCount: number,
  theme: ThemeConfig,
  chartType: 'iops' | 'latency' | 'bandwidth' | 'responsiveness' | 'mixed' = 'mixed'
): string[] => {
  const colors = theme.isDark ? COLOR_PALETTES.dark : COLOR_PALETTES.light;
  const specificColors = theme.isDark ? CHART_TYPE_COLORS[chartType].dark : CHART_TYPE_COLORS[chartType].light;

  // For small number of series, use chart-specific colors
  if (seriesCount <= specificColors.length && chartType !== 'mixed') {
    return specificColors.slice(0, seriesCount);
  }

  // For larger number of series or mixed charts, use full palette
  const palette: string[] = [];
  for (let i = 0; i < seriesCount; i++) {
    palette.push(colors.primary[i % colors.primary.length]);
  }

  return palette;
};

/**
 * Get performance tier color based on value and max
 */
export const getPerformanceTierColor = (value: number, max: number, isDark: boolean): string => {
  const ratio = max > 0 ? value / max : 0;
  const tiers = PERFORMANCE_TIERS;

  if (ratio >= 0.8) return isDark ? tiers.excellent.dark : tiers.excellent.light;
  if (ratio >= 0.6) return isDark ? tiers.good.dark : tiers.good.light;
  if (ratio >= 0.3) return isDark ? tiers.average.dark : tiers.average.light;
  return isDark ? tiers.poor.dark : tiers.poor.light;
};

/**
 * Generate gradient colors for area charts
 */
export const createGradientColors = (
  canvas: HTMLCanvasElement,
  baseColor: string,
  alpha: { start: number; end: number } = { start: 0.7, end: 0.1 }
): CanvasGradient => {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cannot get 2D context from canvas');

  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, `${baseColor}${Math.floor(alpha.start * 255).toString(16).padStart(2, '0')}`);
  gradient.addColorStop(1, `${baseColor}${Math.floor(alpha.end * 255).toString(16).padStart(2, '0')}`);

  return gradient;
};

/**
 * Convert hex color to RGB
 */
export const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

/**
 * Add alpha to hex color
 */
export const addAlphaToColor = (color: string, alpha: number): string => {
  const rgb = hexToRgb(color);
  if (!rgb) return color;

  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
};

/**
 * Generate accessible color combinations that meet WCAG contrast requirements
 */
export const getAccessibleColorPair = (
  backgroundColor: string,
  isDark: boolean
): { foreground: string; background: string } => {
  const colors = isDark ? COLOR_PALETTES.dark : COLOR_PALETTES.light;

  return {
    foreground: colors.text,
    background: backgroundColor
  };
};

/**
 * Color scheme specifically for multi-metric charts
 */
export const MULTI_METRIC_COLORS = {
  light: {
    iops: '#2563EB',      // Blue
    latency: '#DC2626',   // Red
    bandwidth: '#059669',  // Green
    responsiveness: '#7C3AED' // Purple
  },
  dark: {
    iops: '#3B82F6',      // Light Blue
    latency: '#EF4444',   // Light Red
    bandwidth: '#10B981',  // Light Green
    responsiveness: '#8B5CF6' // Light Purple
  }
};

/**
 * Get color for specific metrics in multi-metric charts
 */
export const getMetricColor = (
  metric: 'iops' | 'latency' | 'bandwidth' | 'responsiveness',
  isDark: boolean
): string => {
  return isDark ? MULTI_METRIC_COLORS.dark[metric] : MULTI_METRIC_COLORS.light[metric];
};

/**
 * Color scheme for pattern types
 */
export const PATTERN_COLORS = {
  light: {
    random_read: '#2563EB',     // Blue
    random_write: '#DC2626',    // Red
    sequential_read: '#059669',  // Green
    sequential_write: '#D97706'  // Orange
  },
  dark: {
    random_read: '#3B82F6',     // Light Blue
    random_write: '#EF4444',    // Light Red
    sequential_read: '#10B981',  // Light Green
    sequential_write: '#F59E0B'  // Light Orange
  }
};

/**
 * Get color for specific pattern types
 */
export const getPatternColor = (
  pattern: 'random_read' | 'random_write' | 'sequential_read' | 'sequential_write',
  isDark: boolean
): string => {
  return isDark ? PATTERN_COLORS.dark[pattern] : PATTERN_COLORS.light[pattern];
};