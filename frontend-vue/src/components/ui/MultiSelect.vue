<template>
  <div class="relative" ref="containerRef">
    <!-- Selected items display -->
    <div class="flex flex-wrap gap-2 mb-2" v-if="modelValue.length > 0">
      <span
        v-for="item in modelValue"
        :key="item"
        class="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
      >
        {{ item }}
        <button
          @click.stop="removeItem(item)"
          class="hover:text-blue-600"
          type="button"
        >
          <X class="w-3 h-3" />
        </button>
      </span>
    </div>

    <!-- Dropdown button -->
    <button
      type="button"
      @click="toggleDropdown"
      class="w-full input-field flex items-center justify-between"
      :class="{ 'ring-2 ring-blue-500': isOpen }"
    >
      <span class="text-gray-700">
        {{ modelValue.length > 0 ? `${modelValue.length} selected` : placeholder }}
      </span>
      <ChevronDown class="w-4 h-4 text-gray-400" :class="{ 'rotate-180': isOpen }" />
    </button>

    <!-- Dropdown menu -->
    <div
      v-if="isOpen"
      class="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto"
    >
      <!-- Search input -->
      <div class="p-2 border-b border-gray-200">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search..."
          class="w-full px-3 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          @click.stop
        />
      </div>

      <!-- Quick actions -->
      <div class="p-2 border-b border-gray-200 flex gap-2">
        <button
          type="button"
          @click.stop="selectAll"
          class="text-xs px-2 py-1 text-blue-600 hover:bg-blue-50 rounded"
        >
          Select All
        </button>
        <button
          type="button"
          @click.stop="clearAll"
          class="text-xs px-2 py-1 text-gray-600 hover:bg-gray-50 rounded"
        >
          Clear All
        </button>
      </div>

      <!-- Options list -->
      <div class="py-1">
        <div v-if="filteredOptions.length === 0" class="px-4 py-2 text-sm text-gray-500">
          No options found
        </div>
        <label
          v-for="option in filteredOptions"
          :key="option"
          class="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 cursor-pointer"
          @click.stop
        >
          <input
            type="checkbox"
            :checked="modelValue.includes(option)"
            @change="toggleOption(option)"
            class="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
          />
          <span class="text-sm text-gray-700">{{ option }}</span>
        </label>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ChevronDown, X } from 'lucide-vue-next'

interface Props {
  modelValue: (string | number)[]
  options: (string | number)[]
  placeholder?: string
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Select options...'
})

const emit = defineEmits<{
  'update:modelValue': [value: (string | number)[]]
}>()

const isOpen = ref(false)
const searchQuery = ref('')
const containerRef = ref<HTMLElement | null>(null)

const filteredOptions = computed(() => {
  if (!searchQuery.value) return props.options

  const query = searchQuery.value.toLowerCase()
  return props.options.filter((option) =>
    String(option).toLowerCase().includes(query)
  )
})

function toggleDropdown() {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    searchQuery.value = ''
  }
}

function toggleOption(option: string | number) {
  const index = props.modelValue.indexOf(option)
  const newValue = [...props.modelValue]

  if (index > -1) {
    newValue.splice(index, 1)
  } else {
    newValue.push(option)
  }

  emit('update:modelValue', newValue)
}

function removeItem(item: string | number) {
  const newValue = props.modelValue.filter((v) => v !== item)
  emit('update:modelValue', newValue)
}

function selectAll() {
  emit('update:modelValue', [...filteredOptions.value])
}

function clearAll() {
  emit('update:modelValue', [])
}

// Close dropdown when clicking outside
function handleClickOutside(event: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(event.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>
