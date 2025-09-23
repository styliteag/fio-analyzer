<template>
  <div class="theme-toggle">
    <button
      :aria-label="`Switch to ${nextThemeLabel} theme`"
      class="theme-toggle-btn"
      :class="{ 'theme-transition': enableTransitions }"
      data-theme-transition
      @click="toggleTheme"
    >
      <!-- Sun icon for light theme -->
      <Sun
        v-if="actualTheme === 'light'"
        class="w-5 h-5 transition-transform duration-200 hover:scale-110"
      />

      <!-- Moon icon for dark theme -->
      <Moon
        v-else-if="actualTheme === 'dark'"
        class="w-5 h-5 transition-transform duration-200 hover:scale-110"
      />

      <!-- Monitor icon for system theme -->
      <Monitor
        v-else
        class="w-5 h-5 transition-transform duration-200 hover:scale-110"
      />

      <!-- Optional label -->
      <span
        v-if="showLabel"
        class="ml-2 text-sm hidden sm:inline"
      >
        {{ currentThemeLabel }}
      </span>
    </button>

    <!-- Dropdown menu (optional expanded view) -->
    <div
      v-if="showDropdown"
      class="theme-dropdown"
    >
      <div class="relative">
        <button
          class="theme-dropdown-btn"
          :class="{ 'theme-transition': enableTransitions }"
          data-theme-transition
          @click="isDropdownOpen = !isDropdownOpen"
        >
          <component :is="currentIcon" class="w-4 h-4" />
          <span class="ml-2 text-sm">{{ currentThemeLabel }}</span>
          <ChevronDown class="w-4 h-4 ml-2 transition-transform" :class="{ 'rotate-180': isDropdownOpen }" />
        </button>

        <!-- Dropdown menu -->
        <transition
          enter-active-class="transition ease-out duration-100"
          enter-from-class="transform opacity-0 scale-95"
          enter-to-class="transform opacity-100 scale-100"
          leave-active-class="transition ease-in duration-75"
          leave-from-class="transform opacity-100 scale-100"
          leave-to-class="transform opacity-0 scale-95"
        >
          <div
            v-if="isDropdownOpen"
            class="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50"
            @click.stop
          >
            <div class="py-1">
              <button
                v-for="themeOption in themeOptions"
                :key="themeOption.value"
                class="theme-option"
                :class="{ active: theme.value === themeOption.value }"
                @click="selectTheme(themeOption.value)"
              >
                <component :is="themeOption.icon" class="w-4 h-4" />
                <span class="ml-3">{{ themeOption.label }}</span>
                <Check v-if="theme.value === themeOption.value" class="w-4 h-4 ml-auto" />
              </button>
            </div>
          </div>
        </transition>
      </div>

      <!-- Invisible overlay to close dropdown -->
      <div
        v-if="isDropdownOpen"
        class="fixed inset-0 z-40"
        @click="isDropdownOpen = false"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Sun, Moon, Monitor, ChevronDown, Check } from 'lucide-vue-next'
import { useTheme } from '@/composables/useTheme'

interface Props {
  showLabel?: boolean
  showDropdown?: boolean
  enableTransitions?: boolean
}

withDefaults(defineProps<Props>(), {
  showLabel: false,
  showDropdown: false,
  enableTransitions: true
})

const { theme, actualTheme, setTheme, toggleTheme } = useTheme()

// Local state
const isDropdownOpen = ref(false)

// Theme options for dropdown
const themeOptions = [
  {
    value: 'light' as const,
    label: 'Light',
    icon: Sun
  },
  {
    value: 'dark' as const,
    label: 'Dark',
    icon: Moon
  },
  {
    value: 'system' as const,
    label: 'System',
    icon: Monitor
  }
]

// Computed properties
const currentThemeLabel = computed(() => {
  const option = themeOptions.find(opt => opt.value === theme.value)
  return option?.label || 'System'
})

const nextThemeLabel = computed(() => {
  const currentIndex = themeOptions.findIndex(opt => opt.value === theme.value)
  const nextIndex = (currentIndex + 1) % themeOptions.length
  return themeOptions[nextIndex].label.toLowerCase()
})

const currentIcon = computed(() => {
  if (actualTheme.value === 'light') return Sun
  if (actualTheme.value === 'dark') return Moon
  return Monitor
})

// Methods
const selectTheme = (selectedTheme: 'light' | 'dark' | 'system') => {
  setTheme(selectedTheme)
  isDropdownOpen.value = false
}

// Event listeners for closing dropdown
const handleEscape = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    isDropdownOpen.value = false
  }
}

const handleClickOutside = (event: Event) => {
  const target = event.target as HTMLElement
  if (!target.closest('.theme-dropdown')) {
    isDropdownOpen.value = false
  }
}

// Lifecycle
onMounted(() => {
  document.addEventListener('keydown', handleEscape)
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscape)
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.theme-toggle {
  @apply inline-flex items-center;
}

.theme-toggle-btn {
  @apply p-2 rounded-lg transition-colors duration-200;
  @apply bg-gray-100 hover:bg-gray-200 text-gray-700;
  @apply dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300;
  @apply focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2;
  @apply dark:focus:ring-offset-gray-900;
}

.theme-dropdown {
  @apply relative;
}

.theme-dropdown-btn {
  @apply flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200;
  @apply bg-gray-100 hover:bg-gray-200 text-gray-700;
  @apply dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300;
  @apply focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2;
  @apply dark:focus:ring-offset-gray-900;
}

.theme-option {
  @apply w-full flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300;
  @apply hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100;
  @apply transition-colors duration-150;
}

.theme-option.active {
  @apply bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300;
}

.theme-transition {
  @apply transition-all duration-300 ease-in-out;
}
</style>
