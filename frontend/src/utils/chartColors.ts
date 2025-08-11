/**
 * Unified Chart Color System
 * 
 * This module provides a centralized color management system for all chart components.
 * It combines the existing chartConfig colors, semantic color mapping, and theme integration.
 */

import { chartConfig } from '../services/config/chartTemplates';
import { generateUniqueColorsForChart, createChartJsColors } from './colorMapping';

export type ColorScheme = 'primary' | 'secondary' | 'highContrast' | 'qualitative' | 'sequential' | 'diverging';
export type ColorIntensity = 'primary' | 'light' | 'dark';

/**
 * Interface for chart color configuration
 */
export interface ChartColorConfig {
  backgroundColor: string;
  borderColor: string;
  pointBackgroundColor?: string;
  pointBorderColor?: string;
  hoverBackgroundColor?: string;
  hoverBorderColor?: string;
}

/**
 * Interface for chart data item with color requirements
 */
export interface ChartDataItem {
  hostname?: string;
  driveModel?: string;
  identifier?: string;
  label?: string;
}

/**
 * Main chart color manager class
 */
export class ChartColorManager {
  private static instance: ChartColorManager;
  private colorCache = new Map<string, ChartColorConfig[]>();

  static getInstance(): ChartColorManager {
    if (!ChartColorManager.instance) {
      ChartColorManager.instance = new ChartColorManager();
    }
    return ChartColorManager.instance;
  }

  /**
   * Get colors from a specific scheme
   */
  getSchemeColors(scheme: ColorScheme, count?: number): string[] {
    let colors: string[];
    if (scheme === 'primary') {
      colors = chartConfig.colors.primary;
    } else if (scheme === 'secondary') {
      colors = chartConfig.colors.secondary;
    } else {
      colors = chartConfig.colors.schemes[scheme as keyof typeof chartConfig.colors.schemes] || chartConfig.colors.primary;
    }
    return count ? colors.slice(0, count) : colors;
  }

  /**
   * Get standard chart colors (primary scheme)
   */
  getPrimaryColors(count?: number): string[] {
    const colors = chartConfig.colors.primary;
    return count ? colors.slice(0, count) : colors;
  }

  /**
   * Get semantic colors based on data identifiers (hostnames, drive models)
   */
  getSemanticColors(items: ChartDataItem[], intensity: ColorIntensity = 'primary'): string[] {
    return generateUniqueColorsForChart(
      items.map(item => ({
        hostname: item.hostname || '',
        driveModel: item.driveModel,
        identifier: item.identifier
      })),
      intensity
    );
  }

  /**
   * Get Chart.js color configuration for datasets
   */
  getChartJsColors(items: ChartDataItem[]): ChartColorConfig[] {
    const cacheKey = JSON.stringify(items);
    
    if (this.colorCache.has(cacheKey)) {
      return this.colorCache.get(cacheKey)!;
    }

    const chartJsColors = createChartJsColors(
      items.map(item => ({
        hostname: item.hostname || '',
        driveModel: item.driveModel,
        label: item.label
      }))
    );

    const colorConfigs = chartJsColors.map(color => ({
      backgroundColor: color.backgroundColor,
      borderColor: color.borderColor,
      pointBackgroundColor: color.pointBackgroundColor,
      pointBorderColor: color.borderColor,
      hoverBackgroundColor: this.lightenColor(color.backgroundColor, 0.1),
      hoverBorderColor: this.darkenColor(color.borderColor, 0.1),
    }));

    this.colorCache.set(cacheKey, colorConfigs);
    return colorConfigs;
  }

  /**
   * Get adaptive colors - chooses best color strategy based on data characteristics
   */
  getAdaptiveColors(items: ChartDataItem[], options: {
    preferSemantic?: boolean;
    scheme?: ColorScheme;
    grouped?: boolean;
    metricsPerItem?: number;
  } = {}): string[] {
    const {
      preferSemantic = true,
      scheme = 'primary',
      grouped = false,
      metricsPerItem = 1
    } = options;

    // For grouped data with multiple metrics
    if (grouped && metricsPerItem > 1) {
      const groups = this.groupItems(items);
      const groupedColors = this.getGroupedColors(groups, metricsPerItem);
      return groupedColors.flatMap(g => g.colors);
    }

    // Prefer semantic colors if available and requested
    if (preferSemantic) {
      const hasSemanticData = items.some(item => 
        item.hostname || item.driveModel || item.identifier
      );
      
      if (hasSemanticData) {
        return this.getSemanticColors(items);
      }
    }

    // Fall back to scheme colors
    return this.getSchemeColors(scheme, items.length);
  }

  /**
   * Get colors for grouped data - ensures visual distinction between groups
   */
  getGroupedColors(
    groups: Array<{ name: string; items: ChartDataItem[] }>,
    metricsPerGroup: number = 1
  ): Array<{ groupName: string; colors: string[] }> {
    const qualitativeColors = this.getSchemeColors('qualitative');
    const result: Array<{ groupName: string; colors: string[] }> = [];
    
    groups.forEach((group, groupIndex) => {
      const baseColor = qualitativeColors[groupIndex % qualitativeColors.length];
      const colors: string[] = [];
      
      for (let metricIndex = 0; metricIndex < metricsPerGroup; metricIndex++) {
        if (metricIndex === 0) {
          colors.push(baseColor);
        } else {
          // Create variations for additional metrics in the same group
          const variation = this.createColorVariation(baseColor, metricIndex);
          colors.push(variation);
        }
      }
      
      result.push({ groupName: group.name, colors });
    });
    
    return result;
  }

