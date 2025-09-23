<template>
  <main style="padding:16px">
    <h1>Compare</h1>
    <TestRunMultiSelect v-model="selectedIds" />
    <ThreeDBarChart />
  </main>
  
</template>

<script setup lang="ts">
import { ref } from 'vue';
import ThreeDBarChart from '../components/ThreeDBarChart.vue';
import TestRunMultiSelect from '../components/TestRunMultiSelect.vue';

const selectedIds = ref<number[]>([]);
</script>


