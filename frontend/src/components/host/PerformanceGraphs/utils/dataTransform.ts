/**
 * Data transformation utilities for Performance Graphs
 *
 * These utilities convert DriveAnalysis data from the API into chart-ready formats.
 * Based on patterns from PerformanceFingerprintHeatmap component.
 */

import type { DriveAnalysis } from '../../../../services/api/hostAnalysis';
import type {
  DataPoint,
  SeriesDefinition,
  AggregatedData,
  ChartFilters,
  PatternType,
  MetricType,
  ChartData
} from '../types';

/**
 * Pattern mapping from API format to display format
 */
const PATTERN_MAPPING: Record<string, PatternType> = {
  'randread': 'random_read',
  'randwrite': 'random_write',
  'read': 'sequential_read',
  'write': 'sequential_write'
};

/**
 * Parse block size string and return numeric value in bytes for sorting
 */
export const parseBlockSizeForSort = (blockSize: string): number => {
  const match = blockSize.match(/^(\d+(?:\.\d+)?)([KMGT]?)$/i);
  if (!match) return 0;

  const [, num, unit] = match;
  const value = parseFloat(num);
  const multipliers: Record<string, number> = {
    'K': 1024,
    'M': 1024 * 1024,
    'G': 1024 * 1024 * 1024,
    'T': 1024 * 1024 * 1024 * 1024
  };

  return value * (multipliers[unit.toUpperCase()] || 1);
};

/**
 * Normalize and sort block sizes
 */
export const normalizeBlockSizes = (blockSizes: string[]): string[] => {
  return [...new Set(blockSizes)]
    .sort((a, b) => parseBlockSizeForSort(a) - parseBlockSizeForSort(b));
};

/**
 * Calculate responsiveness metric (1000 / latency)
 * Higher values indicate better performance
 */
export const calculateResponsiveness = (latency: number | null): number | null => {
  if (latency === null || latency <= 0) return null;
  return 1000 / latency;
};

/**
 * Transform a single drive configuration into a data point
 */
const transformConfiguration = (
  drive: DriveAnalysis,
  config: any,
  pattern: PatternType
): DataPoint | null => {
  const iopsValue = typeof config.iops === 'string' ? parseFloat(config.iops) : config.iops;

  if (!iopsValue || iopsValue <= 0) {
    return null;
  }

  return {
    hostname: drive.hostname,
    driveModel: drive.drive_model || 'Unknown',
    driveType: drive.drive_type || 'Unknown',
    protocol: drive.protocol || 'unknown',
    blockSize: config.block_size,
    pattern,
    iops: iopsValue,
    avgLatency: config.avg_latency !== null && config.avg_latency !== undefined ? config.avg_latency : null,
    p70Latency: config.p70_latency !== null && config.p70_latency !== undefined ? config.p70_latency : null,
    p90Latency: config.p90_latency !== null && config.p90_latency !== undefined ? config.p90_latency : null,
    p95Latency: config.p95_latency !== null && config.p95_latency !== undefined ? config.p95_latency : null,
    p99Latency: config.p99_latency !== null && config.p99_latency !== undefined ? config.p99_latency : null,
    bandwidth: config.bandwidth !== null && config.bandwidth !== undefined ? config.bandwidth : null,
    responsiveness: calculateResponsiveness(config.avg_latency),
    queueDepth: config.queue_depth || 0,
    timestamp: config.timestamp || new Date().toISOString()
  };
};

/**
 * Aggregate data from all drives and extract metadata
 */
