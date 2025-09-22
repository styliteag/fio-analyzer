/**
 * Latency Analysis Chart Component
 *
 * Displays multi-axis line chart for latency metrics analysis with average and percentile latencies
 */

import React, { useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

import { useChartTheme } from '../hooks/useChartTheme';
import type { AggregatedData, ChartFilters } from '../types';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface LatencyAnalysisChartProps {
  data: AggregatedData;
  filters?: ChartFilters;
  height?: number;
  className?: string;
}

type LatencyMetric = 'avg_latency' | 'p95_latency' | 'p99_latency';

/**
 * Latency Analysis Chart Component
 */
export const LatencyAnalysisChart: React.FC<LatencyAnalysisChartProps> = ({
  data,
  height = 400,
  className = ''
}) => {
  const { theme, chartOptions } = useChartTheme('latency-analysis', data.series.length, data.blockSizes.length);

  // Metric selection state
  const [selectedMetrics, setSelectedMetrics] = useState<LatencyMetric[]>(['avg_latency', 'p95_latency']);

  // Process chart data
  const chartData = useMemo(() => {
    if (!data.series.length || !data.blockSizes.length) {
      return {
        labels: [],
        datasets: []
      };
    }

    const labels = data.blockSizes;
    const datasets: any[] = [];

    data.series.forEach((series, seriesIndex) => {
      const baseColor = series.color || theme.colors.primary[seriesIndex % theme.colors.primary.length];

      // Average latency dataset (left axis)
      if (selectedMetrics.includes('avg_latency')) {
        const avgData = labels.map(blockSize => {
          const dataPoint = series.data.find(point => point.blockSize === blockSize);
          return dataPoint?.avgLatency || 0;
        });

        if (avgData.some(value => value > 0)) {
          datasets.push({
            label: `${series.hostname} - Avg Latency`,
            data: avgData,
            backgroundColor: baseColor,
            borderColor: baseColor,
            borderWidth: 2,
            tension: 0.1,
            fill: false,
            pointRadius: 4,
            pointHoverRadius: 6,
            yAxisID: 'y'
          });
        }
      }

      // P95 latency dataset (right axis)
      if (selectedMetrics.includes('p95_latency')) {
        const p95Data = labels.map(blockSize => {
          const dataPoint = series.data.find(point => point.blockSize === blockSize);
          return dataPoint?.p95Latency || 0;
        });

        if (p95Data.some(value => value > 0)) {
          datasets.push({
            label: `${series.hostname} - P95 Latency`,
            data: p95Data,
            backgroundColor: `${baseColor}80`,
            borderColor: baseColor,
            borderWidth: 1,
            borderDash: [5, 5],
            tension: 0.1,
            fill: false,
            pointRadius: 3,
            pointHoverRadius: 5,
            yAxisID: 'y1'
          });
        }
      }

      // P99 latency dataset (right axis)
      if (selectedMetrics.includes('p99_latency')) {
        const p99Data = labels.map(blockSize => {
          const dataPoint = series.data.find(point => point.blockSize === blockSize);
          return dataPoint?.p99Latency || 0;
        });

        if (p99Data.some(value => value > 0)) {
          datasets.push({
            label: `${series.hostname} - P99 Latency`,
            data: p99Data,
            backgroundColor: `${baseColor}60`,
            borderColor: baseColor,
            borderWidth: 1,
            borderDash: [2, 2],
            tension: 0.1,
            fill: false,
            pointRadius: 2,
            pointHoverRadius: 4,
            yAxisID: 'y1'
          });
        }
      }
    });

    return {
      labels,
      datasets
    };
  }, [data, theme, selectedMetrics]);

  // Custom chart options for dual-axis latency analysis
  const customOptions = useMemo(() => ({
    ...chartOptions,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      ...chartOptions.plugins,
      title: {
        ...chartOptions.plugins.title,
        text: 'Latency Analysis - Average & Percentiles'
      },
      tooltip: {
        ...chartOptions.plugins.tooltip,
        callbacks: {
          ...chartOptions.plugins.tooltip.callbacks,
          label: (context: any) => {
            const value = context.parsed.y;
            return `${context.dataset.label}: ${value.toFixed(2)} ms`;
          }
        }
      },
      legend: {
        ...chartOptions.plugins.legend,
        position: 'top',
        labels: {
          ...chartOptions.plugins.legend.labels,
          usePointStyle: true,
          padding: 15,
          generateLabels: (chart: any) => {
            const original = ChartJS.defaults.plugins.legend.labels.generateLabels;
            const labels = original ? original(chart) : [];

            // Group labels by series and add visual indicators
            return labels.map((label) => ({
              ...label,
              pointStyle: label.text?.includes('P95') ? 'line' :
                         label.text?.includes('P99') ? 'dash' : 'circle'
            }));
          }
        }
      }
    },
    scales: {
      ...chartOptions.scales,
      x: {
        ...chartOptions.scales.x,
        title: {
          ...chartOptions.scales.x.title,
          text: 'Block Size'
        }
      },
      y: {
        ...chartOptions.scales.y,
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          ...chartOptions.scales.y.title,
          text: 'Average Latency (ms)'
        },
        beginAtZero: true,
        ticks: {
          ...chartOptions.scales.y.ticks,
          callback: function(value: any) {
            return typeof value === 'number' ? `${value.toFixed(1)} ms` : value;
          }
        }
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        title: {
          display: true,
          text: 'Percentile Latency (ms)',
          color: theme.theme.textColor
        },
        grid: {
          drawOnChartArea: false
        },
        ticks: {
          color: theme.theme.textColor,
          callback: function(value: any) {
            return typeof value === 'number' ? `${value.toFixed(1)} ms` : value;
          }
        }
      }
    },
    interaction: {
      mode: 'index',
      intersect: false
    }
  }), [chartOptions, theme]);

  // Toggle metric selection
  const toggleMetric = (metric: LatencyMetric) => {
    setSelectedMetrics(prev =>
      prev.includes(metric)
        ? prev.filter(m => m !== metric)
        : [...prev, metric]
    );
  };

  // Show loading state if no data
  if (!data.series.length || !data.blockSizes.length) {
    return (
      <div
        className={`flex items-center justify-center bg-card rounded-lg border ${className}`}
        style={{ height }}
      >
        <div className="text-center text-muted-foreground">
          <div className="text-lg font-medium mb-2">No Latency Data Available</div>
          <div className="text-sm">
            Select drives and test configurations to view latency analysis
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-card rounded-lg border p-4 ${className}`}>
      {/* Metric Selection Controls */}
      <div className="mb-4 flex flex-wrap gap-2">
        <span className="text-sm font-medium text-foreground mr-2">Metrics:</span>
        {(['avg_latency', 'p95_latency', 'p99_latency'] as LatencyMetric[]).map(metric => (
          <button
            key={metric}
            onClick={() => toggleMetric(metric)}
            className={`px-3 py-1 text-sm rounded border transition-colors ${
              selectedMetrics.includes(metric)
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:bg-accent'
            }`}
          >
            {metric === 'avg_latency' ? 'Average' :
             metric === 'p95_latency' ? 'P95' : 'P99'}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div style={{ height }}>
        {chartData.datasets.length > 0 ? (
          <Line data={chartData} options={customOptions as any} />
        ) : (
          <div className="flex items-center justify-center h-full text-center text-muted-foreground">
            <div>
              <div className="text-lg font-medium mb-2">No Data for Selected Metrics</div>
              <div className="text-sm">
                Select different metrics or check data availability
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Chart Info */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 bg-current" />
          <span>Average (Left Axis)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 border-t-2 border-dashed border-current" />
          <span>P95 (Right Axis)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 border-t border-dotted border-current" />
          <span>P99 (Right Axis)</span>
        </div>
      </div>
    </div>
  );
};

export default LatencyAnalysisChart;