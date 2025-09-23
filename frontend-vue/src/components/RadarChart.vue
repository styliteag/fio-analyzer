<template>
  <Radar :data="data" :options="resolvedOptions" />
</template>

<script setup lang="ts">
import { Radar } from 'vue-chartjs';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import type { ChartData, ChartOptions } from 'chart.js';
import { computed } from 'vue';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const props = defineProps<{ data: ChartData; options?: ChartOptions }>();
const resolvedOptions = computed<ChartOptions>(() => (
  props.options ?? {
    animation: false,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'bottom' },
      tooltip: { enabled: true },
    },
    scales: {
      r: {
        beginAtZero: true,
        ticks: { showLabelBackdrop: false },
      },
    },
  }
));
</script>

<script lang="ts">
export default {};
</script>


