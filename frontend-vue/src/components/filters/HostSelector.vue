<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-semibold text-gray-900">Host Selection</h3>
      <button
        @click="emit('refresh')"
        :disabled="loading"
        class="text-sm text-blue-600 hover:text-blue-700 disabled:text-gray-400"
        type="button"
      >
        <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': loading }" />
      </button>
    </div>

    <MultiSelect
      v-model="selectedHostsModel"
      :options="availableHosts"
      placeholder="Select hosts to compare..."
    />

    <div v-if="selectedHostsModel.length === 0" class="text-sm text-gray-500 italic">
      Select at least one host to view comparison charts
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RefreshCw } from 'lucide-vue-next'
import MultiSelect from '../ui/MultiSelect.vue'

interface Props {
  availableHosts: string[]
  selectedHosts: string[]
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false
})

const emit = defineEmits<{
  'update:selectedHosts': [hosts: string[]]
  'refresh': []
}>()

const selectedHostsModel = computed({
  get: () => props.selectedHosts,
  set: (value) => emit('update:selectedHosts', value as string[])
})
</script>
