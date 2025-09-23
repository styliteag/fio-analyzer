/**
 * Theme Context and Provider
 * Manages application theme state (light/dark/system) across Vue components
 */

import { ref, computed, readonly, watch, onMounted } from 'vue'
import type { Ref, ComputedRef } from 'vue'

export type ThemeType = 'light' | 'dark' | 'system'
export type ActualThemeType = 'light' | 'dark'

export interface ThemeContextType {
  theme: Readonly<Ref<ThemeType>>
  actualTheme: Readonly<ComputedRef<ActualThemeType>>
  setTheme: (theme: ThemeType) => void
  toggleTheme: () => void
  isDark: ComputedRef<boolean>
  isLight: ComputedRef<boolean>
  isSystem: ComputedRef<boolean>
}

// Theme persistence key
const THEME_STORAGE_KEY = 'fio-analyzer-theme'

// Default theme
const DEFAULT_THEME: ThemeType = 'system'

// Reactive theme state
const theme = ref<ThemeType>(DEFAULT_THEME)

// Computed properties
const actualTheme = computed<ActualThemeType>(() => {
  if (theme.value === 'system') {
    // Check system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return theme.value
})

const isDark = computed(() => actualTheme.value === 'dark')
const isLight = computed(() => actualTheme.value === 'light')
const isSystem = computed(() => theme.value === 'system')

// Methods
const setTheme = (newTheme: ThemeType) => {
  theme.value = newTheme
  saveThemeToStorage(newTheme)
  applyThemeToDocument(newTheme)
}

const toggleTheme = () => {
  // Cycle through themes: light -> dark -> system -> light
  const themeOrder: ThemeType[] = ['light', 'dark', 'system']
  const currentIndex = themeOrder.indexOf(theme.value)
  const nextIndex = (currentIndex + 1) % themeOrder.length
  setTheme(themeOrder[nextIndex])
}

// Storage utilities
const saveThemeToStorage = (themeToSave: ThemeType) => {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, themeToSave)
  } catch (error) {
    console.warn('Failed to save theme to localStorage:', error)
  }
}

const loadThemeFromStorage = (): ThemeType => {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored && ['light', 'dark', 'system'].includes(stored)) {
      return stored as ThemeType
    }
  } catch (error) {
    console.warn('Failed to load theme from localStorage:', error)
  }
  return DEFAULT_THEME
}

// DOM manipulation
const applyThemeToDocument = (themeToApply: ThemeType) => {
  const actualThemeToApply = themeToApply === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : themeToApply

  const root = document.documentElement

  // Remove existing theme classes
  root.classList.remove('light', 'dark')

  // Add new theme class
  root.classList.add(actualThemeToApply)

  // Update meta theme-color for mobile browsers
  const metaThemeColor = document.querySelector('meta[name="theme-color"]')
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', actualThemeToApply === 'dark' ? '#1f2937' : '#ffffff')
  }

  // Dispatch custom event for components that need to react to theme changes
  window.dispatchEvent(new CustomEvent('theme-change', {
    detail: { theme: themeToApply, actualTheme: actualThemeToApply }
  }))
}

// System theme change listener
let systemThemeListener: MediaQueryList | null = null

const setupSystemThemeListener = () => {
  if (systemThemeListener) {
    systemThemeListener.removeEventListener('change', handleSystemThemeChange)
  }

  systemThemeListener = window.matchMedia('(prefers-color-scheme: dark)')
  systemThemeListener.addEventListener('change', handleSystemThemeChange)
}

const handleSystemThemeChange = () => {
  if (theme.value === 'system') {
    applyThemeToDocument(theme.value)
  }
}

// Watch for theme changes and apply them
watch(theme, (newTheme) => {
  applyThemeToDocument(newTheme)
}, { immediate: false })

// Initialize theme on mount
const initializeTheme = () => {
  // Load saved theme
  const savedTheme = loadThemeFromStorage()
  theme.value = savedTheme

  // Apply theme to document
  applyThemeToDocument(savedTheme)

  // Setup system theme listener
  setupSystemThemeListener()
}

// Cleanup function
const cleanupTheme = () => {
  if (systemThemeListener) {
    systemThemeListener.removeEventListener('change', handleSystemThemeChange)
    systemThemeListener = null
  }
}

// Export the theme context
export const useTheme = (): ThemeContextType => {
  // Initialize on first use
  onMounted(() => {
    if (!systemThemeListener) {
      initializeTheme()
    }
  })

  return {
    theme: readonly(theme),
    actualTheme: readonly(actualTheme),
    setTheme,
    toggleTheme,
    isDark,
    isLight,
    isSystem
  }
}

// Export utilities for direct use
export { theme as currentTheme, actualTheme as currentActualTheme }

// Export cleanup function for unmounting
export { cleanupTheme }

// Export types
export type { ThemeContextType }
