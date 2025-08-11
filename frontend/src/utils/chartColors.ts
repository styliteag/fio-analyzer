/**
 * Simplified Chart Color System
 * 
 * This module provides a streamlined color management system that integrates
 * with the existing colorMapping utilities while reducing complexity.
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
 * Simplified chart color manager
 */
export class SimpleChartColorManager {
  private static instance: SimpleChartColorManager;
  private colorCache = new Map<string, string[]>();

  static getInstance(): SimpleChartColorManager {
    if (!SimpleChartColorManager.instance) {
      SimpleChartColorManager.instance = new SimpleChartColorManager();
    }
    return SimpleChartColorManager.instance;
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
   * Legacy compatibility method for getPrimaryColors
   */
  getPrimaryColors(count?: number): string[] {
    return this.getSchemeColors('primary', count);
  }

  /**
   * Get semantic colors based on data identifiers (uses existing colorMapping)
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
   * Get Chart.js color configuration for datasets (uses existing colorMapping)
   */
  getChartJsColors(items: ChartDataItem[]): ChartColorConfig[] {
    const cacheKey = JSON.stringify(items);
    
    if (this.colorCache.has(cacheKey)) {
      const colors = this.colorCache.get(cacheKey)!;
      return this.createColorConfigs(colors);
    }

    const chartJsColors = createChartJsColors(
      items.map(item => ({
        hostname: item.hostname || '',
        driveModel: item.driveModel,
        label: item.label
      }))
    );

    const colors = chartJsColors.map(c => c.borderColor);
    this.colorCache.set(cacheKey, colors);

    return chartJsColors.map(color => ({
      backgroundColor: color.backgroundColor,
      borderColor: color.borderColor,
      pointBackgroundColor: color.pointBackgroundColor,
      pointBorderColor: color.borderColor,
      hoverBackgroundColor: this.adjustOpacity(color.backgroundColor, 0.1),
      hoverBorderColor: color.borderColor,
    }));
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

    // For grouped data with multiple metrics, use qualitative colors
    if (grouped && metricsPerItem > 1) {
      const qualitativeColors = this.getSchemeColors('qualitative');
      const colors: string[] = [];
      
      for (let i = 0; i < items.length; i++) {
        const groupIndex = Math.floor(i / metricsPerItem);
        const metricIndex = i % metricsPerItem;
        const baseColor = qualitativeColors[groupIndex % qualitativeColors.length];
        
        // Use variations for different metrics within the same group
        colors.push(metricIndex === 0 ? baseColor : this.adjustOpacity(baseColor, 0.6 + (metricIndex * 0.2)));
      }
      
      return colors;
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
   * Helper methods (simplified)
   */
  private adjustOpacity(color: string, newOpacity: number): string {
    if (color.includes('rgba')) {
      return color.replace(/[\d.]+\)$/, `${newOpacity})`);
    }
    if (color.includes('rgb')) {
      return color.replace('rgb', 'rgba').replace(')', `, ${newOpacity})`);
    }
    return color;
  }

  private createColorConfigs(colors: string[]): ChartColorConfig[] {
    return colors.map(color => ({
      backgroundColor: this.adjustOpacity(color, 0.2),
      borderColor: color,
      pointBackgroundColor: color,
      pointBorderColor: color,
      hoverBackgroundColor: this.adjustOpacity(color, 0.3),
      hoverBorderColor: color,
    }));
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
export const chartColors = SimpleChartColorManager.getInstance();

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