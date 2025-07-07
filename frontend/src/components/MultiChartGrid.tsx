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
  hiddenHosts: Set<string>;
  maximizedChart: string | null;
}

function MultiChartGrid({ comparisons, selectedComparisonIndex, className = '' }: MultiChartGridProps) {
  const [chartState, setChartState] = useState<ChartState>({
    highlightedHost: null,
    hiddenHosts: new Set(),
    maximizedChart: null
  });

  const selectedComparison = comparisons[selectedComparisonIndex];

  const handleHostHighlight = useCallback((hostname: string | null) => {
    setChartState(prev => ({ ...prev, highlightedHost: hostname }));
  }, []);

  const toggleHostVisibility = useCallback((hostname: string) => {
    setChartState(prev => {
      const newHiddenHosts = new Set(prev.hiddenHosts);
      if (newHiddenHosts.has(hostname)) {
        newHiddenHosts.delete(hostname);
      } else {
        newHiddenHosts.add(hostname);
      }
      return { ...prev, hiddenHosts: newHiddenHosts };
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

    const visibleHostData = selectedComparison.hostData.filter(
      data => !chartState.hiddenHosts.has(data.hostname)
    );

    const hostnames = visibleHostData.map(data => data.hostname);
    const colors = [
      '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 
      '#ec4899', '#14b8a6', '#6366f1', '#f472b6', '#f87171'
    ];

    const getBarColor = (hostname: string, baseColor: string) => {
      if (chartState.highlightedHost === null) return baseColor;
      return chartState.highlightedHost === hostname ? baseColor : baseColor + '40';
    };

    return {
      iops: {
        labels: hostnames,
        datasets: [{
          label: 'IOPS',
          data: visibleHostData.map(data => data.metrics.iops || 0),
          backgroundColor: hostnames.map((hostname, idx) => 
            getBarColor(hostname, colors[idx % colors.length])
          ),
          borderColor: hostnames.map((_, idx) => colors[idx % colors.length]),
          borderWidth: chartState.highlightedHost ? 2 : 1,
        }]
      },
      bandwidth: {
        labels: hostnames,
        datasets: [{
          label: 'Bandwidth (MB/s)',
          data: visibleHostData.map(data => data.metrics.bandwidth || 0),
          backgroundColor: hostnames.map((hostname, idx) => 
            getBarColor(hostname, colors[idx % colors.length])
          ),
          borderColor: hostnames.map((_, idx) => colors[idx % colors.length]),
          borderWidth: chartState.highlightedHost ? 2 : 1,
        }]
      },
      latency: {
        labels: hostnames,
        datasets: [
          {
            label: 'P95 Latency (μs)',
            data: visibleHostData.map(data => data.metrics.p95_latency || 0),
            backgroundColor: hostnames.map((hostname, idx) => 
              getBarColor(hostname, colors[idx % colors.length])
            ),
            borderColor: hostnames.map((_, idx) => colors[idx % colors.length]),
            borderWidth: chartState.highlightedHost ? 2 : 1,
            yAxisID: 'y',
          },
          {
            label: 'P99 Latency (μs)',
            data: visibleHostData.map(data => data.metrics.p99_latency || 0),
            backgroundColor: hostnames.map((hostname, idx) => 
              getBarColor(hostname, colors[idx % colors.length] + '80')
            ),
            borderColor: hostnames.map((_, idx) => colors[idx % colors.length]),
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
            const hostData = selectedComparison?.hostData.find(
              data => data.hostname === context.label
            );
            if (hostData) {
              return [
                `Drive: ${hostData.run.drive_model}`,
                `Protocol: ${hostData.run.protocol}`,
                `Test: ${hostData.run.test_name || 'N/A'}`
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
        const hostname = chartData?.iops.labels[elementIndex];
        if (hostname && hostname !== chartState.highlightedHost) {
          handleHostHighlight(hostname);
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
        {selectedComparison.hostData.map(({ hostname }) => (
          <Button
            key={hostname}
            variant={chartState.hiddenHosts.has(hostname) ? "outline" : "primary"}
            size="sm"
            onClick={() => toggleHostVisibility(hostname)}
            className="flex items-center gap-1"
          >
            {chartState.hiddenHosts.has(hostname) ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            {hostname}
          </Button>
        ))}
      </div>

      {/* Chart grid */}
      {maximized ? (
        // Maximized view
        <Card className="p-4 h-96">
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
          <div className="h-80">
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
              <div className="h-48">
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