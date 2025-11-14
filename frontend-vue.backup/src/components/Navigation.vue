<template>
  <nav class="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-30">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between h-16">
        <!-- Logo and brand -->
        <div class="flex items-center">
          <router-link
            to="/"
            class="flex items-center space-x-3 text-gray-900 dark:text-white hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            <div class="flex-shrink-0">
              <!-- Logo placeholder - replace with actual logo -->
              <svg class="h-8 w-8 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <div class="hidden sm:block">
              <h1 class="text-xl font-bold">FIO Analyzer</h1>
              <p class="text-xs text-gray-500 dark:text-gray-400">Storage Performance Dashboard</p>
            </div>
          </router-link>
        </div>

        <!-- Desktop navigation -->
        <div class="hidden md:flex items-center space-x-1">
          <!-- Navigation links -->
          <router-link
            v-for="item in navigationItems"
            :key="item.name"
            :to="item.href"
            class="nav-link"
            :class="navLinkClasses(item)"
          >
            <component :is="item.icon" class="w-4 h-4 mr-2" />
            {{ item.name }}
          </router-link>

          <!-- Theme toggle -->
          <button
            class="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors"
            aria-label="Toggle theme"
            @click="toggleTheme"
          >
            <component :is="themeIcon" class="w-5 h-5" />
          </button>
        </div>

        <!-- Mobile menu button -->
        <div class="md:hidden flex items-center">
          <button
            class="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors"
            aria-label="Open main menu"
            @click="toggleMobileMenu"
          >
            <svg
              class="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                v-if="!isMobileMenuOpen"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 6h16M4 12h16M4 18h16"
              />
              <path
                v-else
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <!-- User menu -->
        <div class="hidden md:flex items-center space-x-4">
          <!-- Notifications -->
          <button
            class="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors relative"
            aria-label="View notifications"
            @click="toggleNotifications"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-5-5V7a3 3 0 00-6 0v5l-5 5h5m0 0v1a3 3 0 006 0v-1m-6 0h6" />
            </svg>
            <span
              v-if="notificationCount > 0"
              class="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center"
            >
              {{ notificationCount > 9 ? '9+' : notificationCount }}
            </span>
          </button>

          <!-- User dropdown -->
          <div class="relative">
            <button
              class="flex items-center space-x-2 p-2 rounded-md text-gray-700 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700 transition-colors"
              aria-label="User menu"
              @click="toggleUserMenu"
            >
              <div class="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <span class="text-white text-sm font-medium">
                  {{ userInitials }}
                </span>
              </div>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <!-- User dropdown menu -->
            <Transition
              enter-active-class="transition ease-out duration-100"
              enter-from-class="transform opacity-0 scale-95"
              enter-to-class="transform opacity-100 scale-100"
              leave-active-class="transition ease-in duration-75"
              leave-from-class="transform opacity-100 scale-100"
              leave-to-class="opacity-0 scale-95"
            >
              <div
                v-if="isUserMenuOpen"
                class="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 z-50"
                role="menu"
              >
                <div class="py-1" role="none">
                  <!-- User info -->
                  <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                    <p class="text-sm font-medium text-gray-900 dark:text-white">
                      {{ user?.username || 'User' }}
                    </p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">
                      {{ user?.role || 'Role' }}
                    </p>
                  </div>

                  <!-- Menu items -->
                  <router-link
                    to="/upload"
                    class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                    role="menuitem"
                    @click="closeUserMenu"
                  >
                    Upload Data
                  </router-link>

                  <router-link
                    v-if="canManageUsers"
                    to="/user-manager"
                    class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                    role="menuitem"
                    @click="closeUserMenu"
                  >
                    User Management
                  </router-link>

                  <button
                    class="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                    role="menuitem"
                    @click="handleLogout"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </div>
    </div>

    <!-- Mobile menu -->
    <Transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isMobileMenuOpen"
        class="md:hidden border-t border-gray-200 dark:border-gray-700"
      >
        <div class="px-2 pt-2 pb-3 space-y-1">
          <!-- Mobile navigation links -->
          <router-link
            v-for="item in navigationItems"
            :key="item.name"
            :to="item.href"
            class="mobile-nav-link"
            :class="mobileNavLinkClasses(item)"
            @click="closeMobileMenu"
          >
            <component :is="item.icon" class="w-5 h-5 mr-3" />
            {{ item.name }}
          </router-link>

          <!-- Mobile user section -->
          <div class="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
            <div class="flex items-center px-3 py-2">
              <div class="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                <span class="text-white text-sm font-medium">
                  {{ userInitials }}
                </span>
              </div>
              <div class="ml-3">
                <p class="text-base font-medium text-gray-900 dark:text-white">
                  {{ user?.username || 'User' }}
                </p>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  {{ user?.role || 'Role' }}
                </p>
              </div>
            </div>

            <div class="mt-3 space-y-1">
              <router-link
                to="/upload"
                class="mobile-nav-link"
                @click="closeMobileMenu"
              >
                Upload Data
              </router-link>

              <router-link
                v-if="canManageUsers"
                to="/user-manager"
                class="mobile-nav-link"
                @click="closeMobileMenu"
              >
                User Management
              </router-link>

              <button
                class="mobile-nav-link w-full text-left"
                @click="handleLogout"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Click outside handler -->
    <div
      v-if="isUserMenuOpen || isMobileMenuOpen"
      class="fixed inset-0 z-20"
      @click="closeAllMenus"
    />
  </nav>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useTheme } from '@/composables/useTheme'
