import { createRouter, createWebHistory } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
const routes = [
    {
        path: '/',
        name: 'Home',
        redirect: '/dashboard'
    },
    {
        path: '/login',
        name: 'Login',
        component: () => import(/* webpackChunkName: "auth" */ './components/LoginForm.vue'),
        meta: { requiresAuth: false, preload: true }
    },
    {
        path: '/dashboard',
        name: 'Dashboard',
        component: () => import(/* webpackChunkName: "dashboard" */ './pages/Dashboard.vue'),
        meta: { requiresAuth: true, preload: true }
    },
    {
        path: '/host-analysis',
        name: 'HostAnalysis',
        component: () => import(/* webpackChunkName: "analysis" */ './pages/HostAnalysis.vue'),
        meta: { requiresAuth: true, preload: false }
    },
    {
        path: '/test-history',
        name: 'TestHistory',
        component: () => import(/* webpackChunkName: "history" */ './pages/TestHistory.vue'),
        meta: { requiresAuth: true, preload: false }
    },
    {
        path: '/performance-analytics',
        name: 'PerformanceAnalytics',
        component: () => import(/* webpackChunkName: "analytics" */ './pages/PerformanceAnalytics.vue'),
        meta: { requiresAuth: true, preload: false }
    },
    {
        path: '/user-manager',
        name: 'UserManager',
        component: () => import(/* webpackChunkName: "admin" */ './pages/UserManager.vue'),
        meta: { requiresAuth: true, requiresAdmin: true, preload: false }
    },
    {
        path: '/upload',
        name: 'Upload',
        component: () => import(/* webpackChunkName: "upload" */ './pages/UploadData.vue'),
        meta: { requiresAuth: true, preload: false }
    },
    // Catch-all route for 404 handling
    {
        path: '/:pathMatch(.*)*',
        name: 'NotFound',
        component: () => import('./pages/NotFound.vue'),
        meta: { requiresAuth: false }
    }
];
export const router = createRouter({
    history: createWebHistory(),
    routes,
});
// eslint-disable-next-line @typescript-eslint/no-unused-vars
router.beforeEach(async (to, _from) => {
    const { isAuthenticated, hasPermission, user, initialize, isInitialized } = useAuth();
    // Only initialize auth state if not already initialized
    if (!isInitialized.value) {
        console.log('🔄 Router: Initializing auth before navigation...');
        await initialize();
    }
    const meta = to.meta;
    const requiresAdmin = meta?.requiresAdmin === true;
    const requiresAuth = meta?.requiresAuth !== false; // Default to requiring auth
    console.log('🛣️ Router: Checking route access', {
        path: to.path,
        requiresAuth,
        requiresAdmin,
        isAuthenticated: isAuthenticated.value,
        user: user.value?.username
    });
    // If user is authenticated and trying to access login page, redirect to dashboard
    if (to.path === '/login' && isAuthenticated.value) {
        console.log('🔄 Router: Redirecting authenticated user from login to dashboard');
        return { path: '/dashboard' };
    }
    // Allow access to login page and 404 page without authentication
    if (!requiresAuth || to.path === '/login') {
        console.log('✅ Router: Allowing access to public route');
        return true;
    }
    // Check if route requires authentication
    if (requiresAuth && !isAuthenticated.value) {
        console.log('❌ Router: Authentication required, redirecting to login');
        // Store the attempted URL for redirect after login
        return {
            path: '/login',
            query: { redirect: to.fullPath !== '/' ? to.fullPath : undefined }
        };
    }
    // Check if route requires admin privileges
    if (requiresAdmin && !hasPermission('admin')) {
        console.warn(`❌ Router: Access denied to ${to.path}: User ${user.value?.username} does not have admin privileges`);
        // Redirect non-admin users to dashboard instead of login
        if (user.value?.role === 'uploader') {
            return {
                path: '/dashboard',
                query: {
                    error: 'access-denied',
                    message: 'Admin access required'
                }
            };
        }
        // If not authenticated properly, go to login
        return { path: '/login' };
    }
    // Check for upload permission on upload routes
    if (to.path === '/upload' && !hasPermission('upload')) {
        console.warn(`❌ Router: Access denied to ${to.path}: User does not have upload privileges`);
        return {
            path: '/dashboard',
            query: {
                error: 'access-denied',
                message: 'Upload permission required'
            }
        };
    }
    console.log('✅ Router: Access granted');
    return true;
});
// Intelligent preloading based on user behavior and route patterns
const preloadQueue = new Set();
let preloadTimeout = null;
function preloadRoute(routeName) {
    if (preloadQueue.has(routeName))
        return;
    const route = routes.find(r => r.name === routeName);
    if (route && route.meta?.preload !== false) {
        preloadQueue.add(routeName);
        // Delay preloading to avoid blocking main thread
        if (preloadTimeout)
            clearTimeout(preloadTimeout);
        preloadTimeout = setTimeout(() => {
            if (typeof route.component === 'function') {
                try {
                    const componentOrPromise = route.component();
                    if (componentOrPromise && typeof componentOrPromise.then === 'function') {
                        componentOrPromise
                            .then(() => console.log(`Preloaded: ${routeName}`))
                            .catch(() => console.warn(`Failed to preload: ${routeName}`));
                    }
                }
                catch (error) {
                    console.warn(`Failed to preload: ${routeName}`, error);
                }
            }
        }, 100);
    }
}
function preloadCriticalRoutes() {
    // Simple preloading without composables - preload critical routes
    const criticalRoutes = ['Dashboard', 'HostAnalysis', 'TestHistory'];
    criticalRoutes.forEach(route => {
        setTimeout(() => preloadRoute(route), Math.random() * 2000 + 1000);
    });
}
// Handle redirect after successful login
router.afterEach((to, from) => {
    // Clear any error messages from query params after navigation
    if (to.query.error && from.path !== '/login') {
        const query = { ...to.query };
        delete query.error;
        delete query.message;
        // Only replace if there were other query params
        if (Object.keys(query).length > 0 || to.query.error) {
            router.replace({ path: to.path, query: Object.keys(query).length > 0 ? query : undefined });
        }
    }
    // Set page title based on route name
    if (to.name) {
        const titles = {
            Dashboard: 'Dashboard',
            HostAnalysis: 'Host Analysis',
            TestHistory: 'Test History',
            PerformanceAnalytics: 'Performance Analytics',
            UserManager: 'User Management',
            Upload: 'Upload Data',
            Login: 'Sign In'
        };
        const title = titles[to.name] || 'FIO Analyzer';
        document.title = `${title} - FIO Analyzer`;
    }
    // Trigger intelligent preloading after navigation
    setTimeout(preloadCriticalRoutes, 500);
});
