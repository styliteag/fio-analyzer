<template>
  <div class="space-y-3">
    <!-- Section header -->
    <div class="flex items-center justify-between">
      <h4 class="text-sm font-medium text-gray-900 dark:text-white">
        {{ title }}
      </h4>

      <button
        v-if="selected.length > 0"
        class="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        @click="clearSelection"
      >
        Clear
      </button>
    </div>

    <!-- Search input for large option lists -->
    <div
      v-if="showSearch && options.length > 10"
      class="relative"
    >
      <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <SearchIcon class="h-4 w-4 text-gray-400" />
      </div>
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search..."
        class="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
      />
    </div>

    <!-- Options list -->
    <div class="space-y-1 max-h-60 overflow-y-auto">
      <div
        v-for="option in filteredOptions"
        :key="option"
        class="flex items-center"
      >
        <input
          :id="`${title}-${option}`"
          :value="option"
          :checked="isSelected(option)"
          type="checkbox"
          class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600"
          @change="toggleOption(option)"
        />
        <label
          :for="`${title}-${option}`"
          class="ml-3 block text-sm"
          :class="isSelected(option) ? 'text-blue-700 dark:text-blue-300 font-medium' : 'text-gray-700 dark:text-gray-300'"
        >
          {{ formatOption(option) }}
          <span
            v-if="showCounts && getOptionCount(option) > 0"
            class="ml-2 text-xs text-gray-500 dark:text-gray-400"
          >
            ({{ getOptionCount(option) }})
          </span>
        </label>
      </div>
    </div>

    <!-- Select All / Clear buttons -->
    <div
      v-if="options.length > 3"
      class="flex space-x-2 pt-2 border-t border-gray-200 dark:border-gray-700"
    >
      <button
        class="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        @click="selectAll"
      >
        Select all
      </button>
      <span class="text-xs text-gray-400">•</span>
      <button
        class="text-xs text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        @click="clearSelection"
      >
        Clear all
      </button>
    </div>

    <!-- No options message -->
    <div
      v-if="filteredOptions.length === 0 && searchQuery"
      class="text-center py-4 text-sm text-gray-500 dark:text-gray-400"
    >
      No options found for "{{ searchQuery }}"
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Search as SearchIcon } from 'lucide-vue-next'

interface Props {
  title: string
  options: (string | number)[]
  selected: (string | number)[]
  showSearch?: boolean
  showCounts?: boolean
  optionCounts?: Record<string | number, number>
}

const props = withDefaults(defineProps<Props>(), {
  showSearch: true,
  showCounts: false,
  optionCounts: () => ({}),
})

const emit = defineEmits<{
  'update:selected': [value: (string | number)[]]
}>()

const searchQuery = ref('')

const filteredOptions = computed(() => {
  if (!searchQuery.value) return props.options

  const query = searchQuery.value.toLowerCase()
  return props.options.filter(option =>
    String(option).toLowerCase().includes(query)
  )
})

function isSelected(option: string | number): boolean {
  return props.selected.includes(option)
}

function toggleOption(option: string | number): void {
  const newSelected = [...props.selected]
  const index = newSelected.indexOf(option)

  if (index > -1) {
    newSelected.splice(index, 1)
  } else {
    newSelected.push(option)
  }

  emit('update:selected', newSelected)
}

function selectAll(): void {
  emit('update:selected', [...props.options])
}

function clearSelection(): void {
  emit('update:selected', [])
}

function getOptionCount(option: string | number): number {
  return props.optionCounts[option] || 0
}

function formatOption(option: string | number): string {
  // Format specific option types
  if (typeof option === 'string') {
    // Format drive models, hostnames, etc.
    if (option.includes('_')) {
      return option.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }
    return option.charAt(0).toUpperCase() + option.slice(1)
  }

  // Format numbers (queue depths, job counts, etc.)
  if (props.title.toLowerCase().includes('depth') || props.title.toLowerCase().includes('job')) {
    return option.toString()
  }

  return option.toString()
}
</script>

<style scoped>
/* Additional styles if needed */
</style>
