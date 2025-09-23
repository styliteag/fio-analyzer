<template>
  <div>
    <Line ref="chartRef" :data="data" :options="resolvedOptions" />
    <div v-if="showLegend" class="mt-2" role="group" aria-label="Datasets legend">
      <button
        v-for="(ds, i) in datasetLabels"
        :key="i"
        class="button"
        style="margin-right:6px;margin-bottom:6px"
        :aria-pressed="!isHidden(i)"
        @click="toggleDataset(i)"
        @keydown.enter.prevent="toggleDataset(i)"
        @keydown.space.prevent="toggleDataset(i)"
      >
        {{ ds }}: {{ isHidden(i) ? 'off' : 'on' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Line } from 'vue-chartjs';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Decimation,
} from 'chart.js';

import type { ChartData, ChartOptions } from 'chart.js';
import { computed, ref } from 'vue';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Decimation);

const props = defineProps<{ data: ChartData; options?: ChartOptions; showLegend?: boolean }>();
const showLegend = computed(() => props.showLegend ?? true);

const chartRef = ref<{ chart: ChartJS | null } | null>(null);
const resolvedOptions = computed<ChartOptions>(() => (
  props.options ?? {
    parsing: false,
    animation: false,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    elements: { point: { radius: 0 } },
    plugins: {
      legend: { display: true, position: 'bottom' },
      tooltip: { enabled: true, filter: (ctx) => ctx.dataIndex % 4 === 0 },
      decimation: { enabled: true, algorithm: 'lttb', samples: 1000 },
    },
    scales: {
      x: { ticks: { autoSkip: true } },
      y: { beginAtZero: true },
    },
  }
));

const datasetLabels = computed<string[]>(() => {
  const datasets = (props.data.datasets as Array<{ label?: string }> | undefined);
  return (datasets || []).map(d => d.label ?? 'Series');
});

function isHidden(index: number): boolean {
  const chart = chartRef.value?.chart;
  if (!chart) return false;
  const meta = chart.getDatasetMeta(index);
  return meta.hidden === true;
}

function toggleDataset(index: number) {
  const chart = chartRef.value?.chart;
  if (!chart) return;
  const meta = chart.getDatasetMeta(index);
  meta.hidden = !isHidden(index);
  chart.update();
}

</script>

<script lang="ts">
export default {};
</script>


