<template>
  <label class="block">
    <span class="mr-2">Test Runs</span>
    <select v-model="model" multiple size="6" class="border rounded p-1 w-full" aria-label="Test runs">
      <option v-for="tr in runs" :key="tr.id" :value="tr.id">{{ trLabel(tr) }}</option>
    </select>
  </label>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { getJson } from '../services/api';

interface TestRun { id: number; hostname?: string; description?: string }

const props = defineProps<{
  modelValue: number[]
}>();
const emit = defineEmits<{ (e: 'update:modelValue', v: number[]): void }>();

const runs = ref<TestRun[]>([]);
const model = computed<number[]>({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v),
});

onMounted(async () => {
  try { runs.value = await getJson<TestRun[]>('/api/test-runs/'); } catch { runs.value = []; }
});

function trLabel(tr: TestRun) {
  return `${tr.id} • ${tr.hostname ?? ''} ${tr.description ? '— ' + tr.description : ''}`.trim();
}
</script>


