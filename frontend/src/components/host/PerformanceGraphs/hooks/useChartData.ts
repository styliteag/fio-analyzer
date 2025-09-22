/**
 * useChartData Hook
 *
 * Custom hook for data processing and management in Performance Graphs
 */

import { useMemo, useCallback } from 'react';
import type { DriveAnalysis } from '../../../../services/api/hostAnalysis';
import type {
  AggregatedData,
  ChartFilters,
  ChartError,
  ChartData,
  PatternType
} from '../types';
import {
  aggregateData,
  applyFilters,
  generateIOPSComparisonData,
  generateBandwidthTrendsData,
  validateDataIntegrity
} from '../utils/dataTransform';

/**
 * Processed chart data for all chart types
 */
export interface ProcessedChartData {
  iopsComparison: ChartData;
  bandwidthTrends: ChartData;
  latencyAnalysis: {
    avgLatency: ChartData;
    percentileLatency: ChartData;
  };
  responsiveness: ChartData;
}

/**
 * Return type for useChartData hook
 */
export interface UseChartDataReturn {
  aggregatedData: AggregatedData;
  processedData: ProcessedChartData;
  filteredData: AggregatedData;
  loading: boolean;
  error: ChartError | null;
  dataQuality: number;
  refetch: () => void;
  invalidateCache: () => void;
}

/**
 * Default filters for chart data
 */
const DEFAULT_FILTERS: ChartFilters = {
  selectedPatterns: ['random_read', 'random_write', 'sequential_read', 'sequential_write'],
  selectedHosts: [],
  selectedMetrics: ['iops', 'avg_latency', 'bandwidth'],
  selectedBlockSizes: []
};

/**
 * Generate latency analysis data
 */
const generateLatencyAnalysisData = (aggregatedData: AggregatedData): {
  avgLatency: ChartData;
  percentileLatency: ChartData;
} => {
  const { blockSizes, series } = aggregatedData;

  // Average latency data
  const avgLatencyDatasets = series.map(seriesItem => {
    const data = blockSizes.map(blockSize => {
      const point = seriesItem.data.find(p => p.blockSize === blockSize);
      return point?.avgLatency || 0;
    });

    return {
      label: `${seriesItem.label} (Avg)`,
      data,
      backgroundColor: seriesItem.color || '#DC2626',
      borderColor: seriesItem.color || '#B91C1C',
      borderWidth: 2,
      tension: 0.1,
      fill: false,
      pointRadius: 4,
      pointHoverRadius: 6,
      yAxisID: 'y'
    };
  }).filter(dataset => dataset.data.some(value => value > 0));

  // Percentile latency data
  const percentileDatasets = series.flatMap(seriesItem => {
    const p95Data = blockSizes.map(blockSize => {
      const point = seriesItem.data.find(p => p.blockSize === blockSize);
      return point?.p95Latency || 0;
    });

    const p99Data = blockSizes.map(blockSize => {
      const point = seriesItem.data.find(p => p.blockSize === blockSize);
      return point?.p99Latency || 0;
    });

    const results = [];

    if (p95Data.some(value => value > 0)) {
      results.push({
        label: `${seriesItem.label} (P95)`,
        data: p95Data,
        backgroundColor: `${seriesItem.color || '#F59E0B'}80`,
        borderColor: seriesItem.color || '#D97706',
        borderWidth: 1,
        borderDash: [5, 5],
        tension: 0.1,
        fill: false,
        pointRadius: 3,
        pointHoverRadius: 5,
        yAxisID: 'y1'
      });
    }

    if (p99Data.some(value => value > 0)) {
      results.push({
        label: `${seriesItem.label} (P99)`,
        data: p99Data,
        backgroundColor: `${seriesItem.color || '#7C3AED'}80`,
        borderColor: seriesItem.color || '#6D28D9',
        borderWidth: 1,
        borderDash: [2, 2],
        tension: 0.1,
        fill: false,
        pointRadius: 2,
        pointHoverRadius: 4,
        yAxisID: 'y1'
      });
    }

    return results;
  });

  return {
    avgLatency: {
      labels: blockSizes,
      datasets: avgLatencyDatasets
    },
    percentileLatency: {
      labels: blockSizes,
      datasets: percentileDatasets
    }
  };
};

/**
 * Generate responsiveness chart data
 */
