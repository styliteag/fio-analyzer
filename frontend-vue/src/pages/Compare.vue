<template>
  <main style="padding:16px">
    <h1>Compare</h1>
    <TestRunMultiSelect v-model="selectedIds" />
    <div class="flex gap-2 items-end">
      <label>Metric
        <select v-model="metric" class="border rounded p-1">
          <option value="iops">IOPS</option>
          <option value="bw">Bandwidth</option>
          <option value="avg">Avg Latency</option>
          <option value="p95">P95</option>
          <option value="p99">P99</option>
        </select>
      </label>
      <label>Sort
        <select v-model="sortDir" class="border rounded p-1">
          <option value="desc">High → Low</option>
          <option value="asc">Low → High</option>
        </select>
      </label>
      <button class="button" @click="load">Load</button>
      <ExportButtons @export="onExport($event)" />
    </div>
    <div id="compare-3d">
      <FullscreenContainer>
        <ThreeDBarChart :items="items" />
      </FullscreenContainer>
    </div>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import ThreeDBarChart from '../components/ThreeDBarChart.vue';
import FullscreenContainer from '../components/FullscreenContainer.vue';
import TestRunMultiSelect from '../components/TestRunMultiSelect.vue';
import ExportButtons from '../components/ExportButtons.vue';
import { Api } from '../services/api';

const selectedIds = ref<number[]>([]);
const items = ref<{ label: string; value: number }[]>([]);
const metric = ref<'iops'|'bw'|'avg'|'p95'|'p99'>('iops');
const sortDir = ref<'asc'|'desc'>('desc');

async function load() {
  if (!selectedIds.value.length) { items.value = []; return; }
  const ids = selectedIds.value.join(',');
  const data = await Api.performanceData({ test_run_ids: ids });
  const labels = (data as Record<string, unknown>)?.['labels'] as string[] | undefined ?? selectedIds.value.map(String);
  const mapKey = metric.value === 'bw' ? 'bandwidth' : metric.value === 'avg' ? 'latencyAvg' : metric.value === 'p95' ? 'latencyP95' : metric.value === 'p99' ? 'latencyP99' : 'iops';
  const values = (data as Record<string, unknown>)?.[mapKey] as number[] | undefined ?? [];
  const mapped = (labels || []).map((l: string, i: number) => ({ label: l, value: values[i] ?? 0 }));
  items.value = mapped.sort((a, b) => sortDir.value === 'asc' ? a.value - b.value : b.value - a.value);
}

function onExport(format: 'png'|'csv') {
  if (format === 'csv') {
    const rows = ['label,value', ...items.value.map(it => `${JSON.stringify(it.label)},${it.value}`)];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'compare.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  } else {
    const container = document.querySelector('#compare-3d');
    const canvas = container?.querySelector('canvas') as HTMLCanvasElement | null;
    if (canvas) {
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = 'compare.png';
      a.click();
    }
  }
}
</script>


