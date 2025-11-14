<template>
  <div class="flex h-screen bg-gray-50">
    <!-- Filter Sidebar -->
    <FilterSidebar />

    <!-- Main Content -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <!-- Header -->
      <header class="bg-white border-b border-gray-200 px-6 py-4">
        <div class="flex items-center justify-between">
          <h1 class="text-2xl font-bold text-gray-900">Performance Comparison</h1>
          <div class="flex items-center gap-4">
            <router-link to="/advanced" class="text-sm text-blue-600 hover:text-blue-700">
              Advanced Views →
            </router-link>
            <router-link to="/upload" class="btn-secondary">
              Upload Data
            </router-link>
            <button @click="handleLogout" class="btn-secondary">
              Logout
            </button>
          </div>
        </div>
      </header>

      <!-- Main Area -->
      <main class="flex-1 overflow-y-auto p-6 space-y-6">
        <!-- Loading State -->
        <div v-if="testRunsStore.loading" class="card text-center py-12">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p class="mt-4 text-gray-600">Loading test data...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="testRunsStore.error" class="card">
          <div class="text-center py-8">
            <p class="text-red-600 font-semibold">Error loading data</p>
            <p class="text-gray-600 mt-2">{{ testRunsStore.error }}</p>
            <button @click="loadData" class="btn-primary mt-4">Retry</button>
          </div>
        </div>

        <!-- Main Comparison View -->
        <template v-else>
          <!-- Configuration Selector -->
          <div class="card">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Select Test Configuration
            </label>
            <select
              v-model="selectedConfigKey"
              class="input-field text-base"
              @change="handleConfigChange"
            >
              <option value="">Choose a configuration...</option>
              <option v-for="config in availableConfigs" :key="config.key" :value="config.key">
                {{ config.label }} — {{ config.count }} host(s)
              </option>
            </select>
            <p v-if="selectedConfigKey" class="mt-2 text-sm text-gray-600">
              {{ availableHostsForConfig.length }} host(s) available with this configuration
            </p>
          </div>

          <!-- Host Selector -->
          <div v-if="selectedConfigKey && availableHostsForConfig.length > 0" class="card">
            <h3 class="text-lg font-semibold mb-3">Select Hosts to Compare</h3>
            <div class="flex flex-wrap gap-3">
              <label
                v-for="host in availableHostsForConfig"
                :key="host"
                class="flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                :class="{
                  'border-blue-500 bg-blue-50': selectedHosts.includes(host),
                  'border-gray-300': !selectedHosts.includes(host)
                }"
              >
                <input
                  type="checkbox"
                  :value="host"
                  v-model="selectedHosts"
                  class="w-4 h-4 text-blue-600"
                />
                <span class="font-medium">{{ host }}</span>
              </label>
            </div>
            <div class="mt-3 flex gap-2">
              <button
                @click="selectAll"
                class="text-sm text-blue-600 hover:text-blue-700"
              >
                Select All
              </button>
              <span class="text-gray-400">|</span>
              <button
                @click="selectNone"
                class="text-sm text-blue-600 hover:text-blue-700"
              >
                Clear
              </button>
            </div>
          </div>

          <!-- Empty State - No Config Selected -->
          <div v-if="!selectedConfigKey" class="card">
            <div class="text-center py-12">
              <p class="text-gray-500 text-lg">Select a test configuration above to start comparing</p>
              <p class="text-gray-400 text-sm mt-2">
                {{ availableConfigs.length }} unique configurations available
              </p>
            </div>
          </div>

          <!-- Empty State - No Hosts Selected -->
          <div v-else-if="selectedHosts.length === 0" class="card">
            <div class="text-center py-12">
              <p class="text-gray-500 text-lg">Select at least one host to view comparison</p>
            </div>
          </div>

          <!-- Comparison Table -->
          <ComparisonTable
            v-else
            :test-runs="selectedTestRuns"
            :selected-hosts="selectedHosts"
          />
        </template>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useTestRunsStore } from '../stores/testRuns'
import { useFiltersStore } from '../stores/filters'
import { useApi } from '../composables/useApi'
import { useConfigSelector } from '../composables/useConfigSelector'
import FilterSidebar from '../components/filters/FilterSidebar.vue'
import ComparisonTable from '../components/comparison/ComparisonTable.vue'
import type { TestRun } from '../types/testRun'

const router = useRouter()
const authStore = useAuthStore()
const testRunsStore = useTestRunsStore()
const filtersStore = useFiltersStore()
const api = useApi()

const { extractUniqueConfigs, getHostsForConfig, getTestRun } = useConfigSelector()

const selectedConfigKey = ref('')
const selectedHosts = ref<string[]>([])

// Available configurations
const availableConfigs = computed(() => {
  return extractUniqueConfigs(testRunsStore.testRuns)
})

// Available hosts for selected configuration
const availableHostsForConfig = computed(() => {
  if (!selectedConfigKey.value) return []
  return getHostsForConfig(testRunsStore.testRuns, selectedConfigKey.value)
})

// Selected test runs (map of hostname -> test run)
const selectedTestRuns = computed(() => {
  const runs = new Map<string, TestRun>()

  selectedHosts.value.forEach((host) => {
    const run = getTestRun(testRunsStore.testRuns, selectedConfigKey.value, host)
    if (run) {
      runs.set(host, run)
    }
  })

  return runs
})

// Handle configuration change
function handleConfigChange() {
  // Auto-select first 2-3 hosts
  if (availableHostsForConfig.value.length > 0) {
    selectedHosts.value = availableHostsForConfig.value.slice(0, Math.min(3, availableHostsForConfig.value.length))
  } else {
    selectedHosts.value = []
  }
}

// Select all hosts
function selectAll() {
  selectedHosts.value = [...availableHostsForConfig.value]
}

// Clear selection
function selectNone() {
  selectedHosts.value = []
}

async function loadData() {
  await testRunsStore.fetchTestRuns(authStore.getAuthHeader())
}

async function loadFilters() {
  try {
    const filters = await api.getFilters()
    filtersStore.setAvailable(filters)
  } catch (error) {
    console.error('Error loading filters:', error)
  }
}

function handleLogout() {
  authStore.logout()
  router.push({ name: 'Login' })
}

// Load data when filters change
watch(() => filtersStore.active, () => {
  loadData()
  // Reset selections when filters change
  selectedConfigKey.value = ''
  selectedHosts.value = []
}, { deep: true })

onMounted(async () => {
  authStore.init()
  await loadFilters()
  await loadData()
})
</script>
