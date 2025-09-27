/**
 * IOPS Comparison Chart Component
 *
 * Displays line chart comparing IOPS performance across different block sizes and patterns
 */

import React, { useMemo } from 'react';
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
import type { AggregatedData, ChartFilters, PatternType } from '../types';

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

interface IOPSComparisonChartProps {
  data: AggregatedData;
  filters?: ChartFilters;
  height?: number;
  className?: string;
}

/**
 * IOPS Comparison Chart Component
 */
export const IOPSComparisonChart: React.FC<IOPSComparisonChartProps> = ({
  data,
  height = 400,
  className = ''
}) => {
  const { theme, chartOptions } = useChartTheme('iops-comparison', data.series.length, data.blockSizes.length);

  // Process chart data
  const chartData = useMemo(() => {
    if (!data.series.length || !data.blockSizes.length) {
      return {
        labels: [],
        datasets: []
      };
    }

    const labels = data.blockSizes;
    const datasets = data.series.map((series, index) => {
      // Extract IOPS data for each block size
      const iopsData = labels.map(blockSize => {
        const dataPoint = series.data.find(point => point.blockSize === blockSize);
        return dataPoint?.iops || 0;
      });

      return {
        label: `${series.hostname} - ${series.driveModel}`,
        data: iopsData,
        backgroundColor: series.color || theme.colors.primary[index % theme.colors.primary.length],
        borderColor: series.color || theme.colors.primary[index % theme.colors.primary.length],
        borderWidth: 2,
        tension: 0.1,
        fill: false,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBorderWidth: 1,
        pointBorderColor: '#fff'
      };
    });

    return {
      labels,
      datasets: datasets.filter(dataset => dataset.data.some(value => value > 0))
    };
  }, [data, theme]);

  // Custom chart options for IOPS comparison
  const customOptions = useMemo(() => ({
    ...chartOptions,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      ...chartOptions.plugins,
      title: {
        ...chartOptions.plugins.title,
        text: 'IOPS Performance Comparison'
      },
      tooltip: {
        ...chartOptions.plugins.tooltip,
        callbacks: {
          ...chartOptions.plugins.tooltip.callbacks,
          label: (context: any) => {
            const value = context.parsed.y;
            return `${context.dataset.label}: ${value.toLocaleString()} IOPS`;
          },
          afterLabel: (context: any) => {
            // Add pattern information if available
            const seriesIndex = context.datasetIndex;
            const blockSizeIndex = context.dataIndex;
            const series = data.series[seriesIndex];
            if (series && series.data[blockSizeIndex]) {
              const point = series.data[blockSizeIndex];
              return `Pattern: ${point.pattern.replace('_', ' ')}`;
            }
            return '';
          }
        }
      },
      legend: {
        ...chartOptions.plugins.legend,
        position: 'top',
        labels: {
          ...chartOptions.plugins.legend.labels,
          usePointStyle: true,
          padding: 20
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
        title: {
          ...chartOptions.scales.y.title,
          text: 'IOPS (Operations/Second)'
        },
        beginAtZero: true,
        ticks: {
          ...chartOptions.scales.y.ticks,
          callback: function(value: any) {
            return typeof value === 'number' ? value.toLocaleString() : value;
          }
        }
      }
    },
    interaction: {
      mode: 'index',
      intersect: false
    },
    hover: {
      mode: 'index',
      intersect: false
    }
  }), [chartOptions, data.series]);

  // Show loading state if no data
  if (!data.series.length || !data.blockSizes.length) {
    return (
      <div
        className={`flex items-center justify-center bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}
        style={{ height }}
      >
        <div className="text-center text-gray-600 dark:text-gray-400">
          <div className="text-lg font-medium mb-2">No IOPS Data Available</div>
          <div className="text-sm">
            Select drives and test configurations to view IOPS comparison
          </div>
        </div>
      </div>
    );
  }

  // Show empty state if no valid datasets
  if (!chartData.datasets.length) {
    return (
      <div
        className={`flex items-center justify-center bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}
        style={{ height }}
      >
        <div className="text-center text-gray-600 dark:text-gray-400">
          <div className="text-lg font-medium mb-2">No Valid IOPS Data</div>
          <div className="text-sm">
            The selected data does not contain valid IOPS measurements
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 ${className}`}>
      <div style={{ height }}>
        <Line data={chartData} options={customOptions as any} />
      </div>

      {/* Chart legend with pattern indicators */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
        {Array.from(new Set(data.series.flatMap(s => s.data.map(d => d.pattern)))).map((pattern: PatternType) => (
          <div key={pattern} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded border"
              style={{
                backgroundColor: pattern.includes('read') ? theme.colors.primary[0] : theme.colors.primary[1] + '40',
                borderColor: pattern.includes('read') ? theme.colors.primary[0] : theme.colors.primary[1]
              }}
            />
            <span className="capitalize">{pattern.replace('_', ' ')}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default IOPSComparisonChart;