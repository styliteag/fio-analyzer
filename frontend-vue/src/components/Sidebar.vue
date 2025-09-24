<template>
  <aside
    class="fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0"
    :class="{ '-translate-x-full': !isOpen, 'translate-x-0': isOpen }"
  >
    <div class="flex flex-col h-full">
      <!-- Sidebar header -->
      <div class="flex items-center justify-between h-16 px-6 border-b border-gray-200 dark:border-gray-700">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
          Filters
        </h2>

        <!-- Close button (mobile) -->
        <button
          @click="closeSidebar"
          class="lg:hidden p-1 rounded-md text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          aria-label="Close sidebar"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Sidebar content -->
      <div class="flex-1 overflow-y-auto py-4">
        <div class="px-6 space-y-6">
          <!-- Quick actions -->
          <div>
            <h3 class="text-sm font-medium text-gray-900 dark:text-white mb-3">
              Quick Actions
            </h3>
            <div class="space-y-2">
              <button
                @click="clearAllFilters"
                class="w-full flex items-center px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors"
                :disabled="!hasActiveFilters"
              >
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Clear All Filters
              </button>

              <button
                @click="resetToDefaults"
                class="w-full flex items-center px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Reset to Defaults
              </button>
            </div>
          </div>

          <!-- Active filters summary -->
          <div v-if="hasActiveFilters">
            <h3 class="text-sm font-medium text-gray-900 dark:text-white mb-3">
              Active Filters
            </h3>
            <div class="space-y-2">
              <div
                v-for="filter in activeFilterSummary"
                :key="filter.category"
                class="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-900/20 rounded-md"
              >
                <div class="flex-1 min-w-0">
                  <p class="text-xs font-medium text-blue-700 dark:text-blue-300">
                    {{ filter.displayName }}
                  </p>
                  <p class="text-xs text-blue-600 dark:text-blue-400 truncate">
                    {{ filter.values.length }} selected
                  </p>
                </div>
                <button
                  @click="clearFilterCategory(filter.category)"
                  class="ml-2 p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                  aria-label="Clear filter"
                >
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <!-- Filter sections -->
          <div class="space-y-4">
            <!-- Hostnames filter -->
            <FilterSection
              title="Hostnames"
              :options="availableFilters.hostnames"
              :selected="activeFilters.selectedHostnames"
              @update:selected="updateHostnamesFilter"
            />

            <!-- Drive Types filter -->
            <FilterSection
              title="Drive Types"
              :options="availableFilters.drive_types"
              :selected="activeFilters.selectedDriveTypes || []"
              @update:selected="updateDriveTypesFilter"
            />

            <!-- Protocols filter -->
            <FilterSection
              title="Protocols"
              :options="availableFilters.protocols"
              :selected="activeFilters.selectedProtocols"
              @update:selected="updateProtocolsFilter"
            />

            <!-- Block Sizes filter -->
            <FilterSection
              title="Block Sizes"
              :options="availableFilters.block_sizes"
              :selected="activeFilters.selectedBlockSizes"
              @update:selected="updateBlockSizesFilter"
            />

            <!-- I/O Patterns filter -->
            <FilterSection
              title="I/O Patterns"
              :options="availableFilters.patterns"
              :selected="activeFilters.selectedPatterns"
              @update:selected="updatePatternsFilter"
            />

            <!-- Queue Depths filter -->
            <FilterSection
              title="Queue Depths"
              :options="availableFilters.queue_depths?.map(String)"
              :selected="activeFilters.selectedQueueDepths?.map(String)"
              @update:selected="updateQueueDepthsFilter"
            />

            <!-- Job Counts filter -->
            <FilterSection
              title="Job Counts"
              :options="availableFilters.num_jobs?.map(String)"
              :selected="activeFilters.selectedNumJobs?.map(String)"
              @update:selected="updateNumJobsFilter"
            />
          </div>
        </div>
      </div>

      <!-- Sidebar footer -->
      <div class="border-t border-gray-200 dark:border-gray-700 p-4">
        <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{{ totalResults }} results</span>
          <span v-if="lastUpdated" class="truncate ml-2">
            Updated {{ formatRelativeTime(lastUpdated) }}
          </span>
        </div>
      </div>
    </div>

    <!-- Backdrop for mobile -->
    <div
      v-if="isOpen"
      class="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
      @click="closeSidebar"
    />
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useFiltersStore } from '@/stores/filters'
import { useTestRunsStore } from '@/stores/testRuns'
import { formatRelativeTime } from '@/utils/formatters'
import FilterSection from './filters/FilterSection.vue'

interface Props {
  isOpen: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:isOpen': [value: boolean]
}>()

const filtersStore = useFiltersStore()
const testRunsStore = useTestRunsStore()

// Computed properties
const isOpen = computed({
  get: () => props.isOpen,
  set: (value) => emit('update:isOpen', value),
})

const availableFilters = computed(() => filtersStore.state.available || {
  hostnames: [],
  drive_types: [],
  protocols: [],
  block_sizes: [],
  patterns: [],
  queue_depths: [],
  num_jobs: [],
})

const activeFilters = computed(() => filtersStore.appliedFilters)

const hasActiveFilters = computed(() => filtersStore.hasActiveFilters)

const activeFilterSummary = computed(() => filtersStore.getFilterSummary())

const totalResults = computed(() => testRunsStore.state.data.length)

const lastUpdated = computed(() => filtersStore.state.lastUpdated)

// Methods
function closeSidebar() {
  isOpen.value = false
}

function clearAllFilters() {
  filtersStore.clearAllFilters()
}

function resetToDefaults() {
  filtersStore.resetFilters()
}

function clearFilterCategory(category: string) {
  filtersStore.clearCategory(category)
}

// Filter update methods
function updateHostnamesFilter(selected: string[]) {
  filtersStore.setFilter('hostnames', selected)
}

function updateDriveTypesFilter(selected: string[]) {
  filtersStore.setFilter('drive_types', selected)
}

function updateProtocolsFilter(selected: string[]) {
  filtersStore.setFilter('protocols', selected)
}

function updateBlockSizesFilter(selected: string[]) {
  filtersStore.setFilter('block_sizes', selected)
}

function updatePatternsFilter(selected: string[]) {
  filtersStore.setFilter('patterns', selected)
}

function updateQueueDepthsFilter(selected: string[]) {
  const numericValues = selected.map(v => parseInt(v)).filter(v => !isNaN(v))
  filtersStore.setFilter('queue_depths', numericValues)
}

function updateNumJobsFilter(selected: string[]) {
  const numericValues = selected.map(v => parseInt(v)).filter(v => !isNaN(v))
  filtersStore.setFilter('num_jobs', numericValues)
}
</script>

<style scoped>
/* Additional styles if needed */
</style>
