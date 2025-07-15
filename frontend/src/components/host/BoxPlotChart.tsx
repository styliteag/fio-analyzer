import React from 'react';

export interface BoxPlotChartProps {
  data: any[];
}

const BoxPlotChart: React.FC<BoxPlotChartProps> = ({ data }) => {
  return (
    <div className="flex flex-col items-center justify-center h-64">
      <p className="text-gray-500">Boxplot by Block Size coming soon for {data.length} runs...</p>
    </div>
  );
};

export default BoxPlotChart;
