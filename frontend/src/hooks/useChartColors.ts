/**
 * React hook for accessing unified chart colors
 */

import { useMemo } from 'react';
import { 
  chartColors, 
  getChartColors, 
  getSemanticChartColors, 
  getSchemeChartColors,
  getChartJsColorConfigs,
  type ChartColorConfig,
  type ChartDataItem,
  type ColorScheme,
  type ColorIntensity
} from '../utils/chartColors';
import { useThemeColors } from './useThemeColors';

export interface UseChartColorsOptions {
  scheme?: ColorScheme;
  intensity?: ColorIntensity;
  preferSemantic?: boolean;
  grouped?: boolean;
  metricsPerItem?: number;
}

export interface UseChartColorsResult {
  getColors: (items: ChartDataItem[], options?: UseChartColorsOptions) => string[];
  getSemanticColors: (items: ChartDataItem[], intensity?: ColorIntensity) => string[];
  getSchemeColors: (scheme: ColorScheme, count?: number) => string[];
  getChartJsConfigs: (items: ChartDataItem[]) => ChartColorConfig[];
  primaryColors: string[];
  secondaryColors: string[];
  qualitativeColors: string[];
  highContrastColors: string[];
  themeColors: ReturnType<typeof useThemeColors>;
  clearCache: () => void;
}

/**
 * Hook for unified chart color management
 */
export const useChartColors = (defaultOptions: UseChartColorsOptions = {}): UseChartColorsResult => {
  const themeColors = useThemeColors();

  const colorFunctions = useMemo(() => ({
    getColors: (items: ChartDataItem[], options: UseChartColorsOptions = {}) => {
      const mergedOptions = { ...defaultOptions, ...options };
      return getChartColors(items, mergedOptions.scheme);
    },

    getSemanticColors: (items: ChartDataItem[], intensity: ColorIntensity = 'primary') => {
      return getSemanticChartColors(items, intensity);
    },

    getSchemeColors: (scheme: ColorScheme, count?: number) => {
      return getSchemeChartColors(scheme, count);
    },

    getChartJsConfigs: (items: ChartDataItem[]) => {
      return getChartJsColorConfigs(items);
    },

    clearCache: () => {
      chartColors.clearCache();
    }
  }), [defaultOptions]);

  const predefinedColors = useMemo(() => ({
    primaryColors: chartColors.getPrimaryColors(),
    secondaryColors: chartColors.getSchemeColors('secondary'),
    qualitativeColors: chartColors.getSchemeColors('qualitative'),
    highContrastColors: chartColors.getSchemeColors('highContrast'),
  }), []);

  return {
    ...colorFunctions,
    ...predefinedColors,
    themeColors,
  };
};

export const useSemanticChartColors = (
  items: ChartDataItem[],
  intensity: ColorIntensity = 'primary'
) => {
  return useMemo(() => {
    return getSemanticChartColors(items, intensity);
  }, [items, intensity]);
};

export const useSchemeChartColors = (
  scheme: ColorScheme,
  count?: number
) => {
  return useMemo(() => {
    return getSchemeChartColors(scheme, count);
  }, [scheme, count]);
};

export const useChartJsColors = (items: ChartDataItem[]) => {
  return useMemo(() => {
    return getChartJsColorConfigs(items);
  }, [items]);
};

export const useAdaptiveChartColors = (
  items: ChartDataItem[],
  options: UseChartColorsOptions = {}
) => {
  return useMemo(() => {
    return chartColors.getAdaptiveColors(items, {
      preferSemantic: options.preferSemantic ?? true,
      scheme: options.scheme ?? 'primary',
      grouped: options.grouped ?? false,
      metricsPerItem: options.metricsPerItem ?? 1
    });
  }, [items, options]);
};