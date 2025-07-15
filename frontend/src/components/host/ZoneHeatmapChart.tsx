import React from 'react';
import { Chart, Tooltip, Legend, Title, PointElement, LinearScale } from 'chart.js';
import { Scatter } from 'react-chartjs-2';
import 'chart.js/auto';

// Register necessary Chart.js components
Chart.register(Tooltip, Legend, Title, PointElement, LinearScale);

export interface ZoneHeatmapChartProps {
  data: Array<{
    iops: number;
    avg_latency: number;
    block_size: string;
    queue_depth: number;
    host: string;
    pool: string;
    zone: 'High Performance' | 'Balanced' | 'High Latency' | 'Low Performance';
  }>;
}

const zoneColors: Record<string, string> = {
  'High Performance': '#22c55e', // green
  'Balanced': '#facc15',         // yellow
  'High Latency': '#fb923c',     // orange
  'Low Performance': '#ef4444',  // red
};

const ZoneHeatmapChart: React.FC<ZoneHeatmapChartProps> = ({ data }) => {
  // Group data by zone
  const datasets = Object.keys(zoneColors).map(zone => ({
    label: zone,
    data: data.filter(d => d.zone === zone).map(d => ({
      x: d.avg_latency,
      y: d.iops,
      r: Math.max(6, Math.min(16, d.queue_depth)), // Bubble size by queue depth
      block_size: d.block_size,
      host: d.host,
      pool: d.pool,
    })),
    backgroundColor: zoneColors[zone],
  }));

  const chartData = {
    datasets,
  };

  const options = {
    plugins: {
      legend: { position: 'top' as const },
      title: {
        display: true,
        text: 'Performance Zone Heatmap',
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const d = context.raw;
            return [
              `IOPS: ${d.y}`,
              `Latency: ${d.x} ms`,
              `Queue Depth: ${d.r}`,
              `Block Size: ${d.block_size}`,
              `Host: ${d.host}`,
              `Pool: ${d.pool}`,
            ];
          },
        },
      },
    },
    scales: {
      x: {
        title: { display: true, text: 'Average Latency (ms)' },
        min: 0,
      },
      y: {
        title: { display: true, text: 'IOPS' },
        min: 0,
      },
    },
    elements: {
      point: {
        borderWidth: 1,
        borderColor: '#fff',
      },
    },
    maintainAspectRatio: false,
    responsive: true,
  };

  return (
    <div style={{ height: '500px' }}>
      <Scatter data={chartData} options={options} />
    </div>
  );
};

export default ZoneHeatmapChart;
