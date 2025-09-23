/**
 * Theme Composables
 * Vue 3 composition API functions for theme management
 */

import { computed, readonly } from 'vue'
import { useTheme as useThemeContext, type ThemeType, type ActualThemeType, type ThemeContextType } from '@/contexts/ThemeContext'

// Re-export the main theme context
export { useThemeContext }

// Main theme composable - alias for useThemeContext
export const useTheme = (): ThemeContextType => {
  return useThemeContext()
}

// Specialized theme composables for specific use cases

/**
 * Theme-aware class binding composable
 * Returns classes that change based on current theme
 */
export const useThemeClasses = () => {
  const { actualTheme, isDark, isLight } = useTheme()

  const themeClasses = computed(() => ({
    // Background colors
    'bg-light': isLight.value,
    'bg-dark': isDark.value,
    'bg-white': isLight.value,
    'bg-gray-900': isDark.value,

    // Text colors
    'text-gray-900': isLight.value,
    'text-gray-100': isDark.value,
    'text-gray-700': isLight.value,
    'text-gray-300': isDark.value,

    // Border colors
    'border-gray-200': isLight.value,
    'border-gray-700': isDark.value,

    // Shadow colors
    'shadow-gray-200': isLight.value,
    'shadow-gray-800': isDark.value,
  }))

  const getThemeClass = (lightClass: string, darkClass: string): string => {
    return isDark.value ? darkClass : lightClass
  }

  const getConditionalClasses = (condition: boolean, trueClasses: string, falseClasses: string = ''): string => {
    return condition ? trueClasses : falseClasses
  }

  return {
    themeClasses: readonly(themeClasses),
    getThemeClass,
    getConditionalClasses,
    actualTheme: readonly(actualTheme),
    isDark: readonly(isDark),
    isLight: readonly(isLight)
  }
}

/**
 * Theme-aware color palette composable
 * Returns color values that adapt to the current theme
 */
export const useThemeColors = () => {
  const { actualTheme, isDark } = useTheme()

  const colors = computed(() => ({
    primary: isDark.value ? '#60a5fa' : '#3b82f6', // blue-400 : blue-500
    secondary: isDark.value ? '#9ca3af' : '#6b7280', // gray-400 : gray-500
    success: isDark.value ? '#34d399' : '#10b981', // emerald-400 : emerald-500
    warning: isDark.value ? '#fbbf24' : '#f59e0b', // amber-400 : amber-500
    error: isDark.value ? '#f87171' : '#ef4444', // red-400 : red-500

    // Background colors
    background: isDark.value ? '#111827' : '#ffffff', // gray-900 : white
    surface: isDark.value ? '#1f2937' : '#f9fafb', // gray-800 : gray-50
    card: isDark.value ? '#374151' : '#ffffff', // gray-700 : white

    // Text colors
    text: isDark.value ? '#f9fafb' : '#111827', // gray-50 : gray-900
    textSecondary: isDark.value ? '#d1d5db' : '#6b7280', // gray-300 : gray-500

    // Border colors
    border: isDark.value ? '#4b5563' : '#e5e7eb', // gray-600 : gray-200
    borderLight: isDark.value ? '#6b7280' : '#d1d5db', // gray-500 : gray-300
  }))

  const getColor = (colorName: keyof typeof colors.value): string => {
    return colors.value[colorName]
  }

  const getRgbColor = (colorName: keyof typeof colors.value): string => {
    const hex = colors.value[colorName]
    // Convert hex to rgb (simplified - assumes 6-digit hex)
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `${r}, ${g}, ${b}`
  }

  return {
    colors: readonly(colors),
    getColor,
    getRgbColor,
    actualTheme: readonly(actualTheme),
    isDark: readonly(isDark)
  }
}

/**
 * Chart theme composable
 * Provides theme-aware chart colors and options
 */
