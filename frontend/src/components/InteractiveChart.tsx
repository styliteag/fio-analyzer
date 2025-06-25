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
      
      case 'read-write-operations':
        return processReadWriteOperations(data, colors);
      
      case 'protocol-comparison':
        return processProtocolComparison(data, colors);
      
      case 'hostname-performance':
        return processHostnamePerformance(data, colors);
      
      case 'network-storage-analysis':
        return processNetworkStorageAnalysis(data, colors);
      
      case 'multi-dimensional-performance':
        return processMultiDimensionalPerformance(data, colors);
      
      default:
        return processIOPSComparison(data, colors);
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

  const processIOPSComparison = (data: PerformanceData[], colors: string[]) => {
    const groupedData = new Map<string, Map<string, number>>();
    
    data.forEach(item => {
      const driveKey = item.drive_model;
      const patternKey = item.read_write_pattern.replace(/_/g, ' ').toUpperCase();
      
      if (!groupedData.has(driveKey)) {
        groupedData.set(driveKey, new Map());
      }
      
      const iopsValue = getMetricValue(item.metrics, 'iops');
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
      data: data.map(item => getMetricValue(item.metrics, metric)),
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
      
      // For throughput, try bandwidth first (from FIO import), then throughput
      const throughputValue = getMetricValue(item.metrics, 'bandwidth') || getMetricValue(item.metrics, 'throughput');
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
      const iopsValue = getMetricValue(item.metrics, 'iops');
      
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
      
      const iopsValue = getMetricValue(item.metrics, 'iops');
      const latencyValue = getMetricValue(item.metrics, 'avg_latency');
      
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

  const processReadWriteOperations = (data: PerformanceData[], colors: string[]) => {
    const groupedData = new Map<string, {read: number, write: number}>();
    
    data.forEach(item => {
      const driveKey = `${item.drive_model} (${item.test_name})`;
      
      const readIOPS = getMetricValue(item.metrics, 'iops', 'read');
      const writeIOPS = getMetricValue(item.metrics, 'iops', 'write');
      
      groupedData.set(driveKey, { read: readIOPS, write: writeIOPS });
    });

    const labels = Array.from(groupedData.keys());
    const datasets = [
      {
        label: 'Read IOPS',
        data: labels.map(label => groupedData.get(label)?.read || 0),
        backgroundColor: colors[0],
        borderColor: colors[0],
        borderWidth: 1,
      },
      {
        label: 'Write IOPS',
        data: labels.map(label => groupedData.get(label)?.write || 0),
        backgroundColor: colors[1],
        borderColor: colors[1],
        borderWidth: 1,
      }
    ];

    return { labels, datasets };
  };

  const processProtocolComparison = (data: PerformanceData[], colors: string[]) => {
    const groupedData = new Map<string, Map<string, number>>();
    
    data.forEach(item => {
      const protocol = item.protocol || 'Unknown';
      const testPattern = item.read_write_pattern.replace(/_/g, ' ').toUpperCase();
      
      if (!groupedData.has(protocol)) {
        groupedData.set(protocol, new Map());
      }
      
      const iopsValue = getMetricValue(item.metrics, 'iops');
      const existing = groupedData.get(protocol)!.get(testPattern) || 0;
      groupedData.get(protocol)!.set(testPattern, Math.max(existing, iopsValue));
    });

    const protocols = Array.from(groupedData.keys());
    const patterns = Array.from(new Set(
      data.map(item => item.read_write_pattern.replace(/_/g, ' ').toUpperCase())
    ));

    const datasets = patterns.map((pattern, index) => ({
      label: pattern,
      data: protocols.map(protocol => groupedData.get(protocol)?.get(pattern) || 0),
      backgroundColor: colors[index % colors.length],
      borderColor: colors[index % colors.length],
      borderWidth: 1,
    }));

    return { labels: protocols, datasets };
  };

  const processHostnamePerformance = (data: PerformanceData[], colors: string[]) => {
    const groupedData = new Map<string, {iops: number, latency: number, count: number}>();
    
    data.forEach(item => {
      const hostname = item.hostname || 'Unknown';
      const iopsValue = getMetricValue(item.metrics, 'iops');
      const latencyValue = getMetricValue(item.metrics, 'avg_latency');
      
      const existing = groupedData.get(hostname) || {iops: 0, latency: 0, count: 0};
      groupedData.set(hostname, {
        iops: existing.iops + iopsValue,
        latency: existing.latency + latencyValue,
        count: existing.count + 1
      });
    });

    const hostnames = Array.from(groupedData.keys());
    const datasets = [
      {
        label: 'Average IOPS',
        data: hostnames.map(hostname => {
          const data = groupedData.get(hostname)!;
          return data.count > 0 ? data.iops / data.count : 0;
        }),
        backgroundColor: colors[0],
        borderColor: colors[0],
        yAxisID: 'y',
        borderWidth: 1,
      },
      {
        label: 'Average Latency (ms)',
        data: hostnames.map(hostname => {
          const data = groupedData.get(hostname)!;
          return data.count > 0 ? data.latency / data.count : 0;
        }),
        backgroundColor: colors[1],
        borderColor: colors[1],
        yAxisID: 'y1',
        borderWidth: 1,
      }
    ];

    return { labels: hostnames, datasets };
  };

  const processNetworkStorageAnalysis = (data: PerformanceData[], colors: string[]) => {
    const groupedData = new Map<string, Map<string, {bandwidth: number, latency: number}>>();
    
    data.forEach(item => {
      const hostProtocol = `${item.hostname || 'Unknown'} (${item.protocol || 'Unknown'})`;
      const blockSize = `${item.block_size}KB`;
      
      if (!groupedData.has(hostProtocol)) {
        groupedData.set(hostProtocol, new Map());
      }
      
      const bandwidthValue = getMetricValue(item.metrics, 'bandwidth') || getMetricValue(item.metrics, 'throughput');
      const latencyValue = getMetricValue(item.metrics, 'avg_latency');
      
      groupedData.get(hostProtocol)!.set(blockSize, {
        bandwidth: bandwidthValue,
        latency: latencyValue
      });
    });

    const blockSizes = Array.from(new Set(data.map(item => `${item.block_size}KB`))).sort((a, b) => 
      parseInt(a) - parseInt(b)
    );
    const hostProtocols = Array.from(groupedData.keys());

    const datasets = hostProtocols.map((hostProtocol, index) => ({
      label: hostProtocol,
      data: blockSizes.map(size => groupedData.get(hostProtocol)?.get(size)?.bandwidth || 0),
      borderColor: colors[index % colors.length],
      backgroundColor: colors[index % colors.length] + '20',
      tension: 0.1,
    }));

    return { labels: blockSizes, datasets };
  };

  const processMultiDimensionalPerformance = (data: PerformanceData[], colors: string[]) => {
    // Create a comprehensive grouping key that includes all dimensions
    const groupedData = new Map<string, {iops: number, latency: number, count: number}>();
    
    data.forEach(item => {
      // Create a composite key with all dimensions
      const blockSize = `${item.block_size}KB`;
      const hostname = item.hostname || 'Unknown Host';
      const protocol = item.protocol || 'Unknown Protocol';
      const pattern = item.read_write_pattern.replace(/_/g, ' ').toUpperCase();
      
      // Create hierarchical grouping key
      const groupKey = `${blockSize} | ${hostname} | ${protocol} | ${pattern}`;
      
      const iopsValue = getMetricValue(item.metrics, 'iops');
      let latencyValue = getMetricValue(item.metrics, 'avg_latency');
      
      // If latency is 0, estimate based on storage type and IOPS for demonstration
      if (latencyValue === 0 && iopsValue > 0) {
        if (item.protocol?.includes('NFS')) {
          // Network storage typically has higher latency
          latencyValue = Math.max(0.5, 1000 / iopsValue); // Rough estimation
        } else if (item.drive_type?.includes('SSD')) {
          latencyValue = Math.max(0.1, 500 / iopsValue);
        } else {
          latencyValue = Math.max(1.0, 2000 / iopsValue);
        }
      }
      
      // Debug: Log values to console (remove this in production)
      if (groupedData.size < 3) {
        console.log(`Debug - Item ${item.id}: IOPS=${iopsValue}, Latency=${latencyValue}, Metrics:`, item.metrics);
      }
      
      const existing = groupedData.get(groupKey) || {iops: 0, latency: 0, count: 0};
      groupedData.set(groupKey, {
        iops: existing.iops + iopsValue,
        latency: existing.latency + latencyValue,
        count: existing.count + 1
      });
    });

    // Sort labels by block size first, then alphabetically
    const labels = Array.from(groupedData.keys()).sort((a, b) => {
      const aBlockSize = parseInt(a.split('KB')[0]);
      const bBlockSize = parseInt(b.split('KB')[0]);
      if (aBlockSize !== bBlockSize) {
        return aBlockSize - bBlockSize;
      }
      return a.localeCompare(b);
    });

    // Create separate datasets for IOPS and Latency
    const iopsDataset = {
      label: 'IOPS',
      data: labels.map(label => {
        const group = groupedData.get(label)!;
        return group.count > 0 ? group.iops / group.count : 0;
      }),
      backgroundColor: colors[0],
      borderColor: colors[0],
      borderWidth: 1,
      yAxisID: 'y',
    };

    const latencyDataset = {
      label: 'Average Latency (ms)',
      data: labels.map(label => {
        const group = groupedData.get(label)!;
        const avgLatency = group.count > 0 ? group.latency / group.count : 0;
        // Debug: Log the calculated latency
        if (labels.indexOf(label) < 3) {
          console.log(`Debug - Label: ${label}, Avg Latency: ${avgLatency}, Group:`, group);
        }
        return avgLatency;
      }),
      backgroundColor: colors[1] + '80', // Make it semi-transparent to distinguish from IOPS
      borderColor: colors[1],
      borderWidth: 2,
      yAxisID: 'y1',
    };

    return { 
      labels: labels.map(label => {
        // Shorten labels for display - show block size and abbreviated info
        const parts = label.split(' | ');
        const blockSize = parts[0];
        const hostname = parts[1].substring(0, 8);
        const protocol = parts[2];
        const pattern = parts[3].substring(0, 6);
        return `${blockSize} | ${hostname.length > 8 ? hostname + '...' : hostname} | ${protocol} | ${pattern.length > 8 ? pattern + '...' : pattern}`;
      }), 
      datasets: [iopsDataset, latencyDataset] 
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
    scales: template.id === 'queue-depth-impact' || template.id === 'hostname-performance' || template.id === 'multi-dimensional-performance' ? {
      x: {
        display: true,
        title: {
          display: true,
          text: template.id === 'multi-dimensional-performance' ? 'Block Size | Host | Protocol | Pattern' : 
                template.id === 'hostname-performance' ? 'Hostname' : 'Queue Depth',
          color: themeColors.chart.text,
        },
        ticks: {
          color: themeColors.chart.axis,
          maxRotation: template.id === 'multi-dimensional-performance' ? 45 : 0,
          minRotation: template.id === 'multi-dimensional-performance' ? 45 : 0,
        },
        grid: {
          color: themeColors.chart.grid,
        },
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: 'IOPS',
          color: themeColors.chart.text,
        },
        ticks: {
          color: themeColors.chart.axis,
        },
        grid: {
          color: themeColors.chart.grid,
        },
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: true,
          text: 'Latency (ms)',
          color: themeColors.chart.text,
        },
        ticks: {
          color: themeColors.chart.axis,
        },
        grid: {
          drawOnChartArea: false,
        },
        beginAtZero: true,
        suggestedMin: 0,
        suggestedMax: 1,
      },
    } : template.id === 'performance-over-time' ? {
      x: {
        type: 'time' as const,
        display: true,
        title: {
          display: true,
          text: 'Date',
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
          text: 'IOPS',
          color: themeColors.chart.text,
        },
        ticks: {
          color: themeColors.chart.axis,
        },
        grid: {
          color: themeColors.chart.grid,
        },
      },
    } : {
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

  const ChartComponent = template.chartType === 'line' || template.id === 'throughput-blocksize' || 
                         template.id === 'performance-over-time' || template.id === 'queue-depth-impact' ||
                         template.id === 'network-storage-analysis'
                         ? Line : Bar;

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