<template>
  <div class="host-filters">
    <!-- Active Filters Display -->
    <div v-if="activeFilterCount > 0" class="active-filters mb-4">
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-medium theme-text-primary">Active Filters</span>
        <button
          class="text-sm text-blue-600 hover:text-blue-800"
          @click="clearAllFilters"
        >
          Clear All
        </button>
      </div>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="filter in activeFilterTags"
          :key="filter.id"
          class="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
        >
          {{ filter.label }}
          <button
            class="ml-1 hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5"
            @click="removeFilter(filter.id)"
          >
            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
            </svg>
          </button>
        </span>
      </div>
    </div>

    <!-- Quick Filter Buttons -->
    <div class="quick-filters grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
      <button
        class="quick-filter-btn"
        :class="{ active: isQuickFilterActive('high-performance') }"
        @click="applyQuickFilter('high-performance')"
      >
        High IOPS
      </button>
      <button
        class="quick-filter-btn"
        :class="{ active: isQuickFilterActive('low-latency') }"
        @click="applyQuickFilter('low-latency')"
      >
        Low Latency
      </button>
      <button
        class="quick-filter-btn"
        :class="{ active: isQuickFilterActive('sequential') }"
        @click="applyQuickFilter('sequential')"
      >
        Sequential
      </button>
      <button
        class="quick-filter-btn"
        :class="{ active: isQuickFilterActive('random') }"
        @click="applyQuickFilter('random')"
      >
        Random
      </button>
    </div>

    <!-- Filter Controls -->
    <div class="filter-controls grid grid-cols-1 md:grid-cols-3 gap-4">
      <!-- Block Size -->
      <div class="filter-control">
        <label class="block text-sm font-medium theme-text-primary mb-1">Block Size</label>
        <select
          v-model="localFilters.selectedBlockSizes"
          multiple
          class="filter-select"
          @change="emitFilters"
        >
          <option
            v-for="size in availableBlockSizes"
            :key="size"
            :value="size"
          >
            {{ size }}
          </option>
        </select>
      </div>

      <!-- IO Pattern -->
      <div class="filter-control">
        <label class="block text-sm font-medium theme-text-primary mb-1">IO Pattern</label>
        <select
          v-model="localFilters.selectedPatterns"
          multiple
          class="filter-select"
          @change="emitFilters"
        >
          <option
            v-for="pattern in availablePatterns"
            :key="pattern"
            :value="pattern"
          >
            {{ pattern.replace('_', ' ').toUpperCase() }}
          </option>
        </select>
      </div>

      <!-- Queue Depth -->
      <div class="filter-control">
        <label class="block text-sm font-medium theme-text-primary mb-1">Queue Depth</label>
        <select
          v-model="localFilters.selectedQueueDepths"
          multiple
          class="filter-select"
          @change="emitFilters"
        >
          <option
            v-for="depth in availableQueueDepths"
            :key="depth"
            :value="depth"
          >
            {{ depth }}
          </option>
        </select>
      </div>
    </div>

    <!-- Advanced Filters Toggle -->
    <div class="advanced-toggle mt-4">
      <button
        class="text-sm text-blue-600 hover:text-blue-800 flex items-center"
        @click="showAdvanced = !showAdvanced"
      >
        <svg
          class="w-4 h-4 mr-1 transition-transform"
          :class="{ 'rotate-180': showAdvanced }"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
        </svg>
        {{ showAdvanced ? 'Hide' : 'Show' }} Advanced Filters
      </button>
    </div>

    <!-- Advanced Filters -->
    <div v-if="showAdvanced" class="advanced-filters mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
      <!-- Number of Jobs -->
      <div class="filter-control">
        <label class="block text-sm font-medium theme-text-primary mb-1">Num Jobs</label>
        <select
          v-model="localFilters.selectedNumJobs"
          multiple
          class="filter-select"
          @change="emitFilters"
        >
          <option
            v-for="jobs in availableNumJobs"
            :key="jobs"
            :value="jobs"
          >
            {{ jobs }}
          </option>
        </select>
      </div>

      <!-- Protocol -->
      <div class="filter-control">
        <label class="block text-sm font-medium theme-text-primary mb-1">Protocol</label>
        <select
          v-model="localFilters.selectedProtocols"
          multiple
          class="filter-select"
          @change="emitFilters"
        >
          <option
            v-for="protocol in availableProtocols"
            :key="protocol"
            :value="protocol"
          >
            {{ protocol.toUpperCase() }}
          </option>
        </select>
      </div>
    </div>

    <!-- Filter Stats -->
    <div class="filter-stats mt-4 text-xs theme-text-secondary">
      Showing {{ filteredCount }} of {{ totalCount }} configurations
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { FilterState } from '@/types/filters'
import type { PerformanceData } from '@/types/performance'