export const aggregateData = (drives: DriveAnalysis[]): AggregatedData => {
  const allBlockSizes = new Set<string>();
  const allPatterns = new Set<PatternType>();
  const allHosts = new Set<string>();
  const series: SeriesDefinition[] = [];
  const maxValues: Record<MetricType, number> = {
    iops: 0,
    avg_latency: 0,
    p70_latency: 0,
    p90_latency: 0,
    p95_latency: 0,
    p99_latency: 0,
    bandwidth: 0,
    responsiveness: 0
  };

  // Process each drive
  drives.forEach(drive => {
    allHosts.add(drive.hostname);

    // Group data points by series (hostname + drive + protocol combination)
    const seriesKey = `${drive.hostname}-${drive.protocol}-${drive.drive_model}-${drive.drive_type}`;
    let seriesIndex = series.findIndex(s => s.id === seriesKey);

    if (seriesIndex === -1) {
      series.push({
        id: seriesKey,
        hostname: drive.hostname,
        driveModel: drive.drive_model || 'Unknown',
        protocol: drive.protocol || 'unknown',
        driveType: drive.drive_type || 'Unknown',
        label: `${drive.hostname} (${drive.drive_model})`,
        color: '', // Will be set by chart configuration
        data: []
      });
      seriesIndex = series.length - 1;
    }

    // Process each configuration
    drive.configurations?.forEach(config => {
      const mappedPattern = PATTERN_MAPPING[config.read_write_pattern] || config.read_write_pattern as PatternType;
      allPatterns.add(mappedPattern);
      allBlockSizes.add(config.block_size);

      const dataPoint = transformConfiguration(drive, config, mappedPattern);
      if (dataPoint) {
        series[seriesIndex].data.push(dataPoint);

        // Update maximum values for normalization
        if (dataPoint.iops > maxValues.iops) maxValues.iops = dataPoint.iops;
        if (dataPoint.avgLatency && dataPoint.avgLatency > maxValues.avg_latency) maxValues.avg_latency = dataPoint.avgLatency;
        if (dataPoint.p70Latency && dataPoint.p70Latency > maxValues.p70_latency) maxValues.p70_latency = dataPoint.p70Latency;
        if (dataPoint.p90Latency && dataPoint.p90Latency > maxValues.p90_latency) maxValues.p90_latency = dataPoint.p90Latency;
        if (dataPoint.p95Latency && dataPoint.p95Latency > maxValues.p95_latency) maxValues.p95_latency = dataPoint.p95Latency;
        if (dataPoint.p99Latency && dataPoint.p99Latency > maxValues.p99_latency) maxValues.p99_latency = dataPoint.p99Latency;
        if (dataPoint.bandwidth && dataPoint.bandwidth > maxValues.bandwidth) maxValues.bandwidth = dataPoint.bandwidth;
        if (dataPoint.responsiveness && dataPoint.responsiveness > maxValues.responsiveness) maxValues.responsiveness = dataPoint.responsiveness;
      }
    });
  });

  return {
    blockSizes: normalizeBlockSizes(Array.from(allBlockSizes)),
    patterns: Array.from(allPatterns),
    hosts: Array.from(allHosts).sort(),
    series: series.filter(s => s.data.length > 0), // Remove empty series
    maxValues
  };
};

/**
 * Apply filters to aggregated data
 */
export const applyFilters = (data: AggregatedData, filters: ChartFilters): AggregatedData => {
  const filteredSeries = data.series
    .filter(series => {
      // Filter by hosts
      if (filters.selectedHosts.length > 0 && !filters.selectedHosts.includes(series.hostname)) {
        return false;
      }
      return true;
    })
    .map(series => ({
      ...series,
      data: series.data.filter(point => {
        // Filter by patterns
        if (filters.selectedPatterns.length > 0 && !filters.selectedPatterns.includes(point.pattern)) {
          return false;
        }

        // Filter by block sizes
        if (filters.selectedBlockSizes.length > 0 && !filters.selectedBlockSizes.includes(point.blockSize)) {
          return false;
        }

        return true;
      })
    }))
    .filter(series => series.data.length > 0); // Remove series with no data after filtering

  // Recalculate max values for filtered data
  const maxValues: Record<MetricType, number> = {
    iops: 0,
    avg_latency: 0,
    p70_latency: 0,
    p90_latency: 0,
    p95_latency: 0,
    p99_latency: 0,
    bandwidth: 0,
    responsiveness: 0
  };

  filteredSeries.forEach(series => {
    series.data.forEach(point => {
      if (point.iops > maxValues.iops) maxValues.iops = point.iops;
      if (point.avgLatency && point.avgLatency > maxValues.avg_latency) maxValues.avg_latency = point.avgLatency;
      if (point.p95Latency && point.p95Latency > maxValues.p95_latency) maxValues.p95_latency = point.p95Latency;
      if (point.p99Latency && point.p99Latency > maxValues.p99_latency) maxValues.p99_latency = point.p99Latency;
      if (point.bandwidth && point.bandwidth > maxValues.bandwidth) maxValues.bandwidth = point.bandwidth;
      if (point.responsiveness && point.responsiveness > maxValues.responsiveness) maxValues.responsiveness = point.responsiveness;
    });
  });

  // Get filtered block sizes and patterns
  const filteredBlockSizes = new Set<string>();
  const filteredPatterns = new Set<PatternType>();
  const filteredHosts = new Set<string>();

  filteredSeries.forEach(series => {
    filteredHosts.add(series.hostname);
    series.data.forEach(point => {
      filteredBlockSizes.add(point.blockSize);
      filteredPatterns.add(point.pattern);
    });
  });

  return {
    blockSizes: normalizeBlockSizes(Array.from(filteredBlockSizes)),
    patterns: Array.from(filteredPatterns),
    hosts: Array.from(filteredHosts).sort(),
    series: filteredSeries,
    maxValues
  };
};