import { useUiStore } from '@/stores/ui'

// Icons
import {
  Home,
  BarChart3,
  Users,
  Settings,
  Sun,
  Moon,
  Computer as Monitor
} from 'lucide-vue-next'

const route = useRoute()
const { user, logout, hasPermission } = useAuth()
const { themeMode, toggleTheme: toggleThemeMode } = useTheme()
const uiStore = useUiStore()

// Reactive state
const isMobileMenuOpen = ref(false)
const isUserMenuOpen = ref(false)

// Computed properties
const canManageUsers = computed(() => hasPermission('admin'))
const userInitials = computed(() => {
  const username = user.value?.username || 'U'
  return username.charAt(0).toUpperCase()
})

const notificationCount = computed(() => 0) // TODO: Connect to actual notifications

const themeIcon = computed(() => {
  switch (themeMode.value) {
    case 'light':
      return Sun
    case 'dark':
      return Moon
    case 'system':
      return Monitor
    default:
      return Monitor
  }
})

// Navigation items
const navigationItems = computed(() => [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: Home,
  },
  {
    name: 'Host Analysis',
    href: '/host-analysis',
    icon: BarChart3,
  },
  {
    name: 'Test History',
    href: '/test-history',
    icon: Settings, // Using Settings temporarily, should be History icon
  },
  {
    name: 'Analytics',
    href: '/performance-analytics',
    icon: BarChart3,
  },
  {
    name: 'Users',
    href: '/user-manager',
    icon: Users,
    show: canManageUsers.value,
  },
].filter(item => item.show !== false))

interface NavItem {
  name: string
  href: string
  icon: typeof Home
  requiresAuth?: boolean
  requiresAdmin?: boolean
  show?: boolean
}

// Methods
function navLinkClasses(item: NavItem) {
  const isActive = route.path === item.href
  const baseClasses = 'flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors'

  if (isActive) {
    return `${baseClasses} bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200`
  }

  return `${baseClasses} text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700`
}

function mobileNavLinkClasses(item: NavItem) {
  const isActive = route.path === item.href
  const baseClasses = 'flex items-center px-3 py-2 rounded-md text-base font-medium'

  if (isActive) {
    return `${baseClasses} bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200`
  }

  return `${baseClasses} text-gray-600 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700`
}

function toggleMobileMenu() {
  isMobileMenuOpen.value = !isMobileMenuOpen.value
  if (isUserMenuOpen.value) isUserMenuOpen.value = false
}

function toggleUserMenu() {
  isUserMenuOpen.value = !isUserMenuOpen.value
}

function toggleNotifications() {
  // TODO: Implement notification panel
  uiStore.showSuccess('Notifications', 'Notification system coming soon!')
}

function toggleTheme() {
  toggleThemeMode()
}

function closeMobileMenu() {
  isMobileMenuOpen.value = false
}

function closeUserMenu() {
  isUserMenuOpen.value = false
}

function closeAllMenus() {
  isMobileMenuOpen.value = false
  isUserMenuOpen.value = false
}

async function handleLogout() {
  try {
    await logout()
    closeAllMenus()
    // Navigation will be handled by the logout function itself
  } catch (error) {
    console.error('Logout error:', error)
    uiStore.setErrorMessage('Unable to log out. Please try again.')
  }
}

// Event listeners
function handleResize() {
  if (window.innerWidth >= 768) { // md breakpoint
    isMobileMenuOpen.value = false
  }
}

function handleEscape(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closeAllMenus()
  }
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
  document.addEventListener('keydown', handleEscape)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  document.removeEventListener('keydown', handleEscape)
})
</script>

<style scoped>
.nav-link {
  @apply flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors;
}

.mobile-nav-link {
  @apply block px-3 py-2 rounded-md text-base font-medium;
}
</style>