interface Props {
  performanceData: PerformanceData[]
  filters: FilterState
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:filters': [filters: FilterState]
}>()

// Local state
const localFilters = ref<FilterState>({ ...props.filters })
const showAdvanced = ref(false)
const activeQuickFilters = ref<Set<string>>(new Set())

// Computed properties
const availableBlockSizes = computed(() => {
  const sizes = new Set<string>()
  props.performanceData.forEach(item => {
    if (item.block_size) {
      sizes.add(typeof item.block_size === 'string' ? item.block_size : item.block_size.toString())
    }
  })
  return Array.from(sizes).sort()
})

const availablePatterns = computed(() => {
  const patterns = new Set<string>()
  props.performanceData.forEach(item => {
    if (item.read_write_pattern) {
      patterns.add(item.read_write_pattern)
    }
  })
  return Array.from(patterns).sort()
})

const availableQueueDepths = computed(() => {
  const depths = new Set<number>()
  props.performanceData.forEach(item => {
    if (item.queue_depth) {
      depths.add(item.queue_depth)
    }
  })
  return Array.from(depths).sort((a, b) => a - b)
})

const availableNumJobs = computed(() => {
  const jobs = new Set<number>()
  props.performanceData.forEach(item => {
    if (item.num_jobs) {
      jobs.add(item.num_jobs)
    }
  })
  return Array.from(jobs).sort((a, b) => a - b)
})

const availableProtocols = computed(() => {
  const protocols = new Set<string>()
  props.performanceData.forEach(item => {
    if (item.protocol) {
      protocols.add(item.protocol)
    }
  })
  return Array.from(protocols).sort()
})

const activeFilterCount = computed(() => {
  return (
    localFilters.value.selectedBlockSizes.length +
    localFilters.value.selectedPatterns.length +
    localFilters.value.selectedQueueDepths.length +
    localFilters.value.selectedNumJobs.length +
    localFilters.value.selectedProtocols.length +
    localFilters.value.selectedHostDiskCombinations.length
  )
})

const activeFilterTags = computed(() => {
  const tags: Array<{ id: string; label: string }> = []

  localFilters.value.selectedBlockSizes.forEach(size => {
    tags.push({ id: `blocksize-${size}`, label: `Block: ${size}` })
  })

  localFilters.value.selectedPatterns.forEach(pattern => {
    tags.push({ id: `pattern-${pattern}`, label: `Pattern: ${pattern.replace('_', ' ')}` })
  })

  localFilters.value.selectedQueueDepths.forEach(depth => {
    tags.push({ id: `queuedepth-${depth}`, label: `QD: ${depth}` })
  })

  localFilters.value.selectedNumJobs.forEach(jobs => {
    tags.push({ id: `numjobs-${jobs}`, label: `Jobs: ${jobs}` })
  })

  localFilters.value.selectedProtocols.forEach(protocol => {
    tags.push({ id: `protocol-${protocol}`, label: `Protocol: ${protocol.toUpperCase()}` })
  })

  return tags
})

