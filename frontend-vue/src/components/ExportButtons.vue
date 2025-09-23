<template>
  <div style="display:flex; gap:8px">
    <button @click="$emit('export', 'png')">Export PNG</button>
    <button @click="$emit('export', 'csv')">Export CSV</button>
  </div>
</template>

<script setup lang="ts">
defineEmits<{ (e: 'export', format: 'png' | 'csv'): void }>();
</script>


