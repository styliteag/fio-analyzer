<template>
  <main style="padding:16px">
    <h1>Test Runs</h1>
    <PaginationControls
      :page="page"
      :total="testRuns.length"
      :page-size="pageSize"
      @update:page="v => page = v"
      @update:page-size="v => { pageSize = v; page = 1; }"
    />
    <ul>
      <li v-for="tr in paged" :key="tr.id">
        {{ tr.hostname }} — {{ tr.description }}
      </li>
    </ul>
  </main>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import { Api } from '../services/api';
import PaginationControls from '../components/PaginationControls.vue';

interface TestRun { id: number; hostname: string; description: string }

const testRuns = ref<TestRun[]>([]);
let page = $ref(1);
let pageSize = $ref(20);
const paged = computed(() => {
  const start = (page - 1) * pageSize;
  return testRuns.value.slice(start, start + pageSize);
});

let controller: AbortController | null = null;

onMounted(async () => {
  controller?.abort();
  controller = new AbortController();
  try {
    testRuns.value = await Api.testRuns({ signal: controller.signal });
  } catch (e) {
    console.error(e);
  }
});

onBeforeUnmount(() => controller?.abort());
</script>