const filteredCount = computed(() => {
  // Apply current filters to count
  return props.performanceData.filter(item => {
    if (localFilters.value.selectedBlockSizes.length > 0) {
      const blockSize = typeof item.block_size === 'string' ? item.block_size : item.block_size?.toString()
      if (!blockSize || !localFilters.value.selectedBlockSizes.includes(blockSize)) {
        return false
      }
    }

    if (localFilters.value.selectedPatterns.length > 0 &&
        (!item.read_write_pattern || !localFilters.value.selectedPatterns.includes(item.read_write_pattern))) {
      return false
    }

    if (localFilters.value.selectedQueueDepths.length > 0 &&
        (!item.queue_depth || !localFilters.value.selectedQueueDepths.includes(item.queue_depth))) {
      return false
    }

    if (localFilters.value.selectedNumJobs.length > 0 &&
        (!item.num_jobs || !localFilters.value.selectedNumJobs.includes(item.num_jobs))) {
      return false
    }

    if (localFilters.value.selectedProtocols.length > 0 &&
        (!item.protocol || !localFilters.value.selectedProtocols.includes(item.protocol))) {
      return false
    }

    return true
  }).length
})

const totalCount = computed(() => props.performanceData.length)

// Methods
const emitFilters = () => {
  emit('update:filters', { ...localFilters.value })
}

const clearAllFilters = () => {
  localFilters.value = {
    selectedBlockSizes: [],
    selectedPatterns: [],
    selectedQueueDepths: [],
    selectedNumJobs: [],
    selectedProtocols: [],
    selectedHostDiskCombinations: []
  }
  activeQuickFilters.value.clear()
  emitFilters()
}

const removeFilter = (filterId: string) => {
  const [type, value] = filterId.split('-', 2)

  switch (type) {
    case 'blocksize':
      localFilters.value.selectedBlockSizes = localFilters.value.selectedBlockSizes.filter(s => s !== value)
      break
    case 'pattern':
      localFilters.value.selectedPatterns = localFilters.value.selectedPatterns.filter(p => p !== value.replace(' ', '_'))
      break
    case 'queuedepth': {
      const depth = parseInt(value)
      localFilters.value.selectedQueueDepths = localFilters.value.selectedQueueDepths.filter(d => d !== depth)
      break
    }
    case 'numjobs': {
      const jobs = parseInt(value)
      localFilters.value.selectedNumJobs = localFilters.value.selectedNumJobs.filter(j => j !== jobs)
      break
    }
    case 'protocol':
      localFilters.value.selectedProtocols = localFilters.value.selectedProtocols.filter(p => p !== value.toLowerCase())
      break
  }

  emitFilters()
}

const applyQuickFilter = (filterType: string) => {
  // Clear existing filters first
  clearAllFilters()

  switch (filterType) {
    case 'high-performance':
      // Filter for high IOPS configurations
      localFilters.value.selectedPatterns = ['random_read', 'random_write']
      // Note: In a real implementation, you'd filter the data and apply additional logic
      break

    case 'low-latency':
      // Filter for low latency configurations
      localFilters.value.selectedPatterns = ['random_read']
      break

    case 'sequential':
      // Filter for sequential IO patterns
      localFilters.value.selectedPatterns = ['sequential_read', 'sequential_write']
      break

    case 'random':
      // Filter for random IO patterns
      localFilters.value.selectedPatterns = ['random_read', 'random_write']
      break
  }

  activeQuickFilters.value.clear()
  activeQuickFilters.value.add(filterType)
  emitFilters()
}

const isQuickFilterActive = (filterType: string) => {
  return activeQuickFilters.value.has(filterType)
}

// Watch for prop changes
watch(() => props.filters, (newFilters) => {
  localFilters.value = { ...newFilters }
}, { deep: true, immediate: true })
</script>

<style scoped>
.host-filters {
  @apply w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4;
}

.theme-text-primary {
  @apply text-gray-900 dark:text-white;
}

.theme-text-secondary {
  @apply text-gray-600 dark:text-gray-300;
}

.active-filters {
  @apply border-b border-gray-200 dark:border-gray-700 pb-3;
}

.quick-filters {
  @apply border-b border-gray-200 dark:border-gray-700 pb-3;
}

.quick-filter-btn {
  @apply px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors;
}

.quick-filter-btn.active {
  @apply bg-blue-600 border-blue-600 text-white;
}

.filter-controls {
  @apply border-b border-gray-200 dark:border-gray-700 pb-4;
}

.filter-control {
  @apply w-full;
}

.filter-select {
  @apply w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500;
}

.advanced-filters {
  @apply border-t border-gray-200 dark:border-gray-700 pt-4;
}

.filter-stats {
  @apply text-center;
}
</style>
