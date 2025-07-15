import React, { useMemo, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { generateUniqueColorsForChart } from '../../utils/colorMapping';

export interface ParallelCoordinatesChartProps {
  data: any[];
}

const ParallelCoordinatesChart: React.FC<ParallelCoordinatesChartProps> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  // Flatten data per configuration with enhanced processing
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    const flattenedData = data.flatMap((drive: any) =>
      drive.configurations
        .filter((cfg: any) => cfg.iops && cfg.avg_latency && cfg.bandwidth) // Only include complete data
        .map((cfg: any) => {
          const rawBlock = cfg.block_size;
          let blockSize = 0;
          
          // Enhanced block size parsing
          if (typeof rawBlock === 'string') {
            if (rawBlock.includes('K')) {
              blockSize = parseInt(rawBlock.replace(/[^\d]/g, ''), 10);
            } else if (rawBlock.includes('M')) {
              blockSize = parseInt(rawBlock.replace(/[^\d]/g, ''), 10) * 1024;
            } else {
              blockSize = parseInt(rawBlock.replace(/[^\d]/g, ''), 10);
            }
          } else {
            blockSize = rawBlock || 0;
          }
          
          return {
            blockSize,
            queueDepth: cfg.queue_depth || 0,
            iops: cfg.iops || 0,
            avgLatency: cfg.avg_latency || 0,
            bandwidth: cfg.bandwidth || 0,
            driveModel: drive.drive_model || 'Unknown',
            protocol: drive.protocol || 'Unknown',
            hostname: drive.hostname || 'Unknown',
            pattern: cfg.read_write_pattern || 'Unknown',
          };
        })
    );
    
    return flattenedData;
  }, [data]);

  // Define dimensions and their labels
  const dimensions = useMemo(() => [
    { key: 'blockSize', label: 'Block Size (KB)' },
    { key: 'queueDepth', label: 'Queue Depth' },
    { key: 'iops', label: 'IOPS' },
    { key: 'bandwidth', label: 'Bandwidth (MB/s)' },
    { key: 'avgLatency', label: 'Avg Latency (ms)' }
  ], []);

  // Create color mapping for drive models based on hostname
  const colorMapping = useMemo(() => {
    const uniqueDrives = [...new Set(chartData.map(d => `${d.hostname}_${d.driveModel}`))];
    const uniqueColors = generateUniqueColorsForChart(
      uniqueDrives.map(combo => {
        const [hostname, driveModel] = combo.split('_');
        return { hostname, driveModel };
      }),
      'primary'
    );
    
    const mapping = new Map<string, string>();
    uniqueDrives.forEach((combo, index) => {
      mapping.set(combo, uniqueColors[index]);
    });
    
    return mapping;
  }, [chartData]);

  useEffect(() => {
    if (!svgRef.current || !chartData.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous render

    const margin = { top: 50, right: 80, bottom: 50, left: 80 };
    const width = 900 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Create scales for each dimension
    const scales: { [key: string]: d3.ScaleLinear<number, number> } = {};
    dimensions.forEach(dim => {
      const extent = d3.extent(chartData, (d: any) => d[dim.key as keyof typeof d] as number);
      scales[dim.key] = d3.scaleLinear()
        .domain(extent[0] !== undefined && extent[1] !== undefined ? extent : [0, 1])
        .range([height, 0]);
    });

    // Position scales
    const x = d3.scalePoint()
      .domain(dimensions.map(d => d.key))
      .range([0, width]);

    // Draw axes
    dimensions.forEach(dim => {
      const axis = g.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(${x(dim.key)},0)`)
        .call(d3.axisLeft(scales[dim.key]).ticks(6));

      // Add axis labels
      axis.append("text")
        .attr("y", -15)
        .attr("x", 0)
        .attr("text-anchor", "middle")
        .style("fill", "currentColor")
        .style("font-size", "12px")
        .style("font-weight", "bold")
        .text(dim.label);
    });

    // Line function
    const line = d3.line<{ key: string; value: number }>()
      .x((d: { key: string; value: number }) => x(d.key) || 0)
      .y((d: { key: string; value: number }) => scales[d.key](d.value))
      .curve(d3.curveMonotoneX);

    // Draw lines
    const lines = g.selectAll(".line")
      .data(chartData)
      .enter().append("path")
      .attr("class", "line")
      .attr("d", (d: any) => {
        const lineData = dimensions.map(dim => ({
          key: dim.key,
          value: d[dim.key as keyof typeof d] as number
        }));
        return line(lineData);
      })
      .style("fill", "none")
      .style("stroke", (d: any) => colorMapping.get(`${d.hostname}_${d.driveModel}`) || '#888')
      .style("stroke-width", 1.5)
      .style("stroke-opacity", 0.6);

    // Add hover effects
    lines
      .on("mouseover", function(this: SVGPathElement, event: any, d: any) {
        d3.select(this)
          .style("stroke-width", 3)
          .style("stroke-opacity", 1);
        
        // Create tooltip
        const tooltip = d3.select("body").append("div")
          .attr("class", "tooltip")
          .style("position", "absolute")
          .style("background", "rgba(0, 0, 0, 0.8)")
          .style("color", "white")
          .style("padding", "10px")
          .style("border-radius", "5px")
          .style("font-size", "12px")
          .style("pointer-events", "none")
          .style("z-index", "1000");

        tooltip.html(`
          <strong>${d.driveModel}</strong><br/>
          Host: ${d.hostname}<br/>
          Protocol: ${d.protocol}<br/>
          Pattern: ${d.pattern}<br/>
          Block Size: ${d.blockSize} KB<br/>
          Queue Depth: ${d.queueDepth}<br/>
          IOPS: ${d.iops.toFixed(0)}<br/>
          Latency: ${d.avgLatency.toFixed(2)} ms<br/>
          Bandwidth: ${d.bandwidth.toFixed(1)} MB/s
        `);

        tooltip
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 10) + "px");
      })
      .on("mouseout", function(this: SVGPathElement) {
        d3.select(this)
          .style("stroke-width", 1.5)
          .style("stroke-opacity", 0.6);
        
        d3.selectAll(".tooltip").remove();
      });

    // Add legend
    const legend = g.append("g")
      .attr("class", "legend")
      .attr("transform", `translate(${width + 10}, 20)`);

    const driveModels = [...new Set(chartData.map(d => d.driveModel))];
    const legendItems = legend.selectAll(".legend-item")
      .data(driveModels)
      .enter().append("g")
      .attr("class", "legend-item")
      .attr("transform", (_d: any, i: number) => `translate(0, ${i * 20})`);

    legendItems.append("line")
      .attr("x1", 0)
      .attr("x2", 15)
      .attr("y1", 0)
      .attr("y2", 0)
      .style("stroke", (d: any) => colorMapping.get(d) || '#888')
      .style("stroke-width", 2);

    legendItems.append("text")
      .attr("x", 20)
      .attr("y", 0)
      .attr("dy", "0.35em")
      .style("font-size", "11px")
      .style("fill", "currentColor")
      .text((d: any) => d);

  }, [chartData, colorMapping, dimensions]);

  if (!chartData || chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 theme-bg-primary">
        <div className="text-center">
          <p className="theme-text-secondary text-lg">No data available for visualization</p>
          <p className="theme-text-secondary text-sm mt-2">Try adjusting your filters to include more test results</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-4">
        <h3 className="text-xl font-semibold theme-text-primary mb-2">Parallel Coordinates Analysis</h3>
        <p className="theme-text-secondary text-sm">
          Each line represents a test run. Lines connect values across dimensions: Block Size → Queue Depth → IOPS → Bandwidth → Latency.
          Colors represent different drive models. Hover over lines for detailed information.
        </p>
        <p className="theme-text-secondary text-xs mt-1">
          Data points: {chartData.length} test configurations
        </p>
      </div>
      
      <div className="overflow-x-auto">
        <svg 
          ref={svgRef}
          width={900}
          height={500}
          className="theme-text-primary"
          style={{ background: 'transparent' }}
        />
      </div>
      
      <div className="mt-4 text-xs theme-text-secondary">
        <p><strong>How to read:</strong> Each line represents one test configuration. Patterns show correlations between dimensions.</p>
        <p><strong>Outliers:</strong> Lines that deviate significantly from the general pattern indicate exceptional performance or issues.</p>
        <p><strong>Clustering:</strong> Lines that group together suggest similar performance characteristics.</p>
        <p><strong>Interaction:</strong> Hover over lines to see detailed information about each test configuration.</p>
      </div>
    </div>
  );
};

export default ParallelCoordinatesChart;