export const useChartTheme = () => {
  const { actualTheme, isDark } = useTheme()

  const chartColors = computed(() => ({
    // Chart.js color palette
    backgroundColors: isDark.value
      ? [
          'rgba(96, 165, 250, 0.8)',   // blue-400
          'rgba(244, 114, 182, 0.8)',  // pink-400
          'rgba(52, 211, 153, 0.8)',   // emerald-400
          'rgba(251, 191, 36, 0.8)',   // amber-400
          'rgba(139, 92, 246, 0.8)',   // violet-400
          'rgba(20, 184, 166, 0.8)',   // teal-400
        ]
      : [
          'rgba(59, 130, 246, 0.8)',   // blue-500
          'rgba(236, 72, 153, 0.8)',   // pink-500
          'rgba(16, 185, 129, 0.8)',   // emerald-500
          'rgba(245, 158, 11, 0.8)',   // amber-500
          'rgba(124, 58, 237, 0.8)',   // violet-500
          'rgba(6, 182, 212, 0.8)',    // cyan-500
        ],

    borderColors: isDark.value
      ? [
          '#60a5fa', // blue-400
          '#f472b6', // pink-400
          '#34d399', // emerald-400
          '#fbbf24', // amber-400
          '#8b5cf6', // violet-400
          '#14b8a6', // teal-400
        ]
      : [
          '#3b82f6', // blue-500
          '#ec4899', // pink-500
          '#10b981', // emerald-500
          '#f59e0b', // amber-500
          '#7c3aed', // violet-500
          '#06b6d4', // cyan-500
        ],

    // Grid and text colors for dark/light themes
    gridColor: isDark.value ? '#374151' : '#e5e7eb', // gray-700 : gray-200
    textColor: isDark.value ? '#d1d5db' : '#6b7280', // gray-300 : gray-500
  }))

  const chartOptions = computed(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: chartColors.value.textColor,
          font: {
            size: 12
          }
        }
      },
      tooltip: {
        backgroundColor: isDark.value ? 'rgba(31, 41, 55, 0.9)' : 'rgba(255, 255, 255, 0.9)',
        titleColor: isDark.value ? '#f9fafb' : '#1f2937',
        bodyColor: isDark.value ? '#d1d5db' : '#374151',
        borderColor: isDark.value ? '#4b5563' : '#d1d5db',
        borderWidth: 1
      }
    },
    scales: {
      x: {
        ticks: {
          color: chartColors.value.textColor
        },
        grid: {
          color: chartColors.value.gridColor
        }
      },
      y: {
        ticks: {
          color: chartColors.value.textColor
        },
        grid: {
          color: chartColors.value.gridColor
        }
      }
    }
  }))

  return {
    chartColors: readonly(chartColors),
    chartOptions: readonly(chartOptions),
    actualTheme: readonly(actualTheme),
    isDark: readonly(isDark)
  }
}

/**
 * Theme transition composable
 * Provides smooth transitions when theme changes
 */
export const useThemeTransitions = () => {
  const { actualTheme } = useTheme()

  const applyThemeTransition = (element: HTMLElement, duration: number = 300) => {
    element.style.transition = `background-color ${duration}ms ease, color ${duration}ms ease, border-color ${duration}ms ease`
  }

  const removeThemeTransition = (element: HTMLElement) => {
    element.style.transition = ''
  }

  const withThemeTransition = <T>(callback: () => T, duration: number = 300): T => {
    const elements = document.querySelectorAll('[data-theme-transition]')
    elements.forEach(el => applyThemeTransition(el as HTMLElement, duration))

    const result = callback()

    // Remove transitions after animation completes
    setTimeout(() => {
      elements.forEach(el => removeThemeTransition(el as HTMLElement))
    }, duration)

    return result
  }

  return {
    applyThemeTransition,
    removeThemeTransition,
    withThemeTransition,
    actualTheme: readonly(actualTheme)
  }
}

// Export types
export type { ThemeType, ActualThemeType, ThemeContextType }
