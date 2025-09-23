<template>
  <main style="padding:16px">
    <h1>Test Runs</h1>
    <ul>
      <li
        v-for="tr in testRuns"
        :key="tr.id"
      >
        {{ tr.hostname }} — {{ tr.description }}
      </li>
    </ul>
  </main>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { getJson } from '../services/api';

interface TestRun { id: number; hostname: string; description: string }

const testRuns = ref<TestRun[]>([]);

let controller: AbortController | null = null;

onMounted(async () => {
  controller?.abort();
  controller = new AbortController();
  try {
    testRuns.value = await getJson<TestRun[]>('/api/test-runs/', { signal: controller.signal });
  } catch (e) {
    console.error(e);
  }
});

onBeforeUnmount(() => controller?.abort());
</script>


