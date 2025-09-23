<template>
  <div id="app">
    <!-- Show navigation only when authenticated and not on login page -->
    <Navigation v-if="isAuthenticated && $route.path !== '/login'" />

    <!-- Main content area -->
    <div class="main-content" :class="{ 'with-nav': isAuthenticated && $route.path !== '/login' }">
      <router-view />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import Navigation from '@/components/Navigation.vue'
import { useAuth } from '@/composables/useAuth'

const { isAuthenticated, initializeAuth } = useAuth()

onMounted(() => {
  // Initialize authentication state from localStorage
  initializeAuth()
})
</script>

<style>
html, body, #app {
  height: 100%;
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
}

#app {
  min-height: 100vh;
  background-color: #f9fafb;
}

.main-content {
  min-height: 100vh;
}

.main-content.with-nav {
  min-height: calc(100vh - 64px); /* Account for navigation height */
}
</style>


