import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import UserManager from '../UserManager.vue'
import type { UserAccount } from '@/types'

// Mock composables
const mockUseAuth = vi.fn()
const mockUseApi = vi.fn()

describe('Integration Test: UserManager Page - User Management Interface', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('should display user management interface for admins', async () => {
    // This test MUST FAIL initially (TDD requirement)
    const mockUsers: UserAccount[] = [
      {
        username: 'admin',
        role: 'admin',
        permissions: [
          { resource: 'test-runs', actions: ['read', 'write', 'delete'] },
          { resource: 'users', actions: ['read', 'write', 'delete'] },
        ],
        created_at: '2025-01-01T00:00:00Z',
        last_login: '2025-09-24T19:30:00Z',
      },
      {
        username: 'uploader',
        role: 'uploader',
        permissions: [
          { resource: 'test-runs', actions: ['read'] },
          { resource: 'upload', actions: ['write'] },
        ],
        created_at: '2025-01-15T00:00:00Z',
        last_login: '2025-09-24T18:45:00Z',
      },
    ]

    const mockAuthState = {
      isAuthenticated: { value: true },
      user: { value: mockUsers[0] },
      userRole: { value: 'admin' },
      hasPermission: vi.fn().mockReturnValue(true),
    }

    const mockApiState = {
      users: { value: { data: mockUsers, loading: false, error: null } },
      fetchUsers: vi.fn().mockResolvedValue(mockUsers),
      createUser: vi.fn(),
      updateUser: vi.fn(),
      deleteUser: vi.fn(),
      isLoading: { value: false },
      hasError: { value: false },
    }

    mockUseAuth.mockReturnValue(mockAuthState)
    mockUseApi.mockReturnValue(mockApiState)

    vi.doMock('@/composables/useAuth', () => ({ useAuth: mockUseAuth }))
    vi.doMock('@/composables/useApi', () => ({ useApi: mockUseApi }))

    // This will fail because UserManager component doesn't exist yet
    const wrapper = mount(UserManager, {
      global: {
        plugins: [createTestingPinia()],
        stubs: ['RouterLink', 'UserList', 'AddUserForm'],
      },
    })

    // Verify authentication guard
    expect(mockAuthState.hasPermission).toHaveBeenCalledWith('admin')

    // Verify page header
    expect(wrapper.text()).toContain('Manage admin and uploader users for the FIO Analyzer system')

    // Verify user list component
    const userList = wrapper.findComponent({ name: 'UserList' })
    expect(userList.exists()).toBe(true)
    expect(userList.props().users).toEqual(mockUsers)

    // Verify add user form
    const addUserForm = wrapper.findComponent({ name: 'AddUserForm' })
    expect(addUserForm.exists()).toBe(true)

    // Verify action buttons
    expect(wrapper.text()).toContain('Add User')
    expect(wrapper.text()).toContain('Refresh')

    // Verify user count display
    expect(wrapper.text()).toContain('(2)') // 2 users total
  })

  it('should handle user creation', async () => {
    const mockApiState = {
      users: { value: { data: [], loading: false, error: null } },
      fetchUsers: vi.fn(),
      createUser: vi.fn().mockResolvedValue({
        message: 'User created successfully',
        user: {
          username: 'newuser',
          role: 'uploader',
          created_at: '2025-09-24T20:00:00Z',
        },
      }),
      updateUser: vi.fn(),
      deleteUser: vi.fn(),
      isLoading: { value: false },
      hasError: { value: false },
    }

    mockUseAuth.mockReturnValue({
      isAuthenticated: { value: true },
      user: { value: { username: 'admin', role: 'admin' } },
      hasPermission: vi.fn().mockReturnValue(true),
    })
    mockUseApi.mockReturnValue(mockApiState)

    vi.doMock('@/composables/useAuth', () => ({ useAuth: mockUseAuth }))
    vi.doMock('@/composables/useApi', () => ({ useApi: mockUseApi }))

    const wrapper = mount(UserManager, {
      global: {
        plugins: [createTestingPinia()],
        stubs: ['RouterLink', 'UserList', 'AddUserForm'],
      },
    })

    // Simulate form submission
    const addUserForm = wrapper.findComponent({ name: 'AddUserForm' })
    await addUserForm.vm.$emit('user-created', {
      username: 'newuser',
      password: 'securepass123',
      role: 'uploader',
    })

    // Verify API call
    expect(mockApiState.createUser).toHaveBeenCalledWith({
      username: 'newuser',
      password: 'securepass123',
      role: 'uploader',
    })

    // Verify success feedback
    expect(wrapper.text()).toContain('User created successfully')

    // Verify user list refresh
    expect(mockApiState.fetchUsers).toHaveBeenCalled()
  })

  it('should handle user updates', async () => {
    const existingUser = {
      username: 'uploader',
      role: 'uploader',
      permissions: [],
    }

    const mockApiState = {
      users: { value: { data: [existingUser], loading: false, error: null } },
      fetchUsers: vi.fn(),
      createUser: vi.fn(),
      updateUser: vi.fn().mockResolvedValue({
        message: 'User updated successfully',
      }),
      deleteUser: vi.fn(),
      isLoading: { value: false },
      hasError: { value: false },
    }

    mockUseAuth.mockReturnValue({
      isAuthenticated: { value: true },
      user: { value: { username: 'admin', role: 'admin' } },
      hasPermission: vi.fn().mockReturnValue(true),
    })
    mockUseApi.mockReturnValue(mockApiState)

    vi.doMock('@/composables/useAuth', () => ({ useAuth: mockUseAuth }))
    vi.doMock('@/composables/useApi', () => ({ useApi: mockUseApi }))

    const wrapper = mount(UserManager, {
      global: {
        plugins: [createTestingPinia()],
        stubs: ['RouterLink', 'UserList', 'AddUserForm'],
      },
    })

    // Simulate user update
    const userList = wrapper.findComponent({ name: 'UserList' })
    await userList.vm.$emit('user-updated', {
      username: 'uploader',
      role: 'admin',
      password: 'newpassword123',
    })

    // Verify API call
    expect(mockApiState.updateUser).toHaveBeenCalledWith('uploader', {
      role: 'admin',
      password: 'newpassword123',
    })

    // Verify success feedback
    expect(wrapper.text()).toContain('User updated successfully')
  })

  it('should handle user deletion', async () => {
    const mockApiState = {
      users: { value: { data: [], loading: false, error: null } },
      fetchUsers: vi.fn(),
      createUser: vi.fn(),
      updateUser: vi.fn(),
      deleteUser: vi.fn().mockResolvedValue({
        message: 'User deleted successfully',
      }),
      isLoading: { value: false },
      hasError: { value: false },
    }

    mockUseAuth.mockReturnValue({
      isAuthenticated: { value: true },
      user: { value: { username: 'admin', role: 'admin' } },
      hasPermission: vi.fn().mockReturnValue(true),
    })
    mockUseApi.mockReturnValue(mockApiState)

    vi.doMock('@/composables/useAuth', () => ({ useAuth: mockUseAuth }))
    vi.doMock('@/composables/useApi', () => ({ useApi: mockUseApi }))

    const wrapper = mount(UserManager, {
      global: {
        plugins: [createTestingPinia()],
        stubs: ['RouterLink', 'UserList', 'AddUserForm'],
      },
    })

    // Simulate user deletion
    const userList = wrapper.findComponent({ name: 'UserList' })
    await userList.vm.$emit('user-deleted', 'testuser')

    // Verify API call
    expect(mockApiState.deleteUser).toHaveBeenCalledWith('testuser')

    // Verify success feedback
    expect(wrapper.text()).toContain('User deleted successfully')

    // Verify user list refresh
    expect(mockApiState.fetchUsers).toHaveBeenCalled()
  })

  it('should show role-based permissions', async () => {
    const mockUsers: UserAccount[] = [
      {
        username: 'admin',
        role: 'admin',
        permissions: [
          { resource: 'test-runs', actions: ['read', 'write', 'delete'] },
          { resource: 'users', actions: ['read', 'write', 'delete'] },
          { resource: 'upload', actions: ['write'] },
        ],
      },
      {
        username: 'uploader',
        role: 'uploader',
        permissions: [
          { resource: 'test-runs', actions: ['read'] },
          { resource: 'upload', actions: ['write'] },
        ],
      },
    ]

    const mockApiState = {
      users: { value: { data: mockUsers, loading: false, error: null } },
      fetchUsers: vi.fn().mockResolvedValue(mockUsers),
      createUser: vi.fn(),
      updateUser: vi.fn(),
      deleteUser: vi.fn(),
      isLoading: { value: false },
      hasError: { value: false },
    }

    mockUseAuth.mockReturnValue({
      isAuthenticated: { value: true },
      user: { value: mockUsers[0] },
      hasPermission: vi.fn().mockReturnValue(true),
    })
    mockUseApi.mockReturnValue(mockApiState)

    vi.doMock('@/composables/useAuth', () => ({ useAuth: mockUseAuth }))
    vi.doMock('@/composables/useApi', () => ({ useApi: mockUseApi }))

    const wrapper = mount(UserManager, {
      global: {
        plugins: [createTestingPinia()],
        stubs: ['RouterLink', 'UserList', 'AddUserForm'],
      },
    })

    // Verify admin user has full permissions
    const userList = wrapper.findComponent({ name: 'UserList' })
    expect(userList.props().users[0].permissions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ resource: 'users', actions: ['read', 'write', 'delete'] }),
      ])
    )

    // Verify uploader user has limited permissions
    expect(userList.props().users[1].permissions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ resource: 'test-runs', actions: ['read'] }),
        expect.objectContaining({ resource: 'upload', actions: ['write'] }),
      ])
    )

    // Verify uploader cannot manage users
    expect(userList.props().users[1].permissions).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ resource: 'users' }),
      ])
    )
  })

  it('should prevent self-deletion', async () => {
    const currentUser = {
      username: 'admin',
      role: 'admin',
      permissions: [],
    }

    const mockApiState = {
      users: { value: { data: [currentUser], loading: false, error: null } },
      fetchUsers: vi.fn(),
      createUser: vi.fn(),
      updateUser: vi.fn(),
      deleteUser: vi.fn(), // Should not be called
      isLoading: { value: false },
      hasError: { value: false },
    }

    mockUseAuth.mockReturnValue({
      isAuthenticated: { value: true },
      user: { value: currentUser },
      hasPermission: vi.fn().mockReturnValue(true),
    })
    mockUseApi.mockReturnValue(mockApiState)

    vi.doMock('@/composables/useAuth', () => ({ useAuth: mockUseAuth }))
    vi.doMock('@/composables/useApi', () => ({ useApi: mockUseApi }))

    const wrapper = mount(UserManager, {
      global: {
        plugins: [createTestingPinia()],
        stubs: ['RouterLink', 'UserList', 'AddUserForm'],
      },
    })

    // Attempt to delete current user
    const userList = wrapper.findComponent({ name: 'UserList' })
    await userList.vm.$emit('user-deleted', 'admin')

    // Verify API was not called
    expect(mockApiState.deleteUser).not.toHaveBeenCalled()

    // Verify error message
    expect(wrapper.text()).toContain('Cannot delete your own account')
  })

  it('should handle loading and error states', async () => {
    const mockApiState = {
      users: { value: { data: null, loading: true, error: null } },
      fetchUsers: vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        throw new Error('API Error')
      }),
      createUser: vi.fn(),
      updateUser: vi.fn(),
      deleteUser: vi.fn(),
      isLoading: { value: true },
      hasError: { value: false },
    }

    mockUseAuth.mockReturnValue({
      isAuthenticated: { value: true },
      user: { value: { username: 'admin', role: 'admin' } },
      hasPermission: vi.fn().mockReturnValue(true),
    })
    mockUseApi.mockReturnValue(mockApiState)

    vi.doMock('@/composables/useAuth', () => ({ useAuth: mockUseAuth }))
    vi.doMock('@/composables/useApi', () => ({ useApi: mockUseApi }))

    const wrapper = mount(UserManager, {
      global: {
        plugins: [createTestingPinia()],
        stubs: ['RouterLink', 'UserList', 'AddUserForm'],
      },
    })

    // Verify loading state
    expect(wrapper.text()).toContain('Loading users...')

    // Wait for error
    await new Promise(resolve => setTimeout(resolve, 150))

    // Verify error handling
    expect(wrapper.text()).toContain('Error loading users')
    expect(wrapper.text()).toContain('API Error')
  })

  it('should validate user input', async () => {
    const mockApiState = {
      users: { value: { data: [], loading: false, error: null } },
      fetchUsers: vi.fn(),
      createUser: vi.fn(), // Should not be called with invalid data
      updateUser: vi.fn(),
      deleteUser: vi.fn(),
      isLoading: { value: false },
      hasError: { value: false },
    }

    mockUseAuth.mockReturnValue({
      isAuthenticated: { value: true },
      user: { value: { username: 'admin', role: 'admin' } },
      hasPermission: vi.fn().mockReturnValue(true),
    })
    mockUseApi.mockReturnValue(mockApiState)

    vi.doMock('@/composables/useAuth', () => ({ useAuth: mockUseAuth }))
    vi.doMock('@/composables/useApi', () => ({ useApi: mockUseApi }))

    const wrapper = mount(UserManager, {
      global: {
        plugins: [createTestingPinia()],
        stubs: ['RouterLink', 'UserList', 'AddUserForm'],
      },
    })

    // Try to create user with invalid data
    const addUserForm = wrapper.findComponent({ name: 'AddUserForm' })
    await addUserForm.vm.$emit('user-created', {
      username: '', // Invalid: empty username
      password: '123', // Invalid: too short
      role: 'invalid', // Invalid: not admin/uploader
    })

    // Verify validation errors
    expect(wrapper.text()).toContain('Username is required')
    expect(wrapper.text()).toContain('Password must be at least 8 characters')
    expect(wrapper.text()).toContain('Role must be either admin or uploader')

    // Verify API was not called
    expect(mockApiState.createUser).not.toHaveBeenCalled()
  })

  it('should refresh user list', async () => {
    const mockApiState = {
      users: { value: { data: [], loading: false, error: null } },
      fetchUsers: vi.fn().mockResolvedValue([]),
      createUser: vi.fn(),
      updateUser: vi.fn(),
      deleteUser: vi.fn(),
      isLoading: { value: false },
      hasError: { value: false },
    }

    mockUseAuth.mockReturnValue({
      isAuthenticated: { value: true },
      user: { value: { username: 'admin', role: 'admin' } },
      hasPermission: vi.fn().mockReturnValue(true),
    })
    mockUseApi.mockReturnValue(mockApiState)

    vi.doMock('@/composables/useAuth', () => ({ useAuth: mockUseAuth }))
    vi.doMock('@/composables/useApi', () => ({ useApi: mockUseApi }))

    const wrapper = mount(UserManager, {
      global: {
        plugins: [createTestingPinia()],
        stubs: ['RouterLink', 'UserList', 'AddUserForm'],
      },
    })

    // Click refresh button
    const refreshButton = wrapper.find('button').filter(button =>
      button.text().includes('Refresh')
    )
    await refreshButton.trigger('click')

    // Verify API call
    expect(mockApiState.fetchUsers).toHaveBeenCalled()
  })
})
