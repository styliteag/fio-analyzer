import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { generateUniqueColorsForChart } from '../../utils/colorMapping';
import { formatLatencyMicroseconds } from '../../services/data/formatters';

export interface BoxPlotChartProps {
  data: DriveAnalysis[];
}

interface DriveAnalysis {
  drive_model: string;
  drive_type: string;
  protocol: string;
  hostname: string;
  testCount: number;
  configurations: TestConfiguration[];
  topPerformance: {
    maxIOPS: number;
    minLatency: number;
    maxBandwidth: number;
  };
}

interface TestConfiguration {
  block_size: string;
  read_write_pattern: string;
  queue_depth: number;
  iops: number | null | undefined;
  avg_latency: number | null | undefined;
  bandwidth: number | null | undefined;
  p70_latency: number | null | undefined;
  p90_latency: number | null | undefined;
  p95_latency: number | null | undefined;
  p99_latency: number | null | undefined;
  timestamp: string;
}

interface BoxplotData {
  blockSize: string;
  q1: number;
  median: number;
  q3: number;
  min: number;
  max: number;
  outliers: number[];
  values: number[];
  interquartileRange: number;
}

const BoxPlotChart: React.FC<BoxPlotChartProps> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [metric, setMetric] = useState<'iops' | 'avg_latency' | 'bandwidth'>('iops');
  const [hoveredBox, setHoveredBox] = useState<string | null>(null);

  const calculateBoxplotStats = (values: number[]): Omit<BoxplotData, 'blockSize'> => {
    if (values.length === 0) {
      return { q1: 0, median: 0, q3: 0, min: 0, max: 0, outliers: [], values: [], interquartileRange: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    
    const q1 = d3.quantile(sorted, 0.25) || 0;
    const median = d3.quantile(sorted, 0.5) || 0;
    const q3 = d3.quantile(sorted, 0.75) || 0;
    const iqr = q3 - q1;
    
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    const outliers = sorted.filter(v => v < lowerBound || v > upperBound);
    const nonOutliers = sorted.filter(v => v >= lowerBound && v <= upperBound);
    
    const min = nonOutliers.length > 0 ? Math.min(...nonOutliers) : sorted[0];
    const max = nonOutliers.length > 0 ? Math.max(...nonOutliers) : sorted[n - 1];

    return {
      q1,
      median,
      q3,
      min,
      max,
      outliers,
      values: sorted,
      interquartileRange: iqr
    };
  };

  const processData = useCallback((): BoxplotData[] => {
    // Flatten all configurations from all drives
    const allConfigurations = data.flatMap(drive => 
      drive.configurations.filter(config => {
        const value = config[metric];
        return value !== null && value !== undefined && !isNaN(value);
      })
    );

    // Group by block size
    const groupedByBlockSize = d3.group(allConfigurations, d => d.block_size);
    
    // Calculate boxplot statistics for each block size
    const boxplotData: BoxplotData[] = [];
    
    groupedByBlockSize.forEach((configs, blockSize) => {
      const values = configs.map(config => config[metric] as number).filter(v => !isNaN(v));
      
      if (values.length > 0) {
        const stats = calculateBoxplotStats(values);
        boxplotData.push({
          blockSize,
          ...stats
        });
      }
    });

    // Sort by block size (numerical sort for sizes like 4k, 8k, 16k, etc.)
    return boxplotData.sort((a, b) => {
      const extractSize = (size: string): number => {
        const match = size.match(/(\d+)([kmg]?)/i);
        if (!match) return 0;
        
        const value = parseInt(match[1]);
        const unit = match[2]?.toLowerCase();
        
        switch (unit) {
          case 'k': return value * 1024;
          case 'm': return value * 1024 * 1024;
          case 'g': return value * 1024 * 1024 * 1024;
          default: return value;
        }
      };
      
      return extractSize(a.blockSize) - extractSize(b.blockSize);
    });
  }, [data, metric]);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const boxplotData = processData();
    if (boxplotData.length === 0) return;

    // Clear previous content
    d3.select(svgRef.current).selectAll("*").remove();

    // Set up dimensions
    const containerRect = svgRef.current.parentElement?.getBoundingClientRect();
    const width = (containerRect?.width || 800) - 80;
    const height = 400;
    const margin = { top: 20, right: 30, bottom: 60, left: 80 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Set up scales
    const xScale = d3.scaleBand()
      .domain(boxplotData.map(d => d.blockSize))
      .range([0, chartWidth])
      .padding(0.2);

    const allValues = boxplotData.flatMap(d => [...d.values, ...d.outliers]);
    const yScale = d3.scaleLinear()
      .domain(d3.extent(allValues) as [number, number])
      .nice()
      .range([chartHeight, 0]);

    // Define theme-aware colors for axes
    const isDarkMode = document.documentElement.classList.contains('dark');
    const axisColor = isDarkMode ? "#e5e7eb" : "#374151";
    const textColor = isDarkMode ? "#e5e7eb" : "#374151";

    // Add axes
    const xAxis = g.append("g")
      .attr("transform", `translate(0,${chartHeight})`)
      .call(d3.axisBottom(xScale));
    
    // Style x-axis
    xAxis.selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", ".15em")
      .attr("transform", "rotate(-45)")
      .style("fill", textColor)
      .style("font-size", "12px");
    
    xAxis.selectAll("line, path")
      .style("stroke", axisColor);

    const yAxis = g.append("g")
      .call(d3.axisLeft(yScale));
    
    // Style y-axis
    yAxis.selectAll("text")
      .style("fill", textColor)
      .style("font-size", "12px");
    
    yAxis.selectAll("line, path")
      .style("stroke", axisColor);

    // Add axis labels with proper colors
    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 0 - margin.left)
      .attr("x", 0 - (chartHeight / 2))
      .attr("dy", "1em")
      .style("text-anchor", "middle")
      .style("fill", textColor)
      .style("font-size", "14px")
      .style("font-weight", "500")
      .text(metric === 'iops' ? 'IOPS' : metric === 'avg_latency' ? 'Average Latency (ms)' : 'Bandwidth (MB/s)');

    g.append("text")
      .attr("transform", `translate(${chartWidth / 2}, ${chartHeight + margin.bottom - 10})`)
      .style("text-anchor", "middle")
      .style("fill", textColor)
      .style("font-size", "14px")
      .style("font-weight", "500")
      .text("Block Size");

    // Create tooltip
    const tooltip = d3.select("body").append("div")
      .attr("class", "absolute bg-gray-800 text-white p-2 rounded shadow-lg pointer-events-none opacity-0 z-50")
      .style("transition", "opacity 0.2s");

    // Draw boxplots
    const boxWidth = xScale.bandwidth() * 0.6;
    
    boxplotData.forEach(d => {
      const x = xScale(d.blockSize)! + xScale.bandwidth() / 2;
      const isHovered = hoveredBox === d.blockSize;
      
      // Box group
      const boxGroup = g.append("g")
        .attr("class", `box-${d.blockSize}`)
        .style("cursor", "pointer");

      // Define colors based on hostname/drive names from the data for this block size
      const isDarkMode = document.documentElement.classList.contains('dark');
      
      // Get all drives that have data for this block size
      const relevantDrives = data.filter(drive => 
        drive.configurations.some(config => config.block_size === d.blockSize)
      );
      
      // Generate colors for these drives and use the primary one
      const driveColors = generateUniqueColorsForChart(
        relevantDrives.map(drive => ({
          hostname: drive.hostname,
          driveModel: drive.drive_model
        })),
        'primary'
      );
      
      // Use the first drive's color as the primary color, or fallback to blue
      const primaryColor = driveColors.length > 0 ? driveColors[0] : 'rgba(59, 130, 246, 0.8)';
      const baseColor = primaryColor.includes('rgba') ? 
        primaryColor.match(/rgba?\(([^)]+)\)/)?.[1]?.split(',').slice(0, 3).join(',') || '59, 130, 246' :
        '59, 130, 246';
      
      const colors = {
        whiskers: isHovered ? `rgb(${baseColor})` : (isDarkMode ? "#e5e7eb" : "#374151"),
        box: {
          fill: isHovered ? `rgba(${baseColor}, 0.6)` : `rgba(${baseColor}, 0.3)`,
          stroke: isHovered ? `rgb(${baseColor})` : `rgba(${baseColor}, 0.7)`
        },
        median: isHovered ? "#fbbf24" : (isDarkMode ? "#fbbf24" : "#f59e0b"),
        outliers: {
          fill: isHovered ? "#f87171" : `rgba(${baseColor}, 0.8)`,
          stroke: isDarkMode ? "#ffffff" : "#ffffff"
        }
      };

      // Vertical lines (whiskers)
      boxGroup.append("line")
        .attr("x1", x)
        .attr("x2", x)
        .attr("y1", yScale(d.min))
        .attr("y2", yScale(d.max))
        .attr("stroke", colors.whiskers)
        .attr("stroke-width", 2);

      // Min and max horizontal lines
      boxGroup.append("line")
        .attr("x1", x - boxWidth / 4)
        .attr("x2", x + boxWidth / 4)
        .attr("y1", yScale(d.min))
        .attr("y2", yScale(d.min))
        .attr("stroke", colors.whiskers)
        .attr("stroke-width", 2);

      boxGroup.append("line")
        .attr("x1", x - boxWidth / 4)
        .attr("x2", x + boxWidth / 4)
        .attr("y1", yScale(d.max))
        .attr("y2", yScale(d.max))
        .attr("stroke", colors.whiskers)
        .attr("stroke-width", 2);

      // Box (IQR)
      boxGroup.append("rect")
        .attr("x", x - boxWidth / 2)
        .attr("y", yScale(d.q3))
        .attr("width", boxWidth)
        .attr("height", yScale(d.q1) - yScale(d.q3))
        .attr("fill", colors.box.fill)
        .attr("stroke", colors.box.stroke)
        .attr("stroke-width", 2);

      // Median line
      boxGroup.append("line")
        .attr("x1", x - boxWidth / 2)
        .attr("x2", x + boxWidth / 2)
        .attr("y1", yScale(d.median))
        .attr("y2", yScale(d.median))
        .attr("stroke", colors.median)
        .attr("stroke-width", 3);

      // Outliers
      boxGroup.selectAll(".outlier")
        .data(d.outliers)
        .enter()
        .append("circle")
        .attr("class", "outlier")
        .attr("cx", x)
        .attr("cy", y => yScale(y))
        .attr("r", 4)
        .attr("fill", colors.outliers.fill)
        .attr("stroke", colors.outliers.stroke)
        .attr("stroke-width", 2);

      // Invisible interaction area
      boxGroup.append("rect")
        .attr("x", x - xScale.bandwidth() / 2)
        .attr("y", 0)
        .attr("width", xScale.bandwidth())
        .attr("height", chartHeight)
        .attr("fill", "transparent")
        .on("mouseenter", (event) => {
          setHoveredBox(d.blockSize);
          
          const formatValue = (val: number) => {
            if (metric === 'iops') return Math.round(val).toLocaleString();
            if (metric === 'avg_latency') return formatLatencyMicroseconds(val).text;
            return val.toFixed(1);
          };

          const unit = metric === 'iops' ? '' : metric === 'avg_latency' ? '' : 'MB/s';
          
          tooltip.transition().duration(200).style("opacity", .9);
          tooltip.html(`
            <div class="text-sm">
              <div class="font-semibold">${d.blockSize}</div>
              <div>Samples: ${d.values.length}</div>
              <div>Min: ${formatValue(d.min)}${unit}</div>
              <div>Q1: ${formatValue(d.q1)}${unit}</div>
              <div>Median: ${formatValue(d.median)}${unit}</div>
              <div>Q3: ${formatValue(d.q3)}${unit}</div>
              <div>Max: ${formatValue(d.max)}${unit}</div>
              ${d.outliers.length > 0 ? `<div>Outliers: ${d.outliers.length}</div>` : ''}
            </div>
          `)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 10) + "px");
        })
        .on("mouseleave", () => {
          setHoveredBox(null);
          tooltip.transition().duration(500).style("opacity", 0);
        });
    });

    // Cleanup function
    return () => {
      tooltip.remove();
    };
  }, [data, metric, hoveredBox, processData]);

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="theme-text-secondary">No data available for boxplot analysis</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <div>
          <h3 className="text-xl font-semibold theme-text-primary mb-2">
            Box-and-Whisker Plot by Block Size
          </h3>
          <p className="theme-text-secondary text-sm">
            Distribution of {metric === 'iops' ? 'IOPS' : metric === 'avg_latency' ? 'latency' : 'bandwidth'} across different block sizes
          </p>
        </div>
        
        <div className="flex gap-2 mt-4 sm:mt-0">
          <button
            onClick={() => setMetric('iops')}
            className={`px-3 py-1 text-sm rounded ${
              metric === 'iops'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 theme-text-secondary hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            IOPS
          </button>
          <button
            onClick={() => setMetric('avg_latency')}
            className={`px-3 py-1 text-sm rounded ${
              metric === 'avg_latency'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 theme-text-secondary hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Latency
          </button>
          <button
            onClick={() => setMetric('bandwidth')}
            className={`px-3 py-1 text-sm rounded ${
              metric === 'bandwidth'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 theme-text-secondary hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Bandwidth
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
        <svg ref={svgRef} className="w-full" style={{ minHeight: '400px' }}></svg>
      </div>

      <div className="mt-4 text-xs theme-text-secondary">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-2 bg-blue-700 dark:bg-blue-600 border-2 border-blue-500 dark:border-blue-400"></div>
            <span>Interquartile Range (IQR)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-1 bg-yellow-500 dark:bg-yellow-400"></div>
            <span>Median</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 bg-gray-300 dark:bg-gray-300"></div>
            <span>Min/Max (within 1.5×IQR)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 dark:bg-red-400 rounded-full border-2 border-white"></div>
            <span>Outliers</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BoxPlotChart;
