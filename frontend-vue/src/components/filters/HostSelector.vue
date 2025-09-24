<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <h4 class="text-sm font-medium text-gray-900 dark:text-white">
        Selected Hosts
      </h4>

      <button
        v-if="selectedHosts.length > 0"
        class="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        @click="clearAll"
      >
        Clear all
      </button>
    </div>

    <!-- Selected hosts tags -->
    <div class="flex flex-wrap gap-2 min-h-[2rem]">
      <span
        v-for="host in selectedHosts"
        :key="host"
        class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
      >
        {{ formatHost(host) }}
        <button
          class="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          aria-label="Remove host"
          @click="removeHost(host)"
        >
          <XIcon class="w-3 h-3" />
        </button>
      </span>

      <!-- Empty state -->
      <span
        v-if="selectedHosts.length === 0"
        class="text-sm text-gray-500 dark:text-gray-400 italic"
      >
        No hosts selected
      </span>
    </div>

    <!-- Quick select buttons -->
    <div class="flex flex-wrap gap-2">
      <button
        v-for="preset in hostPresets"
        :key="preset.name"
        class="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600"
        @click="applyPreset(preset.hosts)"
      >
        {{ preset.name }}
        <span class="ml-1 text-gray-500 dark:text-gray-400">
          ({{ preset.hosts.length }})
        </span>
      </button>
    </div>

    <!-- Host selection dropdown -->
    <div class="relative">
      <button
        class="relative w-full bg-white border border-gray-300 rounded-md pl-3 pr-10 py-2 text-left cursor-default focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        @click="toggleDropdown"
      >
        <span class="block truncate">
          {{ selectedHosts.length > 0 ? `${selectedHosts.length} host${selectedHosts.length > 1 ? 's' : ''} selected` : 'Select hosts...' }}
        </span>
        <span class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
          <ChevronDownIcon class="h-5 w-5 text-gray-400" :class="{ 'rotate-180': isDropdownOpen }" />
        </span>
      </button>

      <!-- Dropdown menu -->
      <Transition
        enter-active-class="transition ease-out duration-100"
        enter-from-class="transform opacity-0 scale-95"
        enter-to-class="transform opacity-100 scale-100"
        leave-active-class="transition ease-in duration-75"
        leave-from-class="transform opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div
          v-if="isDropdownOpen"
          class="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none dark:bg-gray-700"
          role="listbox"
        >
          <!-- Search input -->
          <div class="sticky top-0 z-10 bg-white border-b border-gray-200 px-3 py-2 dark:bg-gray-700 dark:border-gray-600">
            <div class="relative">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <SearchIcon class="h-4 w-4 text-gray-400" />
              </div>
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Search hosts..."
                class="block w-full pl-10 pr-3 py-2 border-0 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-0 text-sm dark:bg-gray-700 dark:placeholder-gray-400 dark:text-white"
                @keydown.stop
              />
            </div>
          </div>

          <!-- Host options -->
          <div class="py-1">
            <div
              v-for="host in filteredHosts"
              :key="host"
              class="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-gray-100 dark:hover:bg-gray-600"
              :class="{ 'bg-blue-50 dark:bg-blue-900': isSelected(host) }"
              @click="toggleHost(host)"
            >
              <div class="flex items-center">
                <span class="block font-normal truncate">
                  {{ formatHost(host) }}
                </span>
                <span
                  v-if="getHostStats(host)"
                  class="ml-2 text-xs text-gray-500 dark:text-gray-400"
                >
                  ({{ getHostStats(host)?.count }} tests)
                </span>
              </div>

              <span
                v-if="isSelected(host)"
                class="absolute inset-y-0 right-0 flex items-center pr-4"
              >
                <CheckIcon class="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </span>
            </div>
          </div>

          <!-- No results -->
          <div
            v-if="filteredHosts.length === 0 && searchQuery"
            class="py-6 px-3 text-center text-sm text-gray-500 dark:text-gray-400"
          >
            No hosts found for "{{ searchQuery }}"
          </div>
        </div>
      </Transition>
    </div>

    <!-- Host statistics -->
    <div
      v-if="selectedHosts.length > 0"
      class="text-xs text-gray-500 dark:text-gray-400 space-y-1"
    >
      <div>Total selected: {{ selectedHosts.length }}</div>
      <div>Total tests: {{ selectedHostsStats.totalTests }}</div>
      <div>Avg IOPS: {{ selectedHostsStats.avgIops }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useTestRunsStore } from '@/stores/testRuns'