const generateResponsivenessData = (aggregatedData: AggregatedData): ChartData => {
  const { series } = aggregatedData;

  // Create horizontal bar chart data
  const labels: string[] = [];
  const data: number[] = [];
  const backgrounds: string[] = [];

  series.forEach(seriesItem => {
    // Calculate average responsiveness across all block sizes for this series
    const responsivenessValues = seriesItem.data
      .map(point => point.responsiveness)
      .filter(value => value !== null && value !== undefined) as number[];

    if (responsivenessValues.length > 0) {
      const avgResponsiveness = responsivenessValues.reduce((sum, val) => sum + val, 0) / responsivenessValues.length;
      labels.push(`${seriesItem.hostname}\n${seriesItem.driveModel}`);
      data.push(avgResponsiveness);
      backgrounds.push(seriesItem.color || '#8B5CF6');
    }
  });

  return {
    labels,
    datasets: [{
      label: 'Average Responsiveness',
      data,
      backgroundColor: backgrounds.length === 1 ? backgrounds[0] : backgrounds,
      borderColor: backgrounds.length === 1 ? `${backgrounds[0]}CC` : backgrounds.map(color => `${color}CC`),
      borderWidth: 1
    }]
  };
};

/**
 * Custom hook for chart data processing
 */
export const useChartData = (
  drives: DriveAnalysis[],
  filters: ChartFilters = DEFAULT_FILTERS
): UseChartDataReturn => {
  // Validate input data and calculate quality score
  const { validationResult, dataQuality } = useMemo(() => {
    const validation = validateDataIntegrity(drives);
    let quality = 0;

    if (drives && drives.length > 0) {
      const totalConfigs = drives.reduce((sum, drive) => sum + (drive.configurations?.length || 0), 0);
      const validConfigs = drives.reduce((sum, drive) => {
        return sum + (drive.configurations?.filter(config =>
          config.iops && config.block_size && config.read_write_pattern
        ).length || 0);
      }, 0);

      quality = totalConfigs > 0 ? Math.round((validConfigs / totalConfigs) * 100) : 0;
    }

    return {
      validationResult: validation,
      dataQuality: quality
    };
  }, [drives]);

  // Generate error from validation if needed
  const error: ChartError | null = useMemo(() => {
    if (!validationResult.isValid) {
      return {
        type: 'data',
        message: `Data validation failed: ${validationResult.errors.join(', ')}`,
        details: validationResult,
        timestamp: new Date().toISOString()
      };
    }
    return null;
  }, [validationResult]);

  // Aggregate raw data
  const aggregatedData = useMemo(() => {
    if (!drives || drives.length === 0 || error) {
      return {
        blockSizes: [],
        patterns: [] as PatternType[],
        hosts: [],
        series: [],
        maxValues: {
          iops: 0,
          avg_latency: 0,
          p95_latency: 0,
          p99_latency: 0,
          bandwidth: 0,
          responsiveness: 0
        }
      };
    }

    return aggregateData(drives);
  }, [drives, error]);

  // Apply filters to aggregated data
  const filteredData = useMemo(() => {
    if (error || aggregatedData.series.length === 0) return aggregatedData;
    return applyFilters(aggregatedData, filters);
  }, [aggregatedData, filters, error]);

  // Process data for all chart types
  const processedData: ProcessedChartData = useMemo(() => {
    if (error || filteredData.series.length === 0) {
      const emptyChartData: ChartData = { labels: [], datasets: [] };
      return {
        iopsComparison: emptyChartData,
        bandwidthTrends: emptyChartData,
        latencyAnalysis: {
          avgLatency: emptyChartData,
          percentileLatency: emptyChartData
        },
        responsiveness: emptyChartData
      };
    }

    // Assign colors to series
    const seriesWithColors = filteredData.series.map((series, index) => ({
      ...series,
      color: `hsl(${(index * 360) / filteredData.series.length}, 70%, 50%)`
    }));

    const dataWithColors = { ...filteredData, series: seriesWithColors };

    return {
      iopsComparison: generateIOPSComparisonData(dataWithColors),
      bandwidthTrends: generateBandwidthTrendsData(dataWithColors),
      latencyAnalysis: generateLatencyAnalysisData(dataWithColors),
      responsiveness: generateResponsivenessData(dataWithColors)
    };
  }, [filteredData, error]);

  // Refetch function (could be used to refresh data from API)
  const refetch = useCallback(() => {
    // In a real implementation, this would trigger a data refresh
    console.log('Refetching chart data...');
  }, []);

  // Cache invalidation function
  const invalidateCache = useCallback(() => {
    // In a real implementation, this would clear any cached data
    console.log('Invalidating chart data cache...');
  }, []);

  return {
    aggregatedData,
    processedData,
    filteredData,
    loading: false, // Would be true during data loading
    error,
    dataQuality,
    refetch,
    invalidateCache
  };
};