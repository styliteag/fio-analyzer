/**
 * Responsiveness Chart Component
 *
 * Displays horizontal bar chart for responsiveness comparison across different configurations
 */

import React, { useMemo, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

import { useChartTheme } from '../hooks/useChartTheme';
import { getPerformanceTierColor } from '../utils/colorSchemes';
import type { AggregatedData, ChartFilters } from '../types';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface ResponsivenessChartProps {
  data: AggregatedData;
  filters?: ChartFilters;
  height?: number;
  className?: string;
}

type SortMode = 'alphabetical' | 'performance' | 'driveType';
type AggregationMode = 'average' | 'max' | 'median';

/**
 * Responsiveness Chart Component
 */
export const ResponsivenessChart: React.FC<ResponsivenessChartProps> = ({
  data,
  height = 400,
  className = ''
}) => {
  const { theme } = useChartTheme('responsiveness', data.series.length, data.blockSizes.length);

  // Chart configuration state
  const [sortMode, setSortMode] = useState<SortMode>('performance');
  const [aggregationMode, setAggregationMode] = useState<AggregationMode>('average');
  const [showTiers, setShowTiers] = useState(true);

  // Process responsiveness data
  const processedData = useMemo(() => {
    if (!data.series.length) return { labels: [], values: [], colors: [], metadata: [] };

    // Calculate responsiveness for each series
    const seriesData = data.series.map(series => {
      const responsivenessValues = series.data
        .map(point => point.responsiveness)
        .filter(value => value !== null && value !== undefined) as number[];

      if (responsivenessValues.length === 0) return null;

      let aggregatedValue: number;
      switch (aggregationMode) {
        case 'max':
          aggregatedValue = Math.max(...responsivenessValues);
          break;
        case 'median': {
          const sorted = [...responsivenessValues].sort((a, b) => a - b);
          aggregatedValue = sorted[Math.floor(sorted.length / 2)];
          break;
        }
        case 'average':
        default:
          aggregatedValue = responsivenessValues.reduce((sum, val) => sum + val, 0) / responsivenessValues.length;
      }

      return {
        hostname: series.hostname,
        driveModel: series.driveModel,
        driveType: series.driveType,
        protocol: series.protocol,
        value: aggregatedValue,
        rawValues: responsivenessValues,
        label: `${series.hostname}\n${series.driveModel}`,
        fullLabel: `${series.hostname} - ${series.driveModel} (${series.protocol})`
      };
    }).filter(Boolean);

    if (!seriesData.length) return { labels: [], values: [], colors: [], metadata: [] };

    // Sort data based on sort mode
    let sortedData = [...seriesData];
    switch (sortMode) {
      case 'performance':
        sortedData.sort((a, b) => (b?.value || 0) - (a?.value || 0));
        break;
      case 'alphabetical':
        sortedData.sort((a, b) => (a?.hostname || '').localeCompare(b?.hostname || ''));
        break;
      case 'driveType':
        sortedData.sort((a, b) => {
          const typeCompare = (a?.driveType || '').localeCompare(b?.driveType || '');
          return typeCompare !== 0 ? typeCompare : (b?.value || 0) - (a?.value || 0);
        });
        break;
    }

    // Calculate colors based on performance tiers
    const maxValue = Math.max(...seriesData.map(d => d?.value || 0));
    const colors = showTiers
      ? sortedData.map(item => getPerformanceTierColor(item?.value || 0, maxValue, theme.isDark))
      : sortedData.map((_, index) => theme.colors.primary[index % theme.colors.primary.length]);

    return {
      labels: sortedData.map(item => item?.label || ''),
      values: sortedData.map(item => item?.value || 0),
      colors,
      metadata: sortedData
    };
  }, [data.series, sortMode, aggregationMode, showTiers, theme]);

  // Chart data configuration
  const chartData = useMemo(() => ({
    labels: processedData.labels,
    datasets: [{
      label: `${aggregationMode.charAt(0).toUpperCase() + aggregationMode.slice(1)} Responsiveness`,
      data: processedData.values,
      backgroundColor: processedData.colors,
      borderColor: processedData.colors.map(color => `${color}CC`),
      borderWidth: 1,
      borderRadius: 4,
      borderSkipped: false
    }]
  }), [processedData, aggregationMode]);

  // Custom chart options for horizontal bar chart
  const customOptions = useMemo(() => ({
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: 'System Responsiveness Comparison',
        font: {
          size: 16,
          weight: 'bold'
        },
        color: theme.theme.textColor
      },
      tooltip: {
        enabled: true,
        backgroundColor: theme.theme.tooltipBackground,
        titleColor: theme.theme.tooltipText,
        bodyColor: theme.theme.tooltipText,
        borderColor: theme.theme.tooltipBorder,
        borderWidth: 1,
        callbacks: {
          title: (context: any) => {
            const index = context[0].dataIndex;
            const metadata = processedData.metadata[index];
            return metadata?.fullLabel || '';
          },
          label: (context: any) => {
            const value = context.parsed.x;
            const index = context.dataIndex;
            const metadata = processedData.metadata[index];

            const lines = [
              `${aggregationMode.charAt(0).toUpperCase() + aggregationMode.slice(1)}: ${value.toFixed(1)} ops/ms`,
              `Protocol: ${metadata?.protocol || 'N/A'}`,
              `Drive Type: ${metadata?.driveType || 'N/A'}`
            ];

            if (metadata?.rawValues && metadata.rawValues.length > 1) {
              lines.push(`Range: ${Math.min(...metadata.rawValues).toFixed(1)} - ${Math.max(...metadata.rawValues).toFixed(1)} ops/ms`);
            }

            return lines;
          }
        }
      },
      legend: {
        display: false
      }
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Responsiveness (operations/ms)',
          color: theme.theme.textColor,
          font: {
            size: 12
          }
        },
        grid: {
          display: true,
          color: theme.theme.gridColor
        },
        ticks: {
          color: theme.theme.textColor,
          callback: function(value: any) {
            return typeof value === 'number' ? `${value.toFixed(1)}` : value;
          }
        },
        beginAtZero: true
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'Host Configuration',
          color: theme.theme.textColor,
          font: {
            size: 12
          }
        },
        grid: {
          display: false
        },
        ticks: {
          color: theme.theme.textColor,
          font: {
            size: 10
          },
          maxRotation: 0
        }
      }
    },
    interaction: {
      intersect: false
    },
    hover: {
      intersect: false
    }
  }), [theme, processedData, aggregationMode]);

  // Performance tier summary
  const tierSummary = useMemo(() => {
    if (!showTiers || !processedData.values.length) return null;

    const maxValue = Math.max(...processedData.values);
    const tiers = processedData.values.reduce((acc, value) => {
      const ratio = maxValue > 0 ? value / maxValue : 0;
      if (ratio >= 0.8) acc.excellent++;
      else if (ratio >= 0.6) acc.good++;
      else if (ratio >= 0.3) acc.average++;
      else acc.poor++;
      return acc;
    }, { excellent: 0, good: 0, average: 0, poor: 0 });

    return tiers;
  }, [processedData.values, showTiers]);

  // Show loading state if no data
  if (!data.series.length) {
    return (
      <div
        className={`flex items-center justify-center bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}
        style={{ height }}
      >
        <div className="text-center text-gray-600 dark:text-gray-400">
          <div className="text-lg font-medium mb-2">No Responsiveness Data Available</div>
          <div className="text-sm">
            Select drives and test configurations to view responsiveness comparison
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 ${className}`}>
      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-4">
        {/* Sort Mode */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Sort:</span>
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="performance">Performance</option>
            <option value="alphabetical">Alphabetical</option>
            <option value="driveType">Drive Type</option>
          </select>
        </div>

        {/* Aggregation Mode */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Metric:</span>
          <select
            value={aggregationMode}
            onChange={(e) => setAggregationMode(e.target.value as AggregationMode)}
            className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="average">Average</option>
            <option value="max">Maximum</option>
            <option value="median">Median</option>
          </select>
        </div>

        {/* Performance Tiers Toggle */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="show-tiers"
            checked={showTiers}
            onChange={(e) => setShowTiers(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="show-tiers" className="text-sm text-gray-900 dark:text-gray-100">
            Color by Performance
          </label>
        </div>
      </div>

      {/* Chart */}
      <div style={{ height }}>
        {processedData.values.length > 0 ? (
          <Bar data={chartData} options={customOptions as any} />
        ) : (
          <div className="flex items-center justify-center h-full text-center text-gray-600 dark:text-gray-400">
            <div>
              <div className="text-lg font-medium mb-2">No Valid Responsiveness Data</div>
              <div className="text-sm">
                The selected data does not contain valid responsiveness measurements
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Performance Tier Summary */}
      {tierSummary && showTiers && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Performance Distribution</h4>
          <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: '#10B981' }} />
              <span>Excellent: {tierSummary.excellent}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: '#84CC16' }} />
              <span>Good: {tierSummary.good}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: '#F59E0B' }} />
              <span>Average: {tierSummary.average}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: '#EF4444' }} />
              <span>Poor: {tierSummary.poor}</span>
            </div>
          </div>
        </div>
      )}

      {/* Chart Info */}
      <div className="mt-4 text-xs text-gray-600 dark:text-gray-400">
        <div>Responsiveness = 1000 / Average Latency (higher is better)</div>
        <div>Showing {processedData.values.length} configurations sorted by {sortMode}</div>
      </div>
    </div>
  );
};

export default ResponsivenessChart;