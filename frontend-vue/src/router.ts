import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/test-runs',
    meta: { requiresAuth: true }
  },
  {
    path: '/test-runs',
    component: () => import('./pages/TestRuns.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/host',
    component: () => import('./pages/Host.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/filters',
    component: () => import('./pages/Filters.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/user-manager',
    component: () => import('./pages/UserManager.vue'),
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/login',
    component: () => import('./components/LoginForm.vue'),
    meta: { requiresAuth: false }
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  const { isAuthenticated, hasPermission } = useAuth()
  const meta = to.meta as Record<string, unknown>
  const requiresAdmin = meta?.requiresAdmin === true
  const requiresAuth = meta?.requiresAuth !== false // Default to requiring auth

  // Allow access to login page without authentication
  if (to.path === '/login') {
    return true
  }

  // Check if route requires authentication
  if (requiresAuth && !isAuthenticated.value) {
    return { path: '/login' }
  }

  // Check if route requires admin privileges
  if (requiresAdmin && !hasPermission('admin')) {
    return { path: '/test-runs' } // Redirect to accessible page
  }

  return true
})


