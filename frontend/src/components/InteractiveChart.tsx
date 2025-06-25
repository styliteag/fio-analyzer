import React, { useEffect, useRef, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import { ChartTemplate, PerformanceData } from '../types';
import { Download, Eye, EyeOff, BarChart3 } from 'lucide-react';
import { useThemeColors } from '../hooks/useThemeColors';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
);

interface InteractiveChartProps {
  template: ChartTemplate;
  data: PerformanceData[];
}

const InteractiveChart: React.FC<InteractiveChartProps> = ({ template, data }) => {
  const chartRef = useRef<any>(null);
  const [visibleSeries, setVisibleSeries] = useState<Set<string>>(new Set());
  const [chartData, setChartData] = useState<any>(null);
  const themeColors = useThemeColors();

  useEffect(() => {
    if (data.length > 0) {
      const processedData = processDataForTemplate(template, data);
      setChartData(processedData);
      
      // Initialize all series as visible
      const allSeries = new Set(processedData.datasets.map((d: any) => d.label));
      setVisibleSeries(allSeries);
    }
  }, [template, data]);

  const processDataForTemplate = (template: ChartTemplate, data: PerformanceData[]) => {
    const colors = [
      '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
      '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#6B7280'
    ];

    switch (template.id) {
      default:
        return processDefaultChart(data, colors);
    }
  };

  const getMetricValue = (metrics: any, metricName: string, operation?: string): number => {
    // Handle flat structure (e.g., metrics.iops.value)
    if (metrics[metricName]?.value !== undefined && metrics[metricName].value !== null) {
      return metrics[metricName].value;
    }
    
    // Handle operation-specific structure (e.g., metrics.read.iops.value or metrics.write.iops.value)
    if (operation && metrics[operation]?.[metricName]?.value !== undefined && metrics[operation][metricName].value !== null) {
      return metrics[operation][metricName].value;
    }
    
    // Try to find the metric in any operation (combined first, then read/write)
    for (const op of ['combined', 'read', 'write']) {
      if (metrics[op]?.[metricName]?.value !== undefined && metrics[op][metricName].value !== null) {
        return metrics[op][metricName].value;
      }
    }
    
    return 0;
  };

  const processDefaultChart = (data: PerformanceData[], colors: string[]) => {
    // Simple default chart showing IOPS by test name
    const labels = data.map(item => `${item.test_name} (${item.drive_model})`);
    const iopsValues = data.map(item => getMetricValue(item.metrics, 'iops'));

    const datasets = [{
      label: 'IOPS',
      data: iopsValues,
      backgroundColor: colors[0],
      borderColor: colors[0],
      borderWidth: 1,
    }];

    return { labels, datasets };
  };


  const toggleSeriesVisibility = (seriesLabel: string) => {
    const newVisibleSeries = new Set(visibleSeries);
    if (newVisibleSeries.has(seriesLabel)) {
      newVisibleSeries.delete(seriesLabel);
    } else {
      newVisibleSeries.add(seriesLabel);
    }
    setVisibleSeries(newVisibleSeries);

    if (chartRef.current) {
      const chart = chartRef.current;
      const datasetIndex = chart.data.datasets.findIndex((d: any) => d.label === seriesLabel);
      if (datasetIndex !== -1) {
        chart.setDatasetVisibility(datasetIndex, newVisibleSeries.has(seriesLabel));
        chart.update();
      }
    }
  };

  const exportChart = (format: 'png' | 'csv') => {
    if (!chartRef.current) return;

    if (format === 'png') {
      const canvas = chartRef.current.canvas;
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${template.name.toLowerCase().replace(/\s+/g, '-')}-chart.png`;
      link.href = url;
      link.click();
    } else if (format === 'csv') {
      const csvContent = generateCSV(data);
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${template.name.toLowerCase().replace(/\s+/g, '-')}-data.csv`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  const generateCSV = (data: PerformanceData[]) => {
    const headers = ['Drive Model', 'Drive Type', 'Test Name', 'Block Size', 'Pattern', 'Queue Depth', 'Timestamp'];
    const metricHeaders = ['IOPS', 'Avg Latency (ms)', 'Throughput (MB/s)', 'P95 Latency (ms)', 'P99 Latency (ms)'];
    
    const csvRows = [
      [...headers, ...metricHeaders].join(','),
      ...data.map(item => [
        item.drive_model,
        item.drive_type,
        item.test_name,
        item.block_size,
        item.read_write_pattern,
        item.queue_depth,
        item.timestamp,
        getMetricValue(item.metrics, 'iops') || '',
        getMetricValue(item.metrics, 'avg_latency') || '',
        getMetricValue(item.metrics, 'throughput') || getMetricValue(item.metrics, 'bandwidth') || '',
        getMetricValue(item.metrics, 'p95_latency') || '',
        getMetricValue(item.metrics, 'p99_latency') || ''
      ].join(','))
    ];
    
    return csvRows.join('\n');
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        onClick: (_e: any, legendItem: any) => {
          toggleSeriesVisibility(legendItem.text);
        },
        labels: {
          color: themeColors.chart.text,
        },
      },
      title: {
        display: true,
        text: template.name,
        font: {
          size: 16,
          weight: 'bold' as 'bold',
        },
        color: themeColors.chart.text,
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        backgroundColor: themeColors.chart.tooltipBg,
        titleColor: themeColors.text.primary,
        bodyColor: themeColors.text.secondary,
        borderColor: themeColors.chart.tooltipBorder,
        borderWidth: 1,
        callbacks: {
          afterLabel: (context: any) => {
            const dataIndex = context.dataIndex;
            const item = data[dataIndex];
            if (item) {
              return [
                `Drive: ${item.drive_model}`,
                `Pattern: ${item.read_write_pattern}`,
                `Block Size: ${item.block_size}KB`,
                `Queue Depth: ${item.queue_depth}`
              ];
            }
            return [];
          },
        },
      },
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: template.xAxis.replace(/_/g, ' ').toUpperCase(),
          color: themeColors.chart.text,
        },
        ticks: {
          color: themeColors.chart.axis,
        },
        grid: {
          color: themeColors.chart.grid,
        },
      },
      y: {
        display: true,
        title: {
          display: true,
          text: template.yAxis.replace(/_/g, ' ').toUpperCase(),
          color: themeColors.chart.text,
        },
        ticks: {
          color: themeColors.chart.axis,
        },
        grid: {
          color: themeColors.chart.grid,
        },
      },
    },
    interaction: {
      mode: 'nearest' as const,
      axis: 'x' as const,
      intersect: false,
    },
  };

  if (!chartData || data.length === 0) {
    return (
      <div className="theme-card rounded-lg shadow-md p-6 border">
        <div className="text-center py-12">
          <div className="theme-text-tertiary mb-4">
            <BarChart3 size={48} className="mx-auto" />
          </div>
          <p className="theme-text-secondary">Select test runs to view performance data</p>
        </div>
      </div>
    );
  }

  const ChartComponent = template.chartType === 'line' ? Line : Bar;

  return (
    <div className="theme-card rounded-lg shadow-md p-6 border">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold theme-text-primary">{template.name}</h2>
        
        <div className="flex space-x-2">
          <button
            onClick={() => exportChart('png')}
            className="flex items-center px-3 py-2 theme-btn-primary rounded transition-colors"
          >
            <Download size={16} className="mr-1" />
            PNG
          </button>
          <button
            onClick={() => exportChart('csv')}
            className="flex items-center px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
          >
            <Download size={16} className="mr-1" />
            CSV
          </button>
        </div>
      </div>

      {/* Series Toggle Controls */}
      {chartData.datasets.length > 1 && (
        <div className="mb-4">
          <div className="flex flex-wrap gap-2">
            {chartData.datasets.map((dataset: any) => (
              <button
                key={dataset.label}
                onClick={() => toggleSeriesVisibility(dataset.label)}
                className={`flex items-center px-3 py-1 rounded text-sm transition-colors border ${
                  visibleSeries.has(dataset.label)
                    ? 'theme-bg-accent theme-text-accent theme-border-accent'
                    : 'theme-bg-tertiary theme-text-secondary theme-border-primary'
                }`}
              >
                {visibleSeries.has(dataset.label) ? (
                  <Eye size={14} className="mr-1" />
                ) : (
                  <EyeOff size={14} className="mr-1" />
                )}
                {dataset.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="h-96">
        <ChartComponent
          ref={chartRef}
          data={chartData}
          options={chartOptions}
        />
      </div>

      {/* Chart Statistics */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div className="theme-bg-secondary p-3 rounded border theme-border-primary">
          <div className="font-medium theme-text-secondary">Data Points</div>
          <div className="text-lg font-semibold theme-text-primary">{data.length}</div>
        </div>
        <div className="theme-bg-secondary p-3 rounded border theme-border-primary">
          <div className="font-medium theme-text-secondary">Series</div>
          <div className="text-lg font-semibold theme-text-primary">{chartData.datasets.length}</div>
        </div>
        <div className="theme-bg-secondary p-3 rounded border theme-border-primary">
          <div className="font-medium theme-text-secondary">Visible</div>
          <div className="text-lg font-semibold theme-text-primary">{visibleSeries.size}</div>
        </div>
        <div className="theme-bg-secondary p-3 rounded border theme-border-primary">
          <div className="font-medium theme-text-secondary">Chart Type</div>
          <div className="text-lg font-semibold capitalize theme-text-primary">{template.chartType}</div>
        </div>
      </div>
    </div>
  );
};

export default InteractiveChart;