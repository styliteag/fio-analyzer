<template>
  <div
    v-if="hasActiveFilters"
    class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4"
  >
    <div class="flex items-start justify-between">
      <div class="flex-1">
        <h4 class="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
          Active Filters
        </h4>

        <div class="flex flex-wrap gap-2">
          <!-- Filter tags -->
          <span
            v-for="filter in activeFilterTags"
            :key="filter.id"
            class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200"
          >
            <span class="font-medium">{{ filter.category }}:</span>
            <span class="ml-1">{{ filter.value }}</span>
            <button
              @click="removeFilter(filter.category, filter.value)"
              class="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-blue-200 dark:hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              aria-label="Remove filter"
            >
              <XIcon class="w-3 h-3" />
            </button>
          </span>
        </div>

        <!-- Filter summary -->
        <div class="mt-3 text-xs text-blue-700 dark:text-blue-300">
          <span class="font-medium">{{ totalResults }}</span> results found across
          <span class="font-medium">{{ activeCategories.length }}</span> filter categories
        </div>
      </div>

      <!-- Actions -->
      <div class="ml-4 flex flex-col space-y-2">
        <button
          @click="clearAllFilters"
          class="inline-flex items-center px-3 py-1.5 border border-blue-300 rounded-md text-xs font-medium text-blue-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-blue-800 dark:border-blue-600 dark:text-blue-200 dark:hover:bg-blue-700"
        >
          Clear All
        </button>

        <button
          v-if="!filtersApplied"
          @click="applyFilters"
          class="inline-flex items-center px-3 py-1.5 border border-transparent rounded-md text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Apply Filters
        </button>
      </div>
    </div>

    <!-- Applied status -->
    <div
      v-if="filtersApplied"
      class="mt-3 flex items-center text-xs text-green-700 dark:text-green-300"
    >
      <CheckCircleIcon class="w-4 h-4 mr-1" />
      Filters applied - showing {{ totalResults }} results
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useFiltersStore } from '@/stores/filters'
import { useTestRunsStore } from '@/stores/testRuns'
import { X, CheckCircle } from 'lucide-vue-next'

interface FilterTag {
  id: string
  category: string
  value: string | number
}

const filtersStore = useFiltersStore()
const testRunsStore = useTestRunsStore()

// Computed properties
const hasActiveFilters = computed(() => filtersStore.hasActiveFilters)

const activeFilterTags = computed((): FilterTag[] => {
  const tags: FilterTag[] = []
  let id = 0

  Object.entries(filtersStore.active).forEach(([category, values]) => {
    values.forEach(value => {
      tags.push({
        id: `filter-${id++}`,
        category: formatCategoryName(category),
        value,
      })
    })
  })

  return tags
})

const activeCategories = computed(() => filtersStore.activeCategories)

const filtersApplied = computed(() => filtersStore.state.applied)

const totalResults = computed(() => {
  // In a real implementation, this would be the filtered count
  // For now, return the total count
  return testRunsStore.state.data.length
})

// Methods
function removeFilter(category: string, value: string | number) {
  const categoryKey = getCategoryKey(category)
  filtersStore.removeFilter(categoryKey, value)
}

function clearAllFilters() {
  filtersStore.clearAllFilters()
}

function applyFilters() {
  filtersStore.applyFilters()
}

function formatCategoryName(category: string): string {
  const names: Record<string, string> = {
    hostnames: 'Host',
    drive_types: 'Drive Type',
    drive_models: 'Drive Model',
    protocols: 'Protocol',
    block_sizes: 'Block Size',
    patterns: 'Pattern',
    queue_depths: 'QD',
    num_jobs: 'Jobs',
    syncs: 'Sync',
    directs: 'Direct I/O',
    test_sizes: 'Test Size',
    durations: 'Duration',
  }

  return names[category] || category
}

function getCategoryKey(displayName: string): string {
  const keys: Record<string, string> = {
    'Host': 'hostnames',
    'Drive Type': 'drive_types',
    'Drive Model': 'drive_models',
    'Protocol': 'protocols',
    'Block Size': 'block_sizes',
    'Pattern': 'patterns',
    'QD': 'queue_depths',
    'Jobs': 'num_jobs',
    'Sync': 'syncs',
    'Direct I/O': 'directs',
    'Test Size': 'test_sizes',
    'Duration': 'durations',
  }

  return keys[displayName] || displayName
}
</script>

<style scoped>
/* Additional styles if needed */
</style>
