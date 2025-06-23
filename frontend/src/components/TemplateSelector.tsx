import React from 'react';
import { ChartTemplate } from '../types';
import { BarChart3, TrendingUp, ScatterChart as Scatter3D, Zap } from 'lucide-react';

interface TemplateSelectorProps {
  selectedTemplate: ChartTemplate | null;
  onTemplateSelect: (template: ChartTemplate) => void;
}

const chartTemplates: ChartTemplate[] = [
  {
    id: 'iops-comparison',
    name: 'IOPS Comparison',
    description: 'Compare IOPS performance across different drives and configurations',
    chartType: 'bar',
    xAxis: 'drive_model',
    yAxis: 'iops',
    groupBy: 'read_write_pattern',
    metrics: ['iops']
  },
  {
    id: 'latency-distribution',
    name: 'Latency Distribution',
    description: 'View latency percentiles (avg, p95, p99) across test runs',
    chartType: 'bar',
    xAxis: 'drive_model',
    yAxis: 'latency',
    metrics: ['avg_latency', 'p95_latency', 'p99_latency']
  },
  {
    id: 'throughput-blocksize',
    name: 'Throughput vs Block Size',
    description: 'Analyze how throughput varies with different block sizes',
    chartType: 'line',
    xAxis: 'block_size',
    yAxis: 'throughput',
    groupBy: 'drive_model',
    metrics: ['throughput']
  },
  {
    id: 'read-write-performance',
    name: 'Read vs Write Performance',
    description: 'Compare read and write performance patterns',
    chartType: 'scatter',
    xAxis: 'read_performance',
    yAxis: 'write_performance',
    metrics: ['iops', 'throughput']
  },
  {
    id: 'performance-over-time',
    name: 'Performance Over Time',
    description: 'Track performance trends across different test dates',
    chartType: 'line',
    xAxis: 'timestamp',
    yAxis: 'performance',
    groupBy: 'drive_model',
    metrics: ['iops', 'throughput', 'avg_latency']
  },
  {
    id: 'queue-depth-impact',
    name: 'Queue Depth Impact',
    description: 'Analyze how queue depth affects performance metrics',
    chartType: 'line',
    xAxis: 'queue_depth',
    yAxis: 'performance',
    groupBy: 'drive_type',
    metrics: ['iops', 'avg_latency']
  }
];

const getTemplateIcon = (chartType: string) => {
  switch (chartType) {
    case 'bar':
      return <BarChart3 size={20} />;
    case 'line':
      return <TrendingUp size={20} />;
    case 'scatter':
      return <Scatter3D size={20} />;
    default:
      return <Zap size={20} />;
  }
};

const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  selectedTemplate,
  onTemplateSelect,
}) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6 border border-gray-200 dark:border-gray-700">
      <h2 className="text-xl font-semibold mb-4 flex items-center text-gray-900 dark:text-white">
        <BarChart3 className="mr-2 text-gray-600 dark:text-gray-300" size={20} />
        Visualization Templates
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {chartTemplates.map((template) => (
          <div
            key={template.id}
            className={`border rounded-lg p-4 cursor-pointer transition-all duration-200 hover:shadow-md ${
              selectedTemplate?.id === template.id
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400'
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-700'
            }`}
            onClick={() => onTemplateSelect(template)}
          >
            <div className="flex items-center mb-2">
              <div className={`mr-3 ${
                selectedTemplate?.id === template.id 
                  ? 'text-blue-600 dark:text-blue-400' 
                  : 'text-gray-600 dark:text-gray-300'
              }`}>
                {getTemplateIcon(template.chartType)}
              </div>
              <h3 className="font-medium text-gray-900 dark:text-white">{template.name}</h3>
            </div>
            
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{template.description}</p>
            
            <div className="flex flex-wrap gap-1">
              {template.metrics.map((metric) => (
                <span
                  key={metric}
                  className="px-2 py-1 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs rounded"
                >
                  {metric.replace(/_/g, ' ').toUpperCase()}
                </span>
              ))}
            </div>
            
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Chart Type: {template.chartType.toUpperCase()}
            </div>
          </div>
        ))}
      </div>

      {selectedTemplate && (
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <h3 className="font-medium text-blue-900 dark:text-blue-200 mb-2">Selected Template: {selectedTemplate.name}</h3>
          <div className="grid grid-cols-2 gap-4 text-sm text-blue-700 dark:text-blue-300">
            <div>
              <span className="font-medium text-blue-800 dark:text-blue-200">X-Axis:</span> {selectedTemplate.xAxis.replace(/_/g, ' ')}
            </div>
            <div>
              <span className="font-medium text-blue-800 dark:text-blue-200">Y-Axis:</span> {selectedTemplate.yAxis.replace(/_/g, ' ')}
            </div>
            {selectedTemplate.groupBy && (
              <div>
                <span className="font-medium text-blue-800 dark:text-blue-200">Group By:</span> {selectedTemplate.groupBy.replace(/_/g, ' ')}
              </div>
            )}
            <div>
              <span className="font-medium text-blue-800 dark:text-blue-200">Metrics:</span> {selectedTemplate.metrics.join(', ')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateSelector;