import { ref, computed, watch, onMounted } from 'vue'

// Theme types
export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

// Local storage key for theme persistence
const THEME_STORAGE_KEY = 'fio-theme'

// CSS custom properties for theme variables
const THEME_VARIABLES = {
  light: {
    '--bg-primary': '#ffffff',
    '--bg-secondary': '#f8fafc',
    '--bg-tertiary': '#f1f5f9',
    '--bg-accent': '#e2e8f0',
    '--text-primary': '#1e293b',
    '--text-secondary': '#64748b',
    '--text-muted': '#94a3b8',
    '--border-primary': '#e2e8f0',
    '--border-secondary': '#f1f5f9',
    '--border-accent': '#cbd5e1',
    '--button-primary': '#3b82f6',
    '--button-primary-hover': '#2563eb',
    '--button-secondary': '#64748b',
    '--button-secondary-hover': '#475569',
    '--success': '#10b981',
    '--warning': '#f59e0b',
    '--error': '#ef4444',
    '--info': '#3b82f6',
    '--shadow-sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    '--shadow-md': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    '--shadow-lg': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  },
  dark: {
    '--bg-primary': '#0f172a',
    '--bg-secondary': '#1e293b',
    '--bg-tertiary': '#334155',
    '--bg-accent': '#475569',
    '--text-primary': '#f8fafc',
    '--text-secondary': '#cbd5e1',
    '--text-muted': '#94a3b8',
    '--border-primary': '#334155',
    '--border-secondary': '#475569',
    '--border-accent': '#64748b',
    '--button-primary': '#3b82f6',
    '--button-primary-hover': '#2563eb',
    '--button-secondary': '#64748b',
    '--button-secondary-hover': '#475569',
    '--success': '#10b981',
    '--warning': '#f59e0b',
    '--error': '#ef4444',
    '--info': '#3b82f6',
    '--shadow-sm': '0 1px 2px 0 rgb(0 0 0 / 0.3)',
    '--shadow-md': '0 4px 6px -1px rgb(0 0 0 / 0.4), 0 2px 4px -2px rgb(0 0 0 / 0.4)',
    '--shadow-lg': '0 10px 15px -3px rgb(0 0 0 / 0.5), 0 4px 6px -4px rgb(0 0 0 / 0.5)',
  },
}

// System theme detection
function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light'

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// Theme management
export function useTheme() {
  const themeMode = ref<ThemeMode>('system')
  const resolvedTheme = ref<ResolvedTheme>('light')
  const isTransitioning = ref(false)

  // Computed properties
  const isDark = computed(() => resolvedTheme.value === 'dark')
  const isLight = computed(() => resolvedTheme.value === 'light')
  const isSystem = computed(() => themeMode.value === 'system')

  // Resolve the actual theme based on mode
  function resolveTheme(): ResolvedTheme {
    if (themeMode.value === 'system') {
      return getSystemTheme()
    }
    return themeMode.value
  }

  // Apply theme to DOM
  function applyTheme(theme: ResolvedTheme): void {
    if (typeof document === 'undefined') return

    isTransitioning.value = true

    const root = document.documentElement
    const variables = THEME_VARIABLES[theme]

    // Apply CSS custom properties
    Object.entries(variables).forEach(([property, value]) => {
      root.style.setProperty(property, value)
    })

    // Update dark class for Tailwind CSS
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }

    // Update resolved theme
    resolvedTheme.value = theme

    // Smooth transition
    setTimeout(() => {
      isTransitioning.value = false
    }, 150)
  }

  // Set theme mode
  function setThemeMode(mode: ThemeMode): void {
    themeMode.value = mode
    const resolved = resolveTheme()
    applyTheme(resolved)
    saveToStorage()
  }

  // Toggle between light and dark (not system)
  function toggleTheme(): void {
    const newMode: ThemeMode = resolvedTheme.value === 'dark' ? 'light' : 'dark'
    setThemeMode(newMode)
  }

  // Force set to light theme
  function setLightTheme(): void {
    setThemeMode('light')
  }

  // Force set to dark theme
  function setDarkTheme(): void {
    setThemeMode('dark')
  }

  // Set to system theme
  function setSystemTheme(): void {
    setThemeMode('system')
  }

  // Listen for system theme changes
  function setupSystemThemeListener(): () => void {
    if (typeof window === 'undefined') return () => {}

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const handleChange = (e: MediaQueryListEvent) => {
      if (themeMode.value === 'system') {
        const newTheme: ResolvedTheme = e.matches ? 'dark' : 'light'
        applyTheme(newTheme)
      }
    }

    mediaQuery.addEventListener('change', handleChange)

    // Cleanup function
    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }

  // Persistence
  function saveToStorage(): void {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({
        mode: themeMode.value,
        timestamp: Date.now(),
      }))
    } catch (error) {
      console.warn('Failed to save theme to localStorage:', error)
    }
  }

  function loadFromStorage(): boolean {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY)
      if (!stored) return false

      const data = JSON.parse(stored)
      if (data.mode && ['light', 'dark', 'system'].includes(data.mode)) {
        themeMode.value = data.mode
        return true
      }
      return false
    } catch (error) {
      console.warn('Failed to load theme from localStorage:', error)
      return false
    }
  }

  function clearStorage(): void {
    try {
      localStorage.removeItem(THEME_STORAGE_KEY)
    } catch (error) {
      console.warn('Failed to clear theme from localStorage:', error)
    }
  }

  // Get theme information
  function getThemeInfo(): {
    mode: ThemeMode
    resolved: ResolvedTheme
    isSystem: boolean
    systemPreference: ResolvedTheme
  } {
    return {
      mode: themeMode.value,
      resolved: resolvedTheme.value,
      isSystem: isSystem.value,
      systemPreference: getSystemTheme(),
    }
  }

  // Initialize theme on mount
  onMounted(() => {
    // Load from storage or use default
    const loaded = loadFromStorage()
    if (!loaded) {
      // Default to system theme if no preference saved
      themeMode.value = 'system'
    }

    // Apply initial theme
    const initialTheme = resolveTheme()
    applyTheme(initialTheme)

    // Setup system theme listener
    setupSystemThemeListener()
  })

  // Watch for theme mode changes
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  watch(themeMode, (_newMode) => {
    const resolved = resolveTheme()
    applyTheme(resolved)
  })

  return {
    // Reactive state
    themeMode,
    resolvedTheme,
    isTransitioning,

    // Computed properties
    isDark,
    isLight,
    isSystem,
    isDarkMode: isDark, // Alias for compatibility

    // Theme control methods
    setThemeMode,
    toggleTheme,
    setLightTheme,
    setDarkTheme,
    setSystemTheme,

    // Persistence
    saveToStorage,
    loadFromStorage,
    clearStorage,

    // Information
    getThemeInfo,
    getSystemTheme,
  }
}
