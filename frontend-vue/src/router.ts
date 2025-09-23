import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { Api } from './services/api';

const routes: RouteRecordRaw[] = [
  { path: '/', component: () => import('./pages/Home.vue') },
  { path: '/performance', component: () => import('./pages/Performance.vue') },
  { path: '/compare', component: () => import('./pages/Compare.vue') },
  { path: '/history', component: () => import('./pages/History.vue') },
  { path: '/host', component: () => import('./pages/Host.vue') },
  { path: '/filters', component: () => import('./pages/Filters.vue') },
  { path: '/test-runs', component: () => import('./pages/TestRuns.vue') },
  { path: '/upload', component: () => import('./pages/Upload.vue'), meta: { requiresAuth: true } },
  { path: '/admin', component: () => import('./pages/Admin.vue'), meta: { requiresAdmin: true } },
  { path: '/users', component: () => import('./pages/UserManager.vue'), meta: { requiresAdmin: true } },
  { path: '/login', component: () => import('./pages/Login.vue') },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  const meta = to.meta as Record<string, unknown>;
  const requiresAdmin = meta?.requiresAdmin === true;
  const requiresAuth = meta?.requiresAuth === true || requiresAdmin;
  if (!requiresAuth) return true;
  try {
    const me = await Api.me();
    if (requiresAdmin && me?.role !== 'admin') return { path: '/login' };
    return true;
  } catch {
    return { path: '/login' };
  }
});


