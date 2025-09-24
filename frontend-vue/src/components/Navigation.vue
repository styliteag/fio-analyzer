<template>
  <nav class="bg-blue-800 text-white">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <!-- Logo and main navigation -->
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <router-link to="/" class="text-xl font-bold">
              FIO Analyzer
            </router-link>
          </div>
          <div class="hidden md:block">
            <div class="ml-10 flex items-baseline space-x-4">
              <router-link
                v-for="item in navigation"
                :key="item.name"
                :to="item.href"
                class="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                :class="{
                  'bg-blue-900': $route.path === item.href,
                  'text-blue-200 hover:text-white': $route.path !== item.href
                }"
              >
                {{ item.name }}
              </router-link>
            </div>
          </div>
        </div>

        <!-- User menu -->
        <div class="hidden md:block">
          <div class="ml-4 flex items-center md:ml-6">
            <div class="relative ml-3">
              <div class="flex items-center space-x-4">
                <span class="text-sm text-blue-200">
                  {{ user?.username }} ({{ user?.role }})
                </span>
                <button
                  class="bg-blue-700 hover:bg-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  @click="handleLogout"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Mobile menu button -->
        <div class="md:hidden">
          <button
            class="bg-blue-800 inline-flex items-center justify-center p-2 rounded-md text-blue-200 hover:text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-blue-800 focus:ring-white"
            @click="mobileMenuOpen = !mobileMenuOpen"
          >
            <span class="sr-only">Open main menu</span>
            <svg
              class="h-6 w-6"
              :class="{ 'hidden': mobileMenuOpen, 'block': !mobileMenuOpen }"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <svg
              class="h-6 w-6"
              :class="{ 'block': mobileMenuOpen, 'hidden': !mobileMenuOpen }"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Mobile menu -->
    <div v-show="mobileMenuOpen" class="md:hidden">
      <div class="px-2 pt-2 pb-3 space-y-1 sm:px-3">
        <router-link
          v-for="item in navigation"
          :key="item.name"
          :to="item.href"
          class="block px-3 py-2 rounded-md text-base font-medium hover:bg-blue-700 transition-colors"
          :class="{
            'bg-blue-900': $route.path === item.href,
            'text-blue-200 hover:text-white': $route.path !== item.href
          }"
          @click="mobileMenuOpen = false"
        >
          {{ item.name }}
        </router-link>
      </div>
      <div class="pt-4 pb-3 border-t border-blue-700">
        <div class="flex items-center px-5">
          <div class="flex-shrink-0">
            <span class="text-sm text-blue-200">
              {{ user?.username }} ({{ user?.role }})
            </span>
          </div>
        </div>
        <div class="mt-3 px-2 space-y-1">
          <button
            class="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-blue-200 hover:text-white hover:bg-blue-700 transition-colors"
            @click="handleLogout"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const router = useRouter()
const { user, logout, hasPermission } = useAuth()

const mobileMenuOpen = ref(false)

const navigation = computed(() => {
  const baseNavigation: Array<{ name: string; href: string }> = []

  // Add admin-only navigation items
  if (hasPermission('admin')) {
    baseNavigation.push({ name: 'User Management', href: '/user-manager' })
  }

  return baseNavigation
})

const handleLogout = () => {
  logout()
  router.push('/login')
  mobileMenuOpen.value = false
}
</script>