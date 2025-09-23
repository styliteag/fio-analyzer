/**
 * Unit tests for theme composables
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useTheme, useThemeClasses, useThemeColors, useChartTheme, useThemeTransitions } from '../useTheme'

// Mock window.matchMedia
const mockMatchMedia = vi.fn()
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: mockMatchMedia
})

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

// Mock document methods
Object.defineProperty(document, 'documentElement', {
  value: {
    classList: {
      add: vi.fn(),
      remove: vi.fn()
    }
  }
})

Object.defineProperty(document, 'querySelector', {
  value: vi.fn(() => ({
    setAttribute: vi.fn()
  }))
})

describe('useTheme', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset localStorage mock
    localStorageMock.getItem.mockReturnValue(null)
    // Mock system prefers dark mode
    mockMatchMedia.mockReturnValue({
      matches: false, // light mode
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    })
  })

  it('should initialize with system theme by default', () => {
    const { theme, actualTheme } = useTheme()
    expect(theme).toBe('system')
    expect(actualTheme).toBe('light') // system resolves to light
  })

  it('should set theme to light', () => {
    const { setTheme, theme, actualTheme } = useTheme()
    setTheme('light')
    expect(theme).toBe('light')
    expect(actualTheme).toBe('light')
  })

  it('should set theme to dark', () => {
    const { setTheme, theme, actualTheme } = useTheme()
    setTheme('dark')
    expect(theme).toBe('dark')
    expect(actualTheme).toBe('dark')
  })

  it('should toggle theme from light to dark', () => {
    const { setTheme, toggleTheme, theme } = useTheme()
    setTheme('light')
    toggleTheme()
    expect(theme).toBe('dark')
  })

  it('should toggle theme from dark to system', () => {
    const { setTheme, toggleTheme, theme } = useTheme()
    setTheme('dark')
    toggleTheme()
    expect(theme).toBe('system')
  })

  it('should toggle theme from system to light', () => {
    const { setTheme, toggleTheme, theme } = useTheme()
    setTheme('system')
    toggleTheme()
    expect(theme).toBe('light')
  })

  it('should save theme to localStorage', () => {
    const { setTheme } = useTheme()
    setTheme('dark')
    expect(localStorageMock.setItem).toHaveBeenCalledWith('fio-analyzer-theme', 'dark')
  })

  it('should load theme from localStorage', () => {
    localStorageMock.getItem.mockReturnValue('dark')
    const { theme } = useTheme()
    expect(theme).toBe('dark')
  })

  it('should apply theme classes to document', () => {
    const { setTheme } = useTheme()
    setTheme('dark')
    expect(document.documentElement.classList.add).toHaveBeenCalledWith('dark')
    expect(document.documentElement.classList.remove).toHaveBeenCalledWith('light')
  })

  it('should resolve system theme to dark when system prefers dark', () => {
    mockMatchMedia.mockReturnValue({
      matches: true, // dark mode
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    })
    const { actualTheme } = useTheme()
    expect(actualTheme).toBe('dark')
  })

  it('should provide computed isDark and isLight properties', () => {
    const { setTheme, isDark, isLight, isSystem } = useTheme()

    setTheme('light')
    expect(isLight).toBe(true)
    expect(isDark).toBe(false)
    expect(isSystem).toBe(false)

    setTheme('dark')
    expect(isLight).toBe(false)
    expect(isDark).toBe(true)
    expect(isSystem).toBe(false)

    setTheme('system')
    expect(isLight).toBe(true) // system resolves to light in test
    expect(isDark).toBe(false)
    expect(isSystem).toBe(true)
  })
})

describe('useThemeClasses', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMatchMedia.mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    })
  })

  it('should provide theme-aware CSS classes for light theme', () => {
    const { themeClasses } = useThemeClasses()
    // In light theme, we expect light background classes
    expect(themeClasses['bg-white']).toBe(true)
    expect(themeClasses['text-gray-900']).toBe(true)
  })

  it('should provide getThemeClass utility', () => {
    const { getThemeClass } = useThemeClasses()
    expect(getThemeClass('bg-white', 'bg-gray-900')).toBe('bg-white')
  })

  it('should provide getConditionalClasses utility', () => {
    const { getConditionalClasses } = useThemeClasses()
    expect(getConditionalClasses(true, 'visible', 'hidden')).toBe('visible')
    expect(getConditionalClasses(false, 'visible', 'hidden')).toBe('hidden')
  })
})

describe('useThemeColors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMatchMedia.mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    })
  })

  it('should provide theme-aware colors for light theme', () => {
    const { colors } = useThemeColors()
    expect(colors.primary).toBe('#3b82f6') // blue-500
    expect(colors.background).toBe('#ffffff') // white
    expect(colors.text).toBe('#111827') // gray-900
  })

  it('should provide theme-aware colors for dark theme', () => {
    // Mock dark theme
    mockMatchMedia.mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    })
    const { colors } = useThemeColors()
    expect(colors.primary).toBe('#60a5fa') // blue-400
    expect(colors.background).toBe('#1f2937') // gray-800
    expect(colors.text).toBe('#f9fafb') // gray-50
  })

  it('should provide getColor utility', () => {
    const { getColor } = useThemeColors()
    expect(getColor('primary')).toBe('#3b82f6')
    expect(getColor('error')).toBe('#ef4444')
  })

  it('should provide getRgbColor utility', () => {
    const { getRgbColor } = useThemeColors()
    expect(getRgbColor('primary')).toBe('59, 130, 246') // rgb values of #3b82f6
  })
})

describe('useChartTheme', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMatchMedia.mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    })
  })

  it('should provide chart colors for light theme', () => {
    const { chartColors } = useChartTheme()
    expect(chartColors.backgroundColors).toHaveLength(8)
    expect(chartColors.borderColors).toHaveLength(8)
    expect(chartColors.gridColor).toBe('#e5e7eb') // gray-200
    expect(chartColors.textColor).toBe('#6b7280') // gray-500
  })

  it('should provide chart colors for dark theme', () => {
    mockMatchMedia.mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    })
    const { chartColors } = useChartTheme()
    expect(chartColors.gridColor).toBe('#374151') // gray-700
    expect(chartColors.textColor).toBe('#9ca3af') // gray-400
  })

  it('should provide chart options with theme-aware styling', () => {
    const { chartOptions } = useChartTheme()
    expect(chartOptions.plugins?.legend?.labels?.color).toBeDefined()
    expect(chartOptions.plugins?.tooltip?.backgroundColor).toBeDefined()
    expect(chartOptions.scales?.x?.ticks?.color).toBeDefined()
    expect(chartOptions.scales?.y?.grid?.color).toBeDefined()
  })
})

describe('useThemeTransitions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should apply theme transition to element', () => {
    const { applyThemeTransition } = useThemeTransitions()
    const mockElement = { style: {} } as HTMLElement

    applyThemeTransition(mockElement, 300)
    expect(mockElement.style.transition).toBe('background-color 300ms ease, color 300ms ease, border-color 300ms ease')
  })

  it('should remove theme transition from element', () => {
    const { removeThemeTransition } = useThemeTransitions()
    const mockElement = { style: { transition: 'some-transition' } } as HTMLElement

    removeThemeTransition(mockElement)
    expect(mockElement.style.transition).toBe('')
  })

  it('should execute callback with theme transition', async () => {
    const { withThemeTransition } = useThemeTransitions()
    const mockCallback = vi.fn().mockResolvedValue('result')
    const mockElement = { style: {} } as HTMLElement

    // Mock document.querySelector to return our mock element
    vi.spyOn(document, 'querySelectorAll').mockReturnValue([mockElement] as NodeListOf<Element>)

    const result = await withThemeTransition(mockCallback, 200)
    expect(mockCallback).toHaveBeenCalled()
    expect(result).toBe('result')
  })

  it('should provide theme transition utility', () => {
    const { applyThemeTransition, removeThemeTransition, withThemeTransition } = useThemeTransitions()
    expect(typeof applyThemeTransition).toBe('function')
    expect(typeof removeThemeTransition).toBe('function')
    expect(typeof withThemeTransition).toBe('function')
  })
})

// Test custom event dispatching
describe('theme change events', () => {
  let addEventListenerSpy: vi.SpyInstance
  let dispatchEventSpy: vi.SpyInstance

  beforeEach(() => {
    vi.clearAllMocks()
    addEventListenerSpy = vi.spyOn(window, 'addEventListener')
    dispatchEventSpy = vi.spyOn(window, 'dispatchEvent')
  })

  afterEach(() => {
    addEventListenerSpy.mockRestore()
    dispatchEventSpy.mockRestore()
  })

  it('should dispatch theme-change event when theme changes', () => {
    const { setTheme } = useTheme()
    setTheme('dark')

    expect(dispatchEventSpy).toHaveBeenCalled()
    const event = dispatchEventSpy.mock.calls[0][0] as CustomEvent
    expect(event.type).toBe('theme-change')
    expect(event.detail.theme).toBe('dark')
    expect(event.detail.actualTheme).toBe('dark')
  })

  it('should setup system theme change listener', () => {
    useTheme()
    expect(addEventListenerSpy).toHaveBeenCalledWith('change', expect.any(Function))
  })
})

// Test error handling
describe('error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock localStorage to throw errors
    localStorageMock.getItem.mockImplementation(() => {
      throw new Error('localStorage error')
    })
    localStorageMock.setItem.mockImplementation(() => {
      throw new Error('localStorage error')
    })
  })

  it('should handle localStorage errors gracefully', () => {
    expect(() => useTheme()).not.toThrow()
    expect(() => {
      const { setTheme } = useTheme()
      setTheme('dark')
    }).not.toThrow()
  })

  it('should fall back to default theme when localStorage fails', () => {
    const { theme } = useTheme()
    expect(theme).toBe('system') // default theme
  })
})
