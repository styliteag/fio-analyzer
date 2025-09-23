<template>
  <div style="display:flex; align-items:center; gap:8px">
    <button :disabled="page<=1" @click="$emit('update:page', page-1)">Prev</button>
    <span>Page {{ page }} / {{ totalPages }}</span>
    <button :disabled="page>=totalPages" @click="$emit('update:page', page+1)">Next</button>
    <select :value="pageSize" @change="$emit('update:pageSize', Number(($event.target as HTMLSelectElement).value))">
      <option v-for="s in sizes" :key="s" :value="s">{{ s }} / page</option>
    </select>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ page: number; total: number; pageSize: number; sizes?: number[] }>();
defineEmits<{ (e:'update:page', v:number): void; (e:'update:pageSize', v:number): void }>();

const sizes = props.sizes || [10, 20, 50, 100];
const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)));
</script>



