import { memo, useMemo, useState, useCallback } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  ChartOptions,
  TooltipItem
} from 'chart.js';
import { BarChart, TrendingUp, Clock, Cpu, Maximize2, Eye, EyeOff } from 'lucide-react';
import Card from './ui/Card';
import Button from './ui/Button';
import type { ConfigurationComparison } from '../utils/configurationMatcher';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

interface MultiChartGridProps {
  comparisons: ConfigurationComparison[];
  selectedComparisonIndex: number;
  className?: string;
}

interface ChartState {
  highlightedHost: string | null;
  hiddenHostLabels: Set<string>; // Now tracks full labels instead of just hostnames
  maximizedChart: string | null;
}

function MultiChartGrid({ comparisons, selectedComparisonIndex, className = '' }: MultiChartGridProps) {
  const [chartState, setChartState] = useState<ChartState>({
    highlightedHost: null,
    hiddenHostLabels: new Set(),
    maximizedChart: null
  });

  const selectedComparison = comparisons[selectedComparisonIndex];

  const handleHostHighlight = useCallback((hostname: string | null) => {
    setChartState(prev => ({ ...prev, highlightedHost: hostname }));
  }, []);

  const toggleHostVisibility = useCallback((hostLabel: string) => {
    setChartState(prev => {
      const newHiddenHostLabels = new Set(prev.hiddenHostLabels);
      if (newHiddenHostLabels.has(hostLabel)) {
        newHiddenHostLabels.delete(hostLabel);
      } else {
        newHiddenHostLabels.add(hostLabel);
      }
      return { ...prev, hiddenHostLabels: newHiddenHostLabels };
    });
  }, []);

  const toggleMaximize = useCallback((chartId: string) => {
    setChartState(prev => ({
      ...prev,
      maximizedChart: prev.maximizedChart === chartId ? null : chartId
    }));
  }, []);

  const chartData = useMemo(() => {
    if (!selectedComparison) return null;

    // Create unique IDs and labels for all hosts
    const allHostInfo = selectedComparison.hostData.map((data, index) => {
      const hostname = data.hostname;
      const protocol = data.run.protocol || 'Unknown';
      const driveType = data.run.drive_type || 'Unknown';
      const driveModel = data.run.drive_model || 'Unknown';
      const uniqueId = `${hostname}-${protocol}-${driveType}-${driveModel}-${index}`;
      const displayLabel = `${hostname} (${protocol} - ${driveType} - ${driveModel})`;
      return { uniqueId, displayLabel, data };
    });

    // Filter out hidden entries
    const visibleHostInfo = allHostInfo.filter(info => 
      !chartState.hiddenHostLabels.has(info.uniqueId)
    );

    const visibleHostData = visibleHostInfo.map(info => info.data);
    const hostLabels = visibleHostInfo.map(info => info.displayLabel);
    const colors = [
      '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 
      '#ec4899', '#14b8a6', '#6366f1', '#f472b6', '#f87171'
    ];

    const getBarColor = (index: number, baseColor: string) => {
      if (chartState.highlightedHost === null) return baseColor;
      const currentLabel = hostLabels[index];
      return chartState.highlightedHost === currentLabel ? baseColor : baseColor + '40';
    };

    return {
      iops: {
        labels: hostLabels,
        datasets: [{
          label: 'IOPS',
          data: visibleHostData.map(data => data.metrics.iops || 0),
          backgroundColor: hostLabels.map((_, idx) => 
            getBarColor(idx, colors[idx % colors.length])
          ),
          borderColor: hostLabels.map((_, idx) => colors[idx % colors.length]),
          borderWidth: chartState.highlightedHost ? 2 : 1,
        }]
      },
      bandwidth: {
        labels: hostLabels,
        datasets: [{
          label: 'Bandwidth (MB/s)',
          data: visibleHostData.map(data => data.metrics.bandwidth || 0),
          backgroundColor: hostLabels.map((_, idx) => 
            getBarColor(idx, colors[idx % colors.length])
          ),
          borderColor: hostLabels.map((_, idx) => colors[idx % colors.length]),
          borderWidth: chartState.highlightedHost ? 2 : 1,
        }]
      },
      latency: {
        labels: hostLabels,
        datasets: [
          {
            label: 'Avg Latency (μs)',
            data: visibleHostData.map(data => data.metrics.avg_latency || 0),
            backgroundColor: hostLabels.map((_, idx) => 
              getBarColor(idx, colors[idx % colors.length] + '60')
            ),
            borderColor: hostLabels.map((_, idx) => colors[idx % colors.length]),
            borderWidth: chartState.highlightedHost ? 2 : 1,
            yAxisID: 'y',
          },
          {
            label: 'P95 Latency (μs)',
            data: visibleHostData.map(data => data.metrics.p95_latency || 0),
            backgroundColor: hostLabels.map((_, idx) => 
              getBarColor(idx, colors[idx % colors.length])
            ),
            borderColor: hostLabels.map((_, idx) => colors[idx % colors.length]),
            borderWidth: chartState.highlightedHost ? 2 : 1,
            yAxisID: 'y',
          },
          {
            label: 'P99 Latency (μs)',
            data: visibleHostData.map(data => data.metrics.p99_latency || 0),
            backgroundColor: hostLabels.map((_, idx) => 
              getBarColor(idx, colors[idx % colors.length] + '80')
            ),
            borderColor: hostLabels.map((_, idx) => colors[idx % colors.length]),
            borderWidth: chartState.highlightedHost ? 2 : 1,
            yAxisID: 'y',
          }
        ]
      }
    };
  }, [selectedComparison, chartState]);

  const baseChartOptions: ChartOptions<'bar'> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          boxWidth: 12,
          font: { size: 11 }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleFont: { size: 12 },
        bodyFont: { size: 11 },
        padding: 8,
        callbacks: {
          afterLabel: (context: TooltipItem<'bar'>) => {
            // Extract hostname from the full label format "hostname (protocol - type - model)"
            const fullLabel = context.label as string;
            const hostname = fullLabel.split(' (')[0];
            const hostData = selectedComparison?.hostData.find(
              data => data.hostname === hostname
            );
            if (hostData) {
              return [
                `Test: ${hostData.run.test_name || 'N/A'}`,
                `Timestamp: ${new Date(hostData.run.timestamp).toLocaleString()}`
              ];
            }
            return [];
          }
        }
      }
    },
    scales: {
      x: {
        ticks: { 
          font: { size: 10 },
          maxRotation: 45
        },
        grid: { display: false }
      },
      y: {
        beginAtZero: true,
        ticks: { font: { size: 10 } },
        grid: { color: 'rgba(0, 0, 0, 0.1)' }
      }
    },
    onHover: (_, elements) => {
      if (elements.length > 0) {
        const elementIndex = elements[0].index;
        const hostLabel = chartData?.iops.labels[elementIndex];
        if (hostLabel && hostLabel !== chartState.highlightedHost) {
          handleHostHighlight(hostLabel);
        }
      } else if (chartState.highlightedHost) {
        handleHostHighlight(null);
      }
    }
  }), [selectedComparison, chartData, chartState.highlightedHost, handleHostHighlight]);

  if (!selectedComparison || !chartData) {
    return (
      <div className={`${className} flex items-center justify-center h-96`}>
        <div className="text-center theme-text-secondary">
          <BarChart className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>Select a configuration to view comparison charts</p>
        </div>
      </div>
    );
  }

  const charts = [
    {
      id: 'iops',
      title: 'IOPS Performance',
      icon: TrendingUp,
      data: chartData.iops,
      options: { ...baseChartOptions, plugins: { ...baseChartOptions.plugins, title: { display: true, text: 'IOPS' } } }
    },
    {
      id: 'bandwidth',
      title: 'Bandwidth Performance',
      icon: Cpu,
      data: chartData.bandwidth,
      options: { ...baseChartOptions, plugins: { ...baseChartOptions.plugins, title: { display: true, text: 'Bandwidth (MB/s)' } } }
    },
    {
      id: 'latency',
      title: 'Latency Comparison',
      icon: Clock,
      data: chartData.latency,
      options: { ...baseChartOptions, plugins: { ...baseChartOptions.plugins, title: { display: true, text: 'Latency (μs)' } } }
    }
  ];

  const maximized = chartState.maximizedChart;

  return (
    <div className={className}>
      {/* Host controls */}
      <div className="mb-4 flex flex-wrap gap-2">
        {selectedComparison.hostData.map(({ hostname, run }, index) => {
          // Create a unique identifier including the array index to ensure uniqueness
          const uniqueId = `${hostname}-${run.protocol}-${run.drive_type}-${run.drive_model}-${index}`;
          const fullLabel = `${hostname} (${run.protocol} - ${run.drive_type} - ${run.drive_model})`;
          const isHidden = chartState.hiddenHostLabels.has(uniqueId);
          return (
            <Button
              key={uniqueId}
              variant={isHidden ? "outline" : "primary"}
              size="sm"
              onClick={() => toggleHostVisibility(uniqueId)}
              className="flex items-center gap-1 text-xs"
              title={fullLabel}
            >
              {isHidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              <span className="truncate max-w-32">
                {`${hostname} (${run.protocol} - ${run.drive_model})`}
              </span>
            </Button>
          );
        })}
      </div>

      {/* Chart grid */}
      {maximized ? (
        // Maximized view
        <Card className="p-4 h-[70vh]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold theme-text-primary">
              {charts.find(c => c.id === maximized)?.title}
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleMaximize(maximized)}
            >
              <Maximize2 className="w-4 h-4" />
            </Button>
          </div>
          <div className="h-[calc(70vh-6rem)]">
            <Bar 
              data={charts.find(c => c.id === maximized)!.data} 
              options={charts.find(c => c.id === maximized)!.options} 
            />
          </div>
        </Card>
      ) : (
        // Grid view
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {charts.map((chart) => (
            <Card key={chart.id} className="p-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <chart.icon className="w-4 h-4 theme-text-secondary" />
                  <h3 className="font-medium theme-text-primary text-sm">
                    {chart.title}
                  </h3>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleMaximize(chart.id)}
                >
                  <Maximize2 className="w-3 h-3" />
                </Button>
              </div>
              <div className="h-80">
                <Bar data={chart.data} options={chart.options} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default memo(MultiChartGrid);