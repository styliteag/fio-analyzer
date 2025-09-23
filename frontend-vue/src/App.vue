<template>
  <div class="app-shell">
    <header class="app-header navbar">
      <strong>FIO Analyzer</strong>
      <router-link to="/">Home</router-link>
      <router-link to="/filters">Filters</router-link>
      <router-link to="/test-runs">Test Runs</router-link>
      <router-link to="/performance">Performance</router-link>
      <router-link to="/history">Time Series</router-link>
      <router-link to="/upload">Upload</router-link>
      <router-link to="/admin">Admin</router-link>
      <router-link to="/users">Users</router-link>
      <span style="flex:1"></span>
      <button class="button" @click="darkMode = !darkMode">{{ darkMode ? 'Light' : 'Dark' }}</button>
      <router-link to="/login">Login</router-link>
    </header>
    <aside class="app-sidebar">
      <div>API: {{ apiBase || '/api (proxy)' }}</div>
    </aside>
    <main class="app-main">
      <router-view />
    </main>
    <footer class="app-footer">
      <span>FIO Analyzer</span>
      <span style="margin-left:auto">API: {{ apiBase || '/api (proxy)' }}</span>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, watchEffect, onMounted } from 'vue';
const darkMode = ref<boolean>(() => localStorage.getItem('theme') === 'dark');
const apiBase = import.meta.env.VITE_API_URL || '';

onMounted(() => {
  const saved = localStorage.getItem('theme');
  if (saved === 'dark') document.documentElement.classList.add('dark');
});

watchEffect(() => {
  if (darkMode.value) {
    document.documentElement.classList.add('dark');
    localStorage.setItem('theme', 'dark');
  } else {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', 'light');
  }
});
</script>

<style>
html, body, #app { height: 100%; margin: 0; }
.app-shell { display: grid; grid-template-rows: auto 1fr auto; min-height: 100%; }
.app-header, .app-footer { display:flex; gap:12px; align-items:center; padding:8px 12px; border-bottom: 1px solid #e5e7eb; }
.app-footer { border-top: 1px solid #e5e7eb; border-bottom: none; }
.app-main { padding: 16px; }
.app-sidebar { display:none; }
</style>


