import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/user-manager',
    meta: { requiresAuth: true, requiresAdmin: true }
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
    // For now, redirect to login if user doesn't have admin access
    // This could be changed to show a "access denied" page in the future
    return { path: '/login' }
  }

  return true
})


