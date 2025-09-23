<template>
  <div :class="{ dark: darkMode }" class="app-shell">
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
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
const darkMode = ref(false);
const apiBase = import.meta.env.VITE_API_URL || '';
</script>

<style>
html, body, #app { height: 100%; margin: 0; }
</style>


