import React from 'react';
import { ChartTemplate } from '../types';
import { BarChart3, TrendingUp, ScatterChart as Scatter3D, Zap } from 'lucide-react';

interface TemplateSelectorProps {
  selectedTemplate: ChartTemplate | null;
  onTemplateSelect: (template: ChartTemplate) => void;
}

const chartTemplates: ChartTemplate[] = [
  {
    id: 'performance-overview',
    name: '📊 Performance Overview',
    description: 'Compare IOPS, Latency, and Throughput across selected test runs',
    chartType: 'bar',
    xAxis: 'test_runs',
    yAxis: 'performance_metrics',
    metrics: ['iops', 'avg_latency', 'throughput']
  },
  {
    id: 'block-size-impact',
    name: '📈 Block Size Impact',
    description: 'Show how performance changes with different block sizes',
    chartType: 'line',
    xAxis: 'block_size',
    yAxis: 'performance',
    groupBy: 'drive_model',
    metrics: ['iops', 'throughput']
  },
  {
    id: 'read-write-comparison',
    name: '⚖️ Read vs Write',
    description: 'Side-by-side comparison of read and write performance',
    chartType: 'bar',
    xAxis: 'test_runs',
    yAxis: 'iops',
    groupBy: 'operation_type',
    metrics: ['iops']
  },
  {
    id: 'iops-latency-dual',
    name: '🎯 IOPS vs Latency',
    description: 'Dual-axis chart showing both IOPS and latency metrics together',
    chartType: 'bar',
    xAxis: 'test_runs',
    yAxis: 'dual_metrics',
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
    <div className="theme-card rounded-lg shadow-md p-4 mb-6 border">
      <h2 className="text-lg font-semibold mb-3 flex items-center theme-text-primary">
        <BarChart3 className="mr-2 theme-text-secondary" size={18} />
        Templates
      </h2>

      <div className="space-y-2">
        {chartTemplates.map((template) => (
          <button
            key={template.id}
            className={`w-full text-left p-3 rounded-lg cursor-pointer transition-all duration-200 flex items-center ${
              selectedTemplate?.id === template.id
                ? 'theme-bg-accent theme-text-accent border theme-border-accent'
                : 'theme-bg-secondary theme-text-primary hover:theme-bg-tertiary border theme-border-primary'
            }`}
            onClick={() => onTemplateSelect(template)}
          >
            <div className={`mr-3 ${
              selectedTemplate?.id === template.id 
                ? 'theme-text-accent' 
                : 'theme-text-secondary'
            }`}>
              {getTemplateIcon(template.chartType)}
            </div>
            <span className="font-medium">{template.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default TemplateSelector;