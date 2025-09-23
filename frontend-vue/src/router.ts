import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  { path: '/', component: () => import('./pages/Home.vue') },
  { path: '/performance', component: () => import('./pages/Performance.vue') },
  { path: '/compare', component: () => import('./pages/Compare.vue') },
  { path: '/history', component: () => import('./pages/History.vue') },
  { path: '/host', component: () => import('./pages/Host.vue') },
  { path: '/filters', component: () => import('./pages/Filters.vue') },
  { path: '/test-runs', component: () => import('./pages/TestRuns.vue') },
  { path: '/upload', component: () => import('./pages/Upload.vue') },
  { path: '/admin', component: () => import('./pages/Admin.vue') },
  { path: '/users', component: () => import('./pages/UserManager.vue') },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});


