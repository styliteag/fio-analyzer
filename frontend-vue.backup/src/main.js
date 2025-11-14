import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router';
// Import global styles
import './styles.css';
// Components are imported individually where needed
// Create Vue app instance
const app = createApp(App);
// Create and configure Pinia store
const pinia = createPinia();
// Add Pinia plugins for development
if (import.meta.env.DEV) {
    // Enable persistence for stores in development
    pinia.use(({ store }) => {
        // Store hydration from localStorage for development debugging
        const stored = localStorage.getItem(`pinia-${store.$id}`);
        if (stored) {
            try {
                store.$patch(JSON.parse(stored));
            }
            catch (error) {
                console.warn(`Failed to hydrate store ${store.$id}:`, error);
            }
        }
        // Save store state to localStorage on changes (development only)
        store.$subscribe((mutation, state) => {
            localStorage.setItem(`pinia-${store.$id}`, JSON.stringify(state));
        });
    });
}
// Note: Global components removed to avoid HTML element name conflicts
// Components should be imported individually where needed
// Global error handler
app.config.errorHandler = (err, instance, info) => {
    console.error('Global Vue Error:', err);
    console.error('Component Info:', info);
    console.error('Instance:', instance);
    // In production, you might want to send this to a logging service
    if (import.meta.env.PROD) {
        // TODO: Send to error reporting service (e.g., Sentry)
        console.error('Production error occurred:', {
            error: err,
            info,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href
        });
    }
};
// Global warning handler (development only)
if (import.meta.env.DEV) {
    app.config.warnHandler = (msg, instance, trace) => {
        console.warn('Vue Warning:', msg);
        console.warn('Trace:', trace);
    };
}
// Use plugins
app.use(pinia);
app.use(router);
// Add development debugging helpers
if (import.meta.env.DEV) {
    // Add global properties for debugging
    app.config.globalProperties.$log = console.log;
    app.config.globalProperties.$store = pinia;
    app.config.globalProperties.$router = router;
    // Development performance monitoring
    app.config.performance = true;
}
// Global properties available in all components
app.config.globalProperties.$filters = {
    // Date formatting
    formatDate: (date) => {
        return new Date(date).toLocaleDateString();
    },
    // Number formatting
    formatNumber: (num) => {
        return new Intl.NumberFormat().format(num);
    },
    // Capitalize first letter
    capitalize: (str) => {
        return str.charAt(0).toUpperCase() + str.slice(1);
    },
    // Format bytes
    formatBytes: (bytes, decimals = 2) => {
        if (bytes === 0)
            return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
};
// Mount the application
app.mount('#app');
// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled Promise Rejection:', event.reason);
    // Prevent the default browser behavior
    event.preventDefault();
    // In production, you might want to send this to a logging service
    if (import.meta.env.PROD) {
        // TODO: Send to error reporting service
        console.error('Unhandled promise rejection in production:', {
            reason: event.reason,
            timestamp: new Date().toISOString(),
            url: window.location.href
        });
    }
});
// Handle global errors
window.addEventListener('error', (event) => {
    console.error('Global JavaScript Error:', event.error);
    // In production, send to logging service
    if (import.meta.env.PROD) {
        console.error('Global error in production:', {
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            error: event.error,
            timestamp: new Date().toISOString(),
            url: window.location.href
        });
    }
});
// Performance monitoring in development
if (import.meta.env.DEV) {
    // Monitor route changes for performance
    router.beforeEach((to, _from, next) => {
        console.time(`Route: ${to.path}`);
        next();
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    router.afterEach((to, _from) => {
        console.timeEnd(`Route: ${to.path}`);
    });
    // Log Pinia store actions in development
    console.log('Pinia stores initialized');
    console.log('Available routes:', router.getRoutes().map(r => r.path));
}
// Export for potential external access
export { app, pinia, router };
