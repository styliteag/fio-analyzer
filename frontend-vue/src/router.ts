import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    redirect: '/dashboard'
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('./components/LoginForm.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('./pages/Dashboard.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/host-analysis',
    name: 'HostAnalysis',
    component: () => import('./pages/HostAnalysis.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/test-history',
    name: 'TestHistory',
    component: () => import('./pages/TestHistory.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/performance-analytics',
    name: 'PerformanceAnalytics',
    component: () => import('./pages/PerformanceAnalytics.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/user-manager',
    name: 'UserManager',
    component: () => import('./pages/UserManager.vue'),
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/upload',
    name: 'Upload',
    component: () => import('./components/UploadData.vue'),
    meta: { requiresAuth: true }
  },
  // Catch-all route for 404 handling
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('./pages/NotFound.vue'),
    meta: { requiresAuth: false }
  }
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to, from) => {
  const { isAuthenticated, hasPermission, user, initialize } = useAuth()

  // Initialize auth state on first load
  await initialize()

  const meta = to.meta as Record<string, unknown>
  const requiresAdmin = meta?.requiresAdmin === true
  const requiresAuth = meta?.requiresAuth !== false // Default to requiring auth

  // If user is authenticated and trying to access login page, redirect to dashboard
  if (to.path === '/login' && isAuthenticated.value) {
    return { path: '/dashboard' }
  }

  // Allow access to login page and 404 page without authentication
  if (!requiresAuth || to.path === '/login') {
    return true
  }

  // Check if route requires authentication
  if (requiresAuth && !isAuthenticated.value) {
    // Store the attempted URL for redirect after login
    return {
      path: '/login',
      query: { redirect: to.fullPath !== '/' ? to.fullPath : undefined }
    }
  }

  // Check if route requires admin privileges
  if (requiresAdmin && !hasPermission('admin')) {
    console.warn(`Access denied to ${to.path}: User ${user.value?.username} does not have admin privileges`)

    // Redirect non-admin users to dashboard instead of login
    if (user.value?.role === 'uploader') {
      return {
        path: '/dashboard',
        query: {
          error: 'access-denied',
          message: 'Admin access required'
        }
      }
    }

    // If not authenticated properly, go to login
    return { path: '/login' }
  }

  // Check for upload permission on upload routes
  if (to.path === '/upload' && !hasPermission('upload')) {
    console.warn(`Access denied to ${to.path}: User does not have upload privileges`)
    return {
      path: '/dashboard',
      query: {
        error: 'access-denied',
        message: 'Upload permission required'
      }
    }
  }

  return true
})

// Handle redirect after successful login
router.afterEach((to, from) => {
  // Clear any error messages from query params after navigation
  if (to.query.error && from.path !== '/login') {
    const query = { ...to.query }
    delete query.error
    delete query.message

    // Only replace if there were other query params
    if (Object.keys(query).length > 0 || to.query.error) {
      router.replace({ path: to.path, query: Object.keys(query).length > 0 ? query : undefined })
    }
  }

  // Set page title based on route name
  if (to.name) {
    const titles: Record<string, string> = {
      Dashboard: 'Dashboard',
      HostAnalysis: 'Host Analysis',
      TestHistory: 'Test History',
      PerformanceAnalytics: 'Performance Analytics',
      UserManager: 'User Management',
      Upload: 'Upload Data',
      Login: 'Sign In'
    }

    const title = titles[to.name as string] || 'FIO Analyzer'
    document.title = `${title} - FIO Analyzer`
  }
})