/**
 * Generate chart data for IOPS comparison
 */
export const generateIOPSComparisonData = (
  aggregatedData: AggregatedData,
  selectedPattern?: PatternType
): ChartData => {
  const { blockSizes, series } = aggregatedData;

  const datasets = series.map(seriesItem => {
    const data = blockSizes.map(blockSize => {
      const point = seriesItem.data.find(p =>
        p.blockSize === blockSize &&
        (!selectedPattern || p.pattern === selectedPattern)
      );
      return point ? point.iops : 0;
    });

    return {
      label: seriesItem.label,
      data,
      backgroundColor: seriesItem.color || '#3B82F6',
      borderColor: seriesItem.color || '#2563EB',
      borderWidth: 2,
      tension: 0.1,
      fill: false,
      pointRadius: 4,
      pointHoverRadius: 6
    };
  });

  return {
    labels: blockSizes,
    datasets
  };
};

/**
 * Generate chart data for bandwidth trends
 */
export const generateBandwidthTrendsData = (aggregatedData: AggregatedData): ChartData => {
  const { blockSizes, series } = aggregatedData;

  const datasets = series.map(seriesItem => {
    const data = blockSizes.map(blockSize => {
      const point = seriesItem.data.find(p => p.blockSize === blockSize);
      return point?.bandwidth || 0;
    });

    return {
      label: seriesItem.label,
      data,
      backgroundColor: seriesItem.color || '#10B981',
      borderColor: seriesItem.color || '#059669',
      borderWidth: 2,
      fill: true,
      tension: 0.1,
      pointRadius: 3,
      pointHoverRadius: 5
    };
  });

  return {
    labels: blockSizes,
    datasets
  };
};

/**
 * Validation function for data integrity
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export const validateDataIntegrity = (drives: DriveAnalysis[]): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!Array.isArray(drives)) {
    errors.push('Drives data must be an array');
    return { isValid: false, errors, warnings };
  }

  if (drives.length === 0) {
    warnings.push('No drive data provided');
    return { isValid: true, errors, warnings };
  }

  drives.forEach((drive, index) => {
    if (!drive.hostname) {
      errors.push(`Drive ${index}: hostname is required`);
    }

    if (!drive.configurations || !Array.isArray(drive.configurations)) {
      errors.push(`Drive ${index}: configurations must be an array`);
      return;
    }

    drive.configurations.forEach((config, configIndex) => {
      if (!config.block_size) {
        warnings.push(`Drive ${index}, config ${configIndex}: block_size is missing`);
      }

      if (!config.read_write_pattern) {
        warnings.push(`Drive ${index}, config ${configIndex}: read_write_pattern is missing`);
      }

      if (typeof config.iops !== 'number' && typeof config.iops !== 'string') {
        warnings.push(`Drive ${index}, config ${configIndex}: iops should be a number`);
      }
    });
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Format IOPS values for display
 */
export const formatIOPS = (iops: number): string => {
  if (iops >= 1000000) return (iops / 1000000).toFixed(1) + 'M';
  if (iops >= 1000) return (iops / 1000).toFixed(0) + 'k';
  return iops.toFixed(0);
};

/**
 * Format bandwidth values for display
 */
export const formatBandwidth = (bandwidth: number): string => {
  if (bandwidth >= 1000000) return (bandwidth / 1000000).toFixed(1) + ' GB/s';
  if (bandwidth >= 1000) return (bandwidth / 1000).toFixed(1) + ' MB/s';
  return bandwidth.toFixed(1) + ' KB/s';
};

/**
 * Format latency values for display
 */
export const formatLatency = (latency: number): string => {
  if (latency >= 1000) return (latency / 1000).toFixed(1) + ' s';
  if (latency >= 1) return latency.toFixed(2) + ' ms';
  return (latency * 1000).toFixed(0) + ' μs';
};