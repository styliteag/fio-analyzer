<template>
  <label class="block">
    <span class="mr-2">Template</span>
    <select v-model="model" class="border rounded p-1">
      <option value="iops">IOPS</option>
      <option value="bw">Bandwidth</option>
      <option value="latency">Latency</option>
    </select>
  </label>
</template>

<script setup lang="ts">
const props = defineProps<{ modelValue: 'iops'|'bw'|'latency' }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: 'iops'|'bw'|'latency'): void }>();
const model = computed({ get: () => props.modelValue, set: (v) => emit('update:modelValue', v) });
</script>


