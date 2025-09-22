/**
 * Bandwidth Trends Chart Component
 *
 * Displays area chart for bandwidth performance visualization with trend analysis
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
  Filler,
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
  Legend,
  Filler
);

interface BandwidthTrendsChartProps {
  data: AggregatedData;
  filters?: ChartFilters;
  height?: number;
  className?: string;
}

type ViewMode = 'absolute' | 'normalized';

/**
 * Bandwidth Trends Chart Component
 */
export const BandwidthTrendsChart: React.FC<BandwidthTrendsChartProps> = ({
  data,
  height = 400,
  className = ''
}) => {
  const { theme, chartOptions } = useChartTheme('bandwidth-trends', data.series.length, data.blockSizes.length);

  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>('absolute');
  const [showArea, setShowArea] = useState(true);

  // Calculate maximum bandwidth for normalization
  const maxBandwidth = useMemo(() => {
    return Math.max(...data.series.flatMap(series =>
      series.data.map(point => point.bandwidth || 0)
    ));
  }, [data.series]);

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
      const baseColor = series.color || theme.colors.primary[index % theme.colors.primary.length];

      // Extract bandwidth data for each block size
      const bandwidthData = labels.map(blockSize => {
        const dataPoint = series.data.find(point => point.blockSize === blockSize);
        const bandwidth = dataPoint?.bandwidth || 0;

        // Normalize if in normalized mode
        return viewMode === 'normalized' && maxBandwidth > 0
          ? (bandwidth / maxBandwidth) * 100
          : bandwidth;
      });

      return {
        label: `${series.hostname} - ${series.driveModel}`,
        data: bandwidthData,
        backgroundColor: showArea ? `${baseColor}40` : 'transparent',
        borderColor: baseColor,
        borderWidth: 2,
        tension: 0.2,
        fill: showArea,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBorderWidth: 1,
        pointBorderColor: '#fff',
        pointBackgroundColor: baseColor
      };
    });

    return {
      labels,
      datasets: datasets.filter(dataset => dataset.data.some(value => value > 0))
    };
  }, [data, theme, viewMode, maxBandwidth, showArea]);

  // Custom chart options for bandwidth trends
  const customOptions = useMemo(() => ({
    ...chartOptions,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      ...chartOptions.plugins,
      title: {
        ...chartOptions.plugins.title,
        text: `Bandwidth Performance Trends${viewMode === 'normalized' ? ' (Normalized)' : ''}`
      },
      tooltip: {
        ...chartOptions.plugins.tooltip,
        callbacks: {
          ...chartOptions.plugins.tooltip.callbacks,
          label: (context: any) => {
            const value = context.parsed.y;
            if (viewMode === 'normalized') {
              return `${context.dataset.label}: ${value.toFixed(1)}%`;
            } else {
              return `${context.dataset.label}: ${value.toFixed(1)} MB/s`;
            }
          },
          afterLabel: (context: any) => {
            // Add pattern information if available
            const seriesIndex = context.datasetIndex;
            const blockSizeIndex = context.dataIndex;
            const series = data.series[seriesIndex];
            if (series && series.data[blockSizeIndex]) {
              const point = series.data[blockSizeIndex];
              return [
                `Pattern: ${point.pattern.replace('_', ' ')}`,
                `Block Size: ${point.blockSize}`
              ];
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
          text: viewMode === 'normalized' ? 'Relative Performance (%)' : 'Bandwidth (MB/s)'
        },
        beginAtZero: true,
        max: viewMode === 'normalized' ? 100 : undefined,
        ticks: {
          ...chartOptions.scales.y.ticks,
          callback: function(value: any) {
            if (typeof value === 'number') {
              return viewMode === 'normalized'
                ? `${value.toFixed(0)}%`
                : `${value.toFixed(1)} MB/s`;
            }
            return value;
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
    },
    elements: {
      ...chartOptions.elements,
      line: {
        ...chartOptions.elements?.line,
        tension: 0.2
      }
    }
  }), [chartOptions, viewMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Calculate trend statistics
  const trendStats = useMemo(() => {
    if (!data.series.length) return null;

    const stats = data.series.map(series => {
      const bandwidthValues = series.data
        .map(point => point.bandwidth || 0)
        .filter(value => value > 0);

      if (bandwidthValues.length < 2) return null;

      const avg = bandwidthValues.reduce((sum, val) => sum + val, 0) / bandwidthValues.length;
      const max = Math.max(...bandwidthValues);
      const min = Math.min(...bandwidthValues);

      return {
        hostname: series.hostname,
        driveModel: series.driveModel,
        avg: avg.toFixed(1),
        max: max.toFixed(1),
        min: min.toFixed(1),
        variance: ((max - min) / avg * 100).toFixed(1)
      };
    }).filter(Boolean);

    return stats;
  }, [data.series]);

  // Show loading state if no data
  if (!data.series.length || !data.blockSizes.length) {
    return (
      <div
        className={`flex items-center justify-center bg-card rounded-lg border ${className}`}
        style={{ height }}
      >
        <div className="text-center text-muted-foreground">
          <div className="text-lg font-medium mb-2">No Bandwidth Data Available</div>
          <div className="text-sm">
            Select drives and test configurations to view bandwidth trends
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-card rounded-lg border p-4 ${className}`}>
      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-4">
        {/* View Mode Toggle */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">View:</span>
          <div className="flex border rounded">
            <button
              onClick={() => setViewMode('absolute')}
              className={`px-3 py-1 text-sm transition-colors ${
                viewMode === 'absolute'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:bg-accent'
              }`}
            >
              Absolute
            </button>
            <button
              onClick={() => setViewMode('normalized')}
              className={`px-3 py-1 text-sm transition-colors border-l ${
                viewMode === 'normalized'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:bg-accent'
              }`}
            >
              Normalized
            </button>
          </div>
        </div>

        {/* Area Fill Toggle */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="show-area"
            checked={showArea}
            onChange={(e) => setShowArea(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="show-area" className="text-sm text-foreground">
            Show Area Fill
          </label>
        </div>
      </div>

      {/* Chart */}
      <div style={{ height }}>
        {chartData.datasets.length > 0 ? (
          <Line data={chartData} options={customOptions as any} />
        ) : (
          <div className="flex items-center justify-center h-full text-center text-muted-foreground">
            <div>
              <div className="text-lg font-medium mb-2">No Valid Bandwidth Data</div>
              <div className="text-sm">
                The selected data does not contain valid bandwidth measurements
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Trend Statistics */}
      {trendStats && trendStats.length > 0 && (
        <div className="mt-4 space-y-2">
          <h4 className="text-sm font-medium text-foreground">Performance Summary</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
            {trendStats.map((stat, index) => (
              <div key={index} className="bg-muted/50 rounded p-2">
                <div className="font-medium text-foreground mb-1">
                  {stat?.hostname} - {stat?.driveModel}
                </div>
                <div className="text-muted-foreground space-y-0.5">
                  <div>Avg: {stat?.avg} MB/s</div>
                  <div>Range: {stat?.min} - {stat?.max} MB/s</div>
                  <div>Variance: {stat?.variance}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pattern Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
        {Array.from(new Set(data.series.flatMap(s => s.data.map(d => d.pattern)))).map((pattern: PatternType) => (
          <div key={pattern} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded border"
              style={{
                backgroundColor: pattern.includes('read') ? theme.colors.primary[0] + '40' : theme.colors.primary[1] + '40',
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

export default BandwidthTrendsChart;