import { formatIOPS } from '@/utils/formatters'
import { X, ChevronDown, Search, Check } from 'lucide-vue-next'

interface Props {
  modelValue: string[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const testRunsStore = useTestRunsStore()
const isDropdownOpen = ref(false)
const searchQuery = ref('')

const selectedHosts = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

// Available hosts
const availableHosts = computed(() => {
  return [...new Set(testRunsStore.state.data.map(run => run.hostname))].sort()
})

const filteredHosts = computed(() => {
  if (!searchQuery.value) return availableHosts.value

  const query = searchQuery.value.toLowerCase()
  return availableHosts.value.filter(host =>
    host.toLowerCase().includes(query)
  )
})

// Host presets for quick selection
const hostPresets = computed(() => [
  {
    name: 'All Hosts',
    hosts: availableHosts.value,
  },
  {
    name: 'Production',
    hosts: availableHosts.value.filter(host => host.includes('prod') || host.includes('live')),
  },
  {
    name: 'Development',
    hosts: availableHosts.value.filter(host => host.includes('dev') || host.includes('test')),
  },
  {
    name: 'Top 5',
    hosts: availableHosts.value.slice(0, 5),
  },
])

// Host statistics
const hostStats = computed(() => {
  const stats: Record<string, { count: number; avgIops: number; totalIops: number }> = {}

  testRunsStore.state.data.forEach(run => {
    if (!stats[run.hostname]) {
      stats[run.hostname] = { count: 0, avgIops: 0, totalIops: 0 }
    }
    stats[run.hostname].count++
    stats[run.hostname].totalIops += run.iops
  })

  // Calculate averages
  Object.keys(stats).forEach(host => {
    stats[host].avgIops = Math.round(stats[host].totalIops / stats[host].count)
  })

  return stats
})

const selectedHostsStats = computed(() => {
  const selected = selectedHosts.value
  const stats = hostStats.value

  const totalTests = selected.reduce((sum, host) => sum + (stats[host]?.count || 0), 0)
  const totalIops = selected.reduce((sum, host) => sum + (stats[host]?.totalIops || 0), 0)
  const avgIops = totalTests > 0 ? Math.round(totalIops / totalTests) : 0

  return {
    totalTests,
    avgIops: formatIOPS(avgIops),
  }
})

// Methods
function toggleDropdown() {
  isDropdownOpen.value = !isDropdownOpen.value
}

function toggleHost(host: string) {
  const newSelected = [...selectedHosts.value]
  const index = newSelected.indexOf(host)

  if (index > -1) {
    newSelected.splice(index, 1)
  } else {
    newSelected.push(host)
  }

  selectedHosts.value = newSelected
}

function removeHost(host: string) {
  selectedHosts.value = selectedHosts.value.filter(h => h !== host)
}

function clearAll() {
  selectedHosts.value = []
}

function applyPreset(hosts: string[]) {
  selectedHosts.value = [...hosts]
}

function isSelected(host: string): boolean {
  return selectedHosts.value.includes(host)
}

function getHostStats(host: string) {
  return hostStats.value[host]
}

function formatHost(host: string): string {
  // Clean up hostname formatting
  return host.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

// Close dropdown when clicking outside
watch(isDropdownOpen, (newValue) => {
  if (newValue) {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.relative')) {
        isDropdownOpen.value = false
        document.removeEventListener('click', handleClickOutside)
      }
    }
    document.addEventListener('click', handleClickOutside)
  }
})
</script>

<style scoped>
.rotate-180 {
  transform: rotate(180deg);
}
</style>
