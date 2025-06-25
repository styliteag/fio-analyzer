import React from 'react';
import { ChartTemplate } from '../types';
import { BarChart3, TrendingUp, ScatterChart as Scatter3D, Zap } from 'lucide-react';

interface TemplateSelectorProps {
  selectedTemplate: ChartTemplate | null;
  onTemplateSelect: (template: ChartTemplate) => void;
}

const chartTemplates: ChartTemplate[] = [
  // We'll add new focused chart templates here
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
    <div className="theme-card rounded-lg shadow-md p-6 mb-6 border">
      <h2 className="text-xl font-semibold mb-4 flex items-center theme-text-primary">
        <BarChart3 className="mr-2 theme-text-secondary" size={20} />
        Visualization Templates
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {chartTemplates.map((template) => (
          <div
            key={template.id}
            className={`border rounded-lg p-4 cursor-pointer transition-all duration-200 hover:shadow-md ${
              selectedTemplate?.id === template.id
                ? 'theme-border-accent theme-bg-accent'
                : 'theme-border-primary theme-bg-card hover:theme-border-secondary'
            }`}
            onClick={() => onTemplateSelect(template)}
          >
            <div className="flex items-center mb-2">
              <div className={`mr-3 ${
                selectedTemplate?.id === template.id 
                  ? 'theme-text-accent' 
                  : 'theme-text-secondary'
              }`}>
                {getTemplateIcon(template.chartType)}
              </div>
              <h3 className="font-medium theme-text-primary">{template.name}</h3>
            </div>
            
            <p className="text-sm theme-text-secondary mb-3">{template.description}</p>
            
            <div className="flex flex-wrap gap-1">
              {template.metrics.map((metric) => (
                <span
                  key={metric}
                  className="px-2 py-1 theme-bg-tertiary theme-text-secondary text-xs rounded"
                >
                  {metric.replace(/_/g, ' ').toUpperCase()}
                </span>
              ))}
            </div>
            
            <div className="mt-2 text-xs theme-text-tertiary">
              Chart Type: {template.chartType.toUpperCase()}
            </div>
          </div>
        ))}
      </div>

      {selectedTemplate && (
        <div className="mt-6 p-4 theme-bg-accent rounded-lg border theme-border-accent">
          <h3 className="font-medium theme-text-accent mb-2">Selected Template: {selectedTemplate.name}</h3>
          <div className="grid grid-cols-2 gap-4 text-sm theme-text-accent">
            <div>
              <span className="font-medium theme-text-accent">X-Axis:</span> {selectedTemplate.xAxis.replace(/_/g, ' ')}
            </div>
            <div>
              <span className="font-medium theme-text-accent">Y-Axis:</span> {selectedTemplate.yAxis.replace(/_/g, ' ')}
            </div>
            {selectedTemplate.groupBy && (
              <div>
                <span className="font-medium theme-text-accent">Group By:</span> {selectedTemplate.groupBy.replace(/_/g, ' ')}
              </div>
            )}
            <div>
              <span className="font-medium theme-text-accent">Metrics:</span> {selectedTemplate.metrics.join(', ')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateSelector;