import React from 'react';

export interface FacetScatterGridProps {
  data: any[];
}

const FacetScatterGrid: React.FC<FacetScatterGridProps> = ({ data }) => {
  // Count distinct patterns for facets
  const patterns = Array.from(new Set(data.map(d => d.configurations).flat().map((c:any) => c.read_write_pattern)));
  return (
    <div className="space-y-4">
      {patterns.map(pattern => (
        <div key={pattern} className="border p-4 rounded">
          <h4 className="font-semibold theme-text-primary mb-2">Pattern: {pattern}</h4>
          <p className="text-sm text-gray-500">Scatter plot placeholder ({pattern}) with {data.length} points</p>
        </div>
      ))}
    </div>
  );
};

export default FacetScatterGrid;
