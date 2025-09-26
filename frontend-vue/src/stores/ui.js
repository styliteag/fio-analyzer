import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
export const useUiStore = defineStore('ui', () => {
    // Reactive state
    const state = ref({
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
        errorMessage: '',
        successMessage: '',
        isGlobalLoading: false,
    });
    // Computed properties
    const hasNotifications = computed(() => state.value.notifications.length > 0);
    const notificationCount = computed(() => state.value.notifications.length);
    const hasLoadingStates = computed(() => state.value.loadingStates.length > 0);
    const isLoading = computed(() => state.value.loadingStates.length > 0);
    const isModalOpen = computed(() => state.value.modal.isOpen);
    const errorMessage = computed(() => state.value.errorMessage);
    const successMessage = computed(() => state.value.successMessage);
    const isGlobalLoading = computed(() => state.value.isGlobalLoading);
    const notificationsByType = computed(() => {
        const grouped = {
            success: [],
            error: [],
            warning: [],
            info: [],
        };
        state.value.notifications.forEach(notification => {
            grouped[notification.type].push(notification);
        });
        return grouped;
    });
    // Notification management
    function addNotification(notification) {
        const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const fullNotification = {
            ...notification,
            id,
            timestamp: Date.now(),
        };
        state.value.notifications.push(fullNotification);
        // Auto-remove notification after duration
        if (fullNotification.duration && fullNotification.duration > 0) {
            setTimeout(() => {
                removeNotification(id);
            }, fullNotification.duration);
        }
        return id;
    }
    function removeNotification(id) {
        const index = state.value.notifications.findIndex(n => n.id === id);
        if (index > -1) {
            state.value.notifications.splice(index, 1);
        }
    }
    function clearNotifications() {
        state.value.notifications = [];
    }
    function clearNotificationsByType(type) {
        state.value.notifications = state.value.notifications.filter(n => n.type !== type);
    }
    // Convenience methods for different notification types
    function showSuccess(title, message, duration = 5000) {
        return addNotification({
            type: 'success',
            title,
            message,
            duration,
        });
    }
    function showError(title, message, duration = 8000) {
        return addNotification({
            type: 'error',
            title,
            message,
            duration,
        });
    }
    function showWarning(title, message, duration = 6000) {
        return addNotification({
            type: 'warning',
            title,
            message,
            duration,
        });
    }
    function showInfo(title, message, duration = 5000) {
        return addNotification({
            type: 'info',
            title,
            message,
            duration,
        });
    }
    // Modal management
    function openModal(component, props = {}, options = {}) {
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
        };
    }
    function closeModal() {
        if (!state.value.modal.options.persistent) {
            state.value.modal.isOpen = false;
            state.value.modal.component = null;
            state.value.modal.props = {};
        }
    }
    function updateModalProps(props) {
        state.value.modal.props = { ...state.value.modal.props, ...props };
    }
    // Loading state management
    function startLoading(id, message, progress) {
        const existingIndex = state.value.loadingStates.findIndex(l => l.id === id);
        if (existingIndex > -1) {
            // Update existing loading state
            state.value.loadingStates[existingIndex] = { id, message, progress };
        }
        else {
            // Add new loading state
            state.value.loadingStates.push({ id, message, progress });
        }
    }
    function updateLoadingProgress(id, progress) {
        const loadingState = state.value.loadingStates.find(l => l.id === id);
        if (loadingState) {
            loadingState.progress = progress;
        }
    }
    function stopLoading(id) {
        const index = state.value.loadingStates.findIndex(l => l.id === id);
        if (index > -1) {
            state.value.loadingStates.splice(index, 1);
        }
    }
    function clearAllLoading() {
        state.value.loadingStates = [];
    }
    // Convenience loading methods
    function withLoading(id, message, operation) {
        startLoading(id, message);
        return operation()
            .finally(() => {
            stopLoading(id);
        });
    }
    // UI state management
    function toggleSidebar() {
        state.value.sidebarOpen = !state.value.sidebarOpen;
    }
    function setSidebarOpen(open) {
        state.value.sidebarOpen = open;
    }
    function setTheme(theme) {
        state.value.theme = theme;
    }
    function updateActivity() {
        state.value.lastActivity = Date.now();
    }
    // Message management
    function setErrorMessage(message) {
        state.value.errorMessage = message;
    }
    function setSuccessMessage(message) {
        state.value.successMessage = message;
    }
    function setGlobalLoading(loading) {
        state.value.isGlobalLoading = loading;
    }
    // Global error handler
    function handleGlobalError(error, context) {
        console.error('Global error:', error, context);
        showError('An unexpected error occurred', context ? `${context}: ${error.message}` : error.message, 10000);
    }
    // Keyboard shortcuts and accessibility
    function registerKeyboardShortcut(key, ctrlKey = false, shiftKey = false, altKey = false, handler) {
        const eventHandler = (event) => {
            if (event.key === key &&
                event.ctrlKey === ctrlKey &&
                event.shiftKey === shiftKey &&
                event.altKey === altKey) {
                event.preventDefault();
                handler();
            }
        };
        document.addEventListener('keydown', eventHandler);
        // Return cleanup function
        return () => {
            document.removeEventListener('keydown', eventHandler);
        };
    }
    return {
        // Reactive state
        state,
        // Computed properties
        hasNotifications,
        notificationCount,
        hasLoadingStates,
        isLoading,
        isModalOpen,
        notificationsByType,
        errorMessage,
        successMessage,
        isGlobalLoading,
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
        setErrorMessage,
        setSuccessMessage,
        setGlobalLoading,
        // Error handling
        handleGlobalError,
        // Keyboard shortcuts
        registerKeyboardShortcut,
    };
});
