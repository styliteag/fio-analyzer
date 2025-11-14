import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../pages/Login.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    name: 'Comparison',
    component: () => import('../pages/SimpleComparison.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/advanced',
    name: 'AdvancedComparison',
    component: () => import('../pages/Comparison.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/upload',
    name: 'Upload',
    component: () => import('../pages/Upload.vue'),
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Navigation guard for authentication
router.beforeEach((to, _from, next) => {
  const authStore = useAuthStore()

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next({ name: 'Login' })
  } else if (to.name === 'Login' && authStore.isAuthenticated) {
    next({ name: 'Comparison' })
  } else {
    next()
  }
})

export default router
