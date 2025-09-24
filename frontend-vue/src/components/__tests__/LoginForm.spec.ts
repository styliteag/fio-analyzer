import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import LoginForm from '../LoginForm.vue'

// Mock the useAuth composable
const mockUseAuth = vi.fn()

describe('Integration Test: LoginForm Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('should render login form with dark theme', async () => {
    // This test MUST FAIL initially (TDD requirement)
    const mockAuthState = {
      isAuthenticated: { value: false },
      user: { value: null },
      login: vi.fn().mockResolvedValue(undefined),
      logout: vi.fn(),
      userRole: { value: null },
      hasPermission: vi.fn().mockReturnValue(false),
      initializeAuth: vi.fn(),
    }

    mockUseAuth.mockReturnValue(mockAuthState)

    // Mock the composable import
    vi.doMock('@/composables/useAuth', () => ({
      useAuth: mockUseAuth,
    }))

    // This will fail because LoginForm component doesn't exist yet
    const wrapper = mount(LoginForm, {
      global: {
        plugins: [createTestingPinia()],
        stubs: ['RouterLink'],
      },
    })

    // Verify dark theme styling
    expect(wrapper.classes()).toContain('dark')
    expect(wrapper.text()).toContain('Sign in to FIO Analyzer')
    expect(wrapper.text()).toContain('Storage Performance Visualizer')

    // Verify form elements exist
    const usernameInput = wrapper.find('input[type="text"]')
    const passwordInput = wrapper.find('input[type="password"]')
    const submitButton = wrapper.find('button[type="submit"]')

    expect(usernameInput.exists()).toBe(true)
    expect(passwordInput.exists()).toBe(true)
    expect(submitButton.exists()).toBe(true)
    expect(submitButton.text()).toContain('Sign in')
  })

  it('should handle successful login flow', async () => {
    const mockAuthState = {
      isAuthenticated: { value: false },
      user: { value: null },
      login: vi.fn().mockResolvedValue(undefined),
      logout: vi.fn(),
      userRole: { value: 'admin' },
      hasPermission: vi.fn().mockReturnValue(true),
      initializeAuth: vi.fn(),
    }

    mockUseAuth.mockReturnValue(mockAuthState)

    vi.doMock('@/composables/useAuth', () => ({
      useAuth: mockUseAuth,
    }))

    const wrapper = mount(LoginForm, {
      global: {
        plugins: [createTestingPinia()],
        stubs: ['RouterLink'],
      },
    })

    // Fill form
    const usernameInput = wrapper.find('input[type="text"]')
    const passwordInput = wrapper.find('input[type="password"]')
    const submitButton = wrapper.find('button[type="submit"]')

    await usernameInput.setValue('admin')
    await passwordInput.setValue('admin')

    // Submit form
    await submitButton.trigger('click')

    // Verify login was called with correct credentials
    expect(mockAuthState.login).toHaveBeenCalledWith({
      username: 'admin',
      password: 'admin',
    })

    // Verify authentication state changed
    expect(mockAuthState.isAuthenticated.value).toBe(false) // Still false until navigation
    expect(mockAuthState.userRole.value).toBe('admin')
  })

  it('should handle login errors', async () => {
    const mockError = new Error('Invalid credentials')
    const mockAuthState = {
      isAuthenticated: { value: false },
      user: { value: null },
      login: vi.fn().mockRejectedValue(mockError),
      logout: vi.fn(),
      userRole: { value: null },
      hasPermission: vi.fn().mockReturnValue(false),
      initializeAuth: vi.fn(),
    }

    mockUseAuth.mockReturnValue(mockAuthState)

    vi.doMock('@/composables/useAuth', () => ({
      useAuth: mockUseAuth,
    }))

    const wrapper = mount(LoginForm, {
      global: {
        plugins: [createTestingPinia()],
        stubs: ['RouterLink'],
      },
    })

    // Fill form with invalid credentials
    const usernameInput = wrapper.find('input[type="text"]')
    const passwordInput = wrapper.find('input[type="password"]')
    const submitButton = wrapper.find('button[type="submit"]')

    await usernameInput.setValue('invalid')
    await passwordInput.setValue('invalid')
    await submitButton.trigger('click')

    // Verify error handling
    expect(mockAuthState.login).toHaveBeenCalledWith({
      username: 'invalid',
      password: 'invalid',
    })

    // Verify error message is displayed
    expect(wrapper.text()).toContain('Invalid credentials')

    // Verify still not authenticated
    expect(mockAuthState.isAuthenticated.value).toBe(false)
  })

  it('should validate form inputs', async () => {
    const mockAuthState = {
      isAuthenticated: { value: false },
      user: { value: null },
      login: vi.fn(),
      logout: vi.fn(),
      userRole: { value: null },
      hasPermission: vi.fn().mockReturnValue(false),
      initializeAuth: vi.fn(),
    }

    mockUseAuth.mockReturnValue(mockAuthState)

    vi.doMock('@/composables/useAuth', () => ({
      useAuth: mockUseAuth,
    }))

    const wrapper = mount(LoginForm, {
      global: {
        plugins: [createTestingPinia()],
        stubs: ['RouterLink'],
      },
    })

    const submitButton = wrapper.find('button[type="submit"]')

    // Try to submit empty form
    await submitButton.trigger('click')

    // Verify validation messages
    expect(wrapper.text()).toContain('Username is required')
    expect(wrapper.text()).toContain('Password is required')

    // Verify login was not called
    expect(mockAuthState.login).not.toHaveBeenCalled()

    // Fill only username
    const usernameInput = wrapper.find('input[type="text"]')
    await usernameInput.setValue('admin')
    await submitButton.trigger('click')

    // Verify only password validation shows
    expect(wrapper.text()).toContain('Password is required')
    expect(wrapper.text()).not.toContain('Username is required')
  })

  it('should handle loading states during login', async () => {
    let resolveLogin: (value: void) => void
    const loginPromise = new Promise<void>((resolve) => {
      resolveLogin = resolve
    })

    const mockAuthState = {
      isAuthenticated: { value: false },
      user: { value: null },
      login: vi.fn().mockReturnValue(loginPromise),
      logout: vi.fn(),
      userRole: { value: null },
      hasPermission: vi.fn().mockReturnValue(false),
      initializeAuth: vi.fn(),
    }

    mockUseAuth.mockReturnValue(mockAuthState)

    vi.doMock('@/composables/useAuth', () => ({
      useAuth: mockUseAuth,
    }))

    const wrapper = mount(LoginForm, {
      global: {
        plugins: [createTestingPinia()],
        stubs: ['RouterLink'],
      },
    })

    const usernameInput = wrapper.find('input[type="text"]')
    const passwordInput = wrapper.find('input[type="password"]')
    const submitButton = wrapper.find('button[type="submit"]')

    await usernameInput.setValue('admin')
    await passwordInput.setValue('admin')

    // Start login
    await submitButton.trigger('click')

    // Verify loading state
    expect(submitButton.attributes('disabled')).toBeDefined()
    expect(submitButton.text()).toContain('Signing in...')

    // Complete login
    resolveLogin(undefined)
    await wrapper.vm.$nextTick()

    // Verify loading state cleared
    expect(submitButton.attributes('disabled')).toBeUndefined()
    expect(submitButton.text()).toContain('Sign in')
  })

  it('should remember authentication state', async () => {
    // Test that successful login updates localStorage
    const mockAuthState = {
      isAuthenticated: { value: true },
      user: { value: { username: 'admin', role: 'admin', permissions: [] } },
      login: vi.fn().mockResolvedValue(undefined),
      logout: vi.fn(),
      userRole: { value: 'admin' },
      hasPermission: vi.fn().mockReturnValue(true),
      initializeAuth: vi.fn(),
    }

    mockUseAuth.mockReturnValue(mockAuthState)

    vi.doMock('@/composables/useAuth', () => ({
      useAuth: mockUseAuth,
    }))

    const wrapper = mount(LoginForm, {
      global: {
        plugins: [createTestingPinia()],
        stubs: ['RouterLink'],
      },
    })

    const usernameInput = wrapper.find('input[type="text"]')
    const passwordInput = wrapper.find('input[type="password"]')
    const submitButton = wrapper.find('button[type="submit"]')

    await usernameInput.setValue('admin')
    await passwordInput.setValue('admin')
    await submitButton.trigger('click')

    // Verify localStorage was updated (this would be handled by useAuth)
    const storedAuth = localStorage.getItem('fio-auth')
    expect(storedAuth).toBeTruthy()

    if (storedAuth) {
      const parsed = JSON.parse(storedAuth)
      expect(parsed.username).toBe('admin')
      expect(parsed.role).toBe('admin')
    }
  })
})
