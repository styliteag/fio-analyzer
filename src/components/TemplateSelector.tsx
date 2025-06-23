import React, { useState, useEffect } from "react";
import { ChartTemplate } from "../types";
import {
  BarChart3,
  TrendingUp,
  ScatterChart as Scatter3D,
  Zap,
  WifiOff,
} from "lucide-react";
import { apiService } from "../services/apiService";

interface TemplateSelectorProps {
  selectedTemplate: ChartTemplate | null;
  onTemplateSelect: (template: ChartTemplate) => void;
}

const getTemplateIcon = (chartType: string) => {
  switch (chartType) {
    case "bar":
      return <BarChart3 size={20} />;
    case "line":
      return <TrendingUp size={20} />;
    case "scatter":
      return <Scatter3D size={20} />;
    default:
      return <Zap size={20} />;
  }
};

const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  selectedTemplate,
  onTemplateSelect,
}) => {
  const [templates, setTemplates] = useState<ChartTemplate[]>([]);
  const [isUsingMockData, setIsUsingMockData] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const result = await apiService.getChartTemplates();
      setTemplates(result.data);
      setIsUsingMockData(result.isUsingMockData);
    } catch (error) {
      console.error("Error fetching chart templates:", error);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold flex items-center">
          <BarChart3 className="mr-2" size={20} />
          Visualization Templates
        </h2>
        {isUsingMockData && (
          <div className="flex items-center text-sm text-amber-600 bg-amber-50 px-3 py-1 rounded-md border border-amber-200">
            <WifiOff className="h-4 w-4 mr-1" />
            Demo Templates
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
          <span className="text-gray-600">Loading templates...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className={`border rounded-lg p-4 cursor-pointer transition-all duration-200 hover:shadow-md ${
                selectedTemplate?.id === template.id
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
              onClick={() => onTemplateSelect(template)}
            >
              <div className="flex items-center mb-2">
                <div
                  className={`mr-3 ${
                    selectedTemplate?.id === template.id
                      ? "text-blue-600"
                      : "text-gray-600"
                  }`}
                >
                  {getTemplateIcon(template.chartType)}
                </div>
                <h3 className="font-medium text-gray-900">{template.name}</h3>
              </div>

              <p className="text-sm text-gray-600 mb-3">
                {template.description}
              </p>

              <div className="flex flex-wrap gap-1">
                {template.metrics.map((metric) => (
                  <span
                    key={metric}
                    className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                  >
                    {metric.replace(/_/g, " ").toUpperCase()}
                  </span>
                ))}
              </div>

              <div className="mt-2 text-xs text-gray-500">
                Chart Type: {template.chartType.toUpperCase()}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedTemplate && (
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-medium text-blue-900 mb-2">
            Selected Template: {selectedTemplate.name}
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-blue-800">X-Axis:</span>{" "}
              {selectedTemplate.xAxis.replace(/_/g, " ")}
            </div>
            <div>
              <span className="font-medium text-blue-800">Y-Axis:</span>{" "}
              {selectedTemplate.yAxis.replace(/_/g, " ")}
            </div>
            {selectedTemplate.groupBy && (
              <div>
                <span className="font-medium text-blue-800">Group By:</span>{" "}
                {selectedTemplate.groupBy.replace(/_/g, " ")}
              </div>
            )}
            <div>
              <span className="font-medium text-blue-800">Metrics:</span>{" "}
              {selectedTemplate.metrics.join(", ")}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateSelector;