  /**
   * Helper methods
   */
  private lightenColor(color: string, amount: number): string {
    if (color.includes('rgba')) {
      return color.replace(/[\d.]+\)$/, `${Math.min(1, parseFloat(color.match(/[\d.]+(?=\)$)/)?.[0] || '1') + amount)})`);
    }
    return color;
  }

  private darkenColor(color: string, amount: number): string {
    if (color.includes('rgba')) {
      return color.replace(/[\d.]+\)$/, `${Math.max(0, parseFloat(color.match(/[\d.]+(?=\)$)/)?.[0] || '1') - amount)})`);
    }
    return color;
  }

  private createColorVariation(baseColor: string, index: number): string {
    const variations = [
      baseColor,
      this.lightenColor(baseColor, 0.2),
      this.darkenColor(baseColor, 0.2),
      this.adjustHue(baseColor, 30),
      this.adjustHue(baseColor, -30),
    ];
    
    return variations[index % variations.length];
  }

  private adjustHue(color: string, degrees: number): string {
    // Parse color to RGB
    const rgb = this.parseColorToRgb(color);
    if (!rgb) return color;

    // Convert RGB to HSL
    const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);
    
    // Adjust hue
    hsl.h = (hsl.h + degrees / 360) % 1;
    if (hsl.h < 0) hsl.h += 1;
    
    // Convert back to RGB
    const newRgb = this.hslToRgb(hsl.h, hsl.s, hsl.l);
    
    // Return as rgba string
    return `rgba(${Math.round(newRgb.r)}, ${Math.round(newRgb.g)}, ${Math.round(newRgb.b)}, 1)`;
  }

  private parseColorToRgb(color: string): { r: number; g: number; b: number } | null {
    // Handle rgba format
    const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbaMatch) {
      return {
        r: parseInt(rgbaMatch[1]),
        g: parseInt(rgbaMatch[2]),
        b: parseInt(rgbaMatch[3])
      };
    }

    // Handle hex format
    const hexMatch = color.match(/^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (hexMatch) {
      return {
        r: parseInt(hexMatch[1], 16),
        g: parseInt(hexMatch[2], 16),
        b: parseInt(hexMatch[3], 16)
      };
    }

    return null;
  }

  private rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;
    
    let h = 0;
    const s = max === 0 ? 0 : diff / max;
    const l = (max + min) / 2;

    if (diff !== 0) {
      switch (max) {
        case r: h = ((g - b) / diff) % 6; break;
        case g: h = (b - r) / diff + 2; break;
        case b: h = (r - g) / diff + 4; break;
      }
      h /= 6;
    }

    return { h: h < 0 ? h + 1 : h, s, l };
  }

  private hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
    const m = l - c / 2;

    let r = 0, g = 0, b = 0;

    if (0 <= h && h < 1/6) {
      r = c; g = x; b = 0;
    } else if (1/6 <= h && h < 2/6) {
      r = x; g = c; b = 0;
    } else if (2/6 <= h && h < 3/6) {
      r = 0; g = c; b = x;
    } else if (3/6 <= h && h < 4/6) {
      r = 0; g = x; b = c;
    } else if (4/6 <= h && h < 5/6) {
      r = x; g = 0; b = c;
    } else if (5/6 <= h && h < 1) {
      r = c; g = 0; b = x;
    }

    return {
      r: (r + m) * 255,
      g: (g + m) * 255,
      b: (b + m) * 255
    };
  }

  private groupItems(items: ChartDataItem[]): Array<{ name: string; items: ChartDataItem[] }> {
    const groups = new Map<string, ChartDataItem[]>();
    
    items.forEach(item => {
      const groupKey = item.hostname || item.driveModel || 'default';
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(item);
    });
    
    return Array.from(groups.entries()).map(([name, items]) => ({ name, items }));
  }

  /**
   * Clear color cache
   */
  clearCache(): void {
    this.colorCache.clear();
  }
}

/**
 * Convenience functions for direct usage
 */
export const chartColors = ChartColorManager.getInstance();

export function getChartColors(
  items: ChartDataItem[],
  scheme: ColorScheme = 'primary'
): string[] {
  return chartColors.getAdaptiveColors(items, { scheme });
}

export function getSemanticChartColors(
  items: ChartDataItem[],
  intensity: ColorIntensity = 'primary'
): string[] {
  return chartColors.getSemanticColors(items, intensity);
}

export function getSchemeChartColors(
  scheme: ColorScheme,
  count?: number
): string[] {
  return chartColors.getSchemeColors(scheme, count);
}

export function getChartJsColorConfigs(
  items: ChartDataItem[]
): ChartColorConfig[] {
  return chartColors.getChartJsColors(items);
}

/**
 * Legacy compatibility - maps to existing chartConfig.colors
 */
export const legacyColors = {
  primary: chartConfig.colors.primary,
  secondary: chartConfig.colors.secondary,
  schemes: chartConfig.colors.schemes,
};