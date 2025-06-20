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
      case 'iops-comparison':
        return processIOPSComparison(data, colors);
      
      case 'latency-distribution':
        return processLatencyDistribution(data, colors);
      
      case 'throughput-blocksize':
        return processThroughputBlockSize(data, colors);
      
      case 'performance-over-time':
        return processPerformanceOverTime(data, colors);
      
      case 'queue-depth-impact':
        return processQueueDepthImpact(data, colors);
      
      default:
        return processIOPSComparison(data, colors);
    }
  };

  const processIOPSComparison = (data: PerformanceData[], colors: string[]) => {
    const groupedData = new Map<string, Map<string, number>>();
    
    data.forEach(item => {
      const driveKey = item.drive_model;
      const patternKey = item.read_write_pattern.replace(/_/g, ' ').toUpperCase();
      
      if (!groupedData.has(driveKey)) {
        groupedData.set(driveKey, new Map());
      }
      
      const iopsValue = item.metrics.iops?.value || 0;
      groupedData.get(driveKey)!.set(patternKey, iopsValue);
    });

    const labels = Array.from(groupedData.keys());
    const patterns = Array.from(new Set(
      data.map(item => item.read_write_pattern.replace(/_/g, ' ').toUpperCase())
    ));

    const datasets = patterns.map((pattern, index) => ({
      label: pattern,
      data: labels.map(label => groupedData.get(label)?.get(pattern) || 0),
      backgroundColor: colors[index % colors.length],
      borderColor: colors[index % colors.length],
      borderWidth: 1,
    }));

    return { labels, datasets };
  };

  const processLatencyDistribution = (data: PerformanceData[], colors: string[]) => {
    const labels = data.map(item => item.drive_model);
    const metrics = ['avg_latency', 'p95_latency', 'p99_latency'];
    
    const datasets = metrics.map((metric, index) => ({
      label: metric.replace(/_/g, ' ').toUpperCase(),
      data: data.map(item => item.metrics[metric]?.value || 0),
      backgroundColor: colors[index % colors.length],
      borderColor: colors[index % colors.length],
      borderWidth: 1,
    }));

    return { labels, datasets };
  };

  const processThroughputBlockSize = (data: PerformanceData[], colors: string[]) => {
    const groupedData = new Map<string, Map<number, number>>();
    
    data.forEach(item => {
      const driveKey = item.drive_model;
      const blockSize = item.block_size;
      
      if (!groupedData.has(driveKey)) {
        groupedData.set(driveKey, new Map());
      }
      
      const throughputValue = item.metrics.throughput?.value || 0;
      groupedData.get(driveKey)!.set(blockSize, throughputValue);
    });

    const blockSizes = Array.from(new Set(data.map(item => item.block_size))).sort((a, b) => a - b);
    const drives = Array.from(groupedData.keys());

    const datasets = drives.map((drive, index) => ({
      label: drive,
      data: blockSizes.map(size => groupedData.get(drive)?.get(size) || 0),
      borderColor: colors[index % colors.length],
      backgroundColor: colors[index % colors.length] + '20',
      tension: 0.1,
    }));

    return { 
      labels: blockSizes.map(size => `${size}KB`), 
      datasets 
    };
  };

  const processPerformanceOverTime = (data: PerformanceData[], colors: string[]) => {
    const sortedData = [...data].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const groupedData = new Map<string, Array<{x: string, y: number}>>();
    
    sortedData.forEach(item => {
      const driveKey = item.drive_model;
      const timestamp = item.timestamp;
      const iopsValue = item.metrics.iops?.value || 0;
      
      if (!groupedData.has(driveKey)) {
        groupedData.set(driveKey, []);
      }
      
      groupedData.get(driveKey)!.push({ x: timestamp, y: iopsValue });
    });

    const datasets = Array.from(groupedData.entries()).map(([drive, points], index) => ({
      label: drive,
      data: points,
      borderColor: colors[index % colors.length],
      backgroundColor: colors[index % colors.length] + '20',
      tension: 0.1,
    }));

    return { datasets };
  };

  const processQueueDepthImpact = (data: PerformanceData[], colors: string[]) => {
    const groupedData = new Map<string, Map<number, {iops: number, latency: number}>>();
    
    data.forEach(item => {
      const driveType = item.drive_type;
      const queueDepth = item.queue_depth;
      
      if (!groupedData.has(driveType)) {
        groupedData.set(driveType, new Map());
      }
      
      const iopsValue = item.metrics.iops?.value || 0;
      const latencyValue = item.metrics.avg_latency?.value || 0;
      
      groupedData.get(driveType)!.set(queueDepth, { iops: iopsValue, latency: latencyValue });
    });

    const queueDepths = Array.from(new Set(data.map(item => item.queue_depth))).sort((a, b) => a - b);
    const driveTypes = Array.from(groupedData.keys());

    const datasets = driveTypes.flatMap((driveType, index) => [
      {
        label: `${driveType} - IOPS`,
        data: queueDepths.map(qd => groupedData.get(driveType)?.get(qd)?.iops || 0),
        borderColor: colors[index % colors.length],
        backgroundColor: colors[index % colors.length] + '20',
        yAxisID: 'y',
        tension: 0.1,
      },
      {
        label: `${driveType} - Latency`,
        data: queueDepths.map(qd => groupedData.get(driveType)?.get(qd)?.latency || 0),
        borderColor: colors[(index + driveTypes.length) % colors.length],
        backgroundColor: colors[(index + driveTypes.length) % colors.length] + '20',
        yAxisID: 'y1',
        tension: 0.1,
      }
    ]);

    return { 
      labels: queueDepths.map(qd => `QD ${qd}`), 
      datasets 
    };
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
        item.metrics.iops?.value || '',
        item.metrics.avg_latency?.value || '',
        item.metrics.throughput?.value || '',
        item.metrics.p95_latency?.value || '',
        item.metrics.p99_latency?.value || ''
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
      },
      title: {
        display: true,
        text: template.name,
        font: {
          size: 16,
          weight: 'bold' as 'bold',
        },
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
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
    scales: template.id === 'queue-depth-impact' ? {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Queue Depth',
        },
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: 'IOPS',
        },
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: true,
          text: 'Latency (ms)',
        },
        grid: {
          drawOnChartArea: false,
        },
      },
    } : template.id === 'performance-over-time' ? {
      x: {
        type: 'time' as const,
        display: true,
        title: {
          display: true,
          text: 'Date',
        },
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'IOPS',
        },
      },
    } : {
      x: {
        display: true,
        title: {
          display: true,
          text: template.xAxis.replace(/_/g, ' ').toUpperCase(),
        },
      },
      y: {
        display: true,
        title: {
          display: true,
          text: template.yAxis.replace(/_/g, ' ').toUpperCase(),
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
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <BarChart3 size={48} className="mx-auto" />
          </div>
          <p className="text-gray-600">Select test runs to view performance data</p>
        </div>
      </div>
    );
  }

  const ChartComponent = template.chartType === 'line' || template.id === 'throughput-blocksize' || 
                         template.id === 'performance-over-time' || template.id === 'queue-depth-impact' 
                         ? Line : Bar;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">{template.name}</h2>
        
        <div className="flex space-x-2">
          <button
            onClick={() => exportChart('png')}
            className="flex items-center px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            <Download size={16} className="mr-1" />
            PNG
          </button>
          <button
            onClick={() => exportChart('csv')}
            className="flex items-center px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
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
                className={`flex items-center px-3 py-1 rounded text-sm transition-colors ${
                  visibleSeries.has(dataset.label)
                    ? 'bg-blue-100 text-blue-800 border border-blue-300'
                    : 'bg-gray-100 text-gray-600 border border-gray-300'
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
        <div className="bg-gray-50 p-3 rounded">
          <div className="font-medium text-gray-700">Data Points</div>
          <div className="text-lg font-semibold">{data.length}</div>
        </div>
        <div className="bg-gray-50 p-3 rounded">
          <div className="font-medium text-gray-700">Series</div>
          <div className="text-lg font-semibold">{chartData.datasets.length}</div>
        </div>
        <div className="bg-gray-50 p-3 rounded">
          <div className="font-medium text-gray-700">Visible</div>
          <div className="text-lg font-semibold">{visibleSeries.size}</div>
        </div>
        <div className="bg-gray-50 p-3 rounded">
          <div className="font-medium text-gray-700">Chart Type</div>
          <div className="text-lg font-semibold capitalize">{template.chartType}</div>
        </div>
      </div>
    </div>
  );
};

export default InteractiveChart;