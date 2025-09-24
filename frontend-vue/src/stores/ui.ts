import { defineStore } from 'pinia'
import { ref, computed, readonly } from 'vue'

// Notification types
export type NotificationType = 'success' | 'error' | 'warning' | 'info'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  duration?: number // in milliseconds, null for persistent
  timestamp: number
  action?: {
    label: string
    handler: () => void
  }
}

// Modal types
export interface ModalState {
  isOpen: boolean
  component: string | null
  props: Record<string, any>
  options: {
    size?: 'sm' | 'md' | 'lg' | 'xl'
    closable?: boolean
    backdrop?: boolean
    persistent?: boolean
  }
}

// Loading state types
export interface LoadingState {
  id: string
  message: string
  progress?: number // 0-100, undefined for indeterminate
}

// UI state interface
interface UiState {
  notifications: Notification[]
  modal: ModalState
  loadingStates: LoadingState[]
  sidebarOpen: boolean
  theme: 'light' | 'dark' | 'system'
  lastActivity: number
}

export const useUiStore = defineStore('ui', () => {
  // Reactive state
  const state = ref<UiState>({
    notifications: [],
    modal: {
      isOpen: false,
      component: null,
      props: {},
      options: {
        size: 'md',
        closable: true,
        backdrop: true,
        persistent: false,
      },
    },
    loadingStates: [],
    sidebarOpen: false,
    theme: 'system',
    lastActivity: Date.now(),
  })

  // Computed properties
  const hasNotifications = computed(() => state.value.notifications.length > 0)
  const notificationCount = computed(() => state.value.notifications.length)
  const hasLoadingStates = computed(() => state.value.loadingStates.length > 0)
  const isLoading = computed(() => state.value.loadingStates.length > 0)
  const isModalOpen = computed(() => state.value.modal.isOpen)

  const notificationsByType = computed(() => {
    const grouped: Record<NotificationType, Notification[]> = {
      success: [],
      error: [],
      warning: [],
      info: [],
    }

    state.value.notifications.forEach(notification => {
      grouped[notification.type].push(notification)
    })

    return grouped
  })

  // Notification management
  function addNotification(notification: Omit<Notification, 'id' | 'timestamp'>): string {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const fullNotification: Notification = {
      ...notification,
      id,
      timestamp: Date.now(),
    }

    state.value.notifications.push(fullNotification)

    // Auto-remove notification after duration
    if (fullNotification.duration && fullNotification.duration > 0) {
      setTimeout(() => {
        removeNotification(id)
      }, fullNotification.duration)
    }

    return id
  }

  function removeNotification(id: string): void {
    const index = state.value.notifications.findIndex(n => n.id === id)
    if (index > -1) {
      state.value.notifications.splice(index, 1)
    }
  }

  function clearNotifications(): void {
    state.value.notifications = []
  }

  function clearNotificationsByType(type: NotificationType): void {
    state.value.notifications = state.value.notifications.filter(n => n.type !== type)
  }

  // Convenience methods for different notification types
  function showSuccess(title: string, message: string, duration = 5000): string {
    return addNotification({
      type: 'success',
      title,
      message,
      duration,
    })
  }

  function showError(title: string, message: string, duration = 8000): string {
    return addNotification({
      type: 'error',
      title,
      message,
      duration,
    })
  }

  function showWarning(title: string, message: string, duration = 6000): string {
    return addNotification({
      type: 'warning',
      title,
      message,
      duration,
    })
  }

  function showInfo(title: string, message: string, duration = 5000): string {
    return addNotification({
      type: 'info',
      title,
      message,
      duration,
    })
  }

  // Modal management
  function openModal(
    component: string,
    props: Record<string, any> = {},
    options: Partial<ModalState['options']> = {}
  ): void {
    state.value.modal = {
      isOpen: true,
      component,
      props,
      options: {
        size: 'md',
        closable: true,
        backdrop: true,
        persistent: false,
        ...options,
      },
    }
  }

  function closeModal(): void {
    if (!state.value.modal.options.persistent) {
      state.value.modal.isOpen = false
      state.value.modal.component = null
      state.value.modal.props = {}
    }
  }

  function updateModalProps(props: Record<string, any>): void {
    state.value.modal.props = { ...state.value.modal.props, ...props }
  }

  // Loading state management
  function startLoading(id: string, message: string, progress?: number): void {
    const existingIndex = state.value.loadingStates.findIndex(l => l.id === id)

    if (existingIndex > -1) {
      // Update existing loading state
      state.value.loadingStates[existingIndex] = { id, message, progress }
    } else {
      // Add new loading state
      state.value.loadingStates.push({ id, message, progress })
    }
  }

  function updateLoadingProgress(id: string, progress: number): void {
    const loadingState = state.value.loadingStates.find(l => l.id === id)
    if (loadingState) {
      loadingState.progress = progress
    }
  }

  function stopLoading(id: string): void {
    const index = state.value.loadingStates.findIndex(l => l.id === id)
    if (index > -1) {
      state.value.loadingStates.splice(index, 1)
    }
  }

  function clearAllLoading(): void {
    state.value.loadingStates = []
  }

  // Convenience loading methods
  function withLoading<T>(
    id: string,
    message: string,
    operation: () => Promise<T>
  ): Promise<T> {
    startLoading(id, message)

    return operation()
      .finally(() => {
        stopLoading(id)
      })
  }

  // UI state management
  function toggleSidebar(): void {
    state.value.sidebarOpen = !state.value.sidebarOpen
  }

  function setSidebarOpen(open: boolean): void {
    state.value.sidebarOpen = open
  }

  function setTheme(theme: 'light' | 'dark' | 'system'): void {
    state.value.theme = theme
  }

  function updateActivity(): void {
    state.value.lastActivity = Date.now()
  }

  // Global error handler
  function handleGlobalError(error: Error, context?: string): void {
    console.error('Global error:', error, context)

    showError(
      'An unexpected error occurred',
      context ? `${context}: ${error.message}` : error.message,
      10000
    )
  }

  // Keyboard shortcuts and accessibility
  function registerKeyboardShortcut(
    key: string,
    ctrlKey = false,
    shiftKey = false,
    altKey = false,
    handler: () => void
  ): void {
    const eventHandler = (event: KeyboardEvent) => {
      if (
        event.key === key &&
        event.ctrlKey === ctrlKey &&
        event.shiftKey === shiftKey &&
        event.altKey === altKey
      ) {
        event.preventDefault()
        handler()
      }
    }

    document.addEventListener('keydown', eventHandler)

    // Return cleanup function
    return () => {
      document.removeEventListener('keydown', eventHandler)
    }
  }

  return {
    // Reactive state (readonly)
    state: readonly(state),

    // Computed properties
    hasNotifications,
    notificationCount,
    hasLoadingStates,
    isLoading,
    isModalOpen,
    notificationsByType,

    // Notification methods
    addNotification,
    removeNotification,
    clearNotifications,
    clearNotificationsByType,
    showSuccess,
    showError,
    showWarning,
    showInfo,

    // Modal methods
    openModal,
    closeModal,
    updateModalProps,

    // Loading methods
    startLoading,
    updateLoadingProgress,
    stopLoading,
    clearAllLoading,
    withLoading,

    // UI state methods
    toggleSidebar,
    setSidebarOpen,
    setTheme,
    updateActivity,

    // Error handling
    handleGlobalError,

    // Keyboard shortcuts
    registerKeyboardShortcut,
  }
})
