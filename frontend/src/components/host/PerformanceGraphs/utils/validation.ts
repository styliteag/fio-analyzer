/**
 * Validation utilities for Performance Graphs data processing
 */

import type { DriveAnalysis } from '../../../../services/api/hostAnalysis';
import type { ChartData, ChartType, ValidationResult } from '../types';

/**
 * Validate DriveAnalysis array for data integrity
 */
export const validateDriveAnalysis = (drives: DriveAnalysis[]): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if drives is an array
  if (!Array.isArray(drives)) {
    errors.push('Drives data must be an array');
    return { isValid: false, errors, warnings };
  }

  // Empty data is valid but worth warning about
  if (drives.length === 0) {
    warnings.push('No drive data provided');
    return { isValid: true, errors, warnings };
  }

  // Validate each drive
  drives.forEach((drive, index) => {
    if (!drive.hostname || typeof drive.hostname !== 'string') {
      errors.push(`Drive ${index}: hostname is required and must be a string`);
    }

    if (!drive.configurations || !Array.isArray(drive.configurations)) {
      errors.push(`Drive ${index}: configurations must be an array`);
      return;
    }

    if (drive.configurations.length === 0) {
      warnings.push(`Drive ${index}: no configuration data available`);
    }

    // Validate each configuration
    drive.configurations.forEach((config, configIndex) => {
      const configId = `Drive ${index}, config ${configIndex}`;

      if (!config.block_size || typeof config.block_size !== 'string') {
        warnings.push(`${configId}: block_size is missing or invalid`);
      }

      if (!config.read_write_pattern || typeof config.read_write_pattern !== 'string') {
        warnings.push(`${configId}: read_write_pattern is missing or invalid`);
      }

      if (config.iops !== undefined && config.iops !== null) {
        const iopsValue = typeof config.iops === 'string' ? parseFloat(config.iops) : config.iops;
        if (isNaN(iopsValue) || iopsValue < 0) {
          warnings.push(`${configId}: iops should be a positive number`);
        }
      }

      if (config.avg_latency !== undefined && config.avg_latency !== null) {
        if (typeof config.avg_latency !== 'number' || config.avg_latency < 0) {
          warnings.push(`${configId}: avg_latency should be a positive number`);
        }
      }

      if (config.bandwidth !== undefined && config.bandwidth !== null) {
        if (typeof config.bandwidth !== 'number' || config.bandwidth < 0) {
          warnings.push(`${configId}: bandwidth should be a positive number`);
        }
      }

      if (config.queue_depth !== undefined && config.queue_depth !== null) {
        if (typeof config.queue_depth !== 'number' || config.queue_depth < 0) {
          warnings.push(`${configId}: queue_depth should be a positive number`);
        }
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
 * Validate chart data structure
 */
export const validateChartData = (data: ChartData, chartType: ChartType): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!data || typeof data !== 'object') {
    errors.push('Chart data must be an object');
    return { isValid: false, errors, warnings };
  }

  if (!Array.isArray(data.labels)) {
    errors.push('Chart data labels must be an array');
  } else if (data.labels.length === 0) {
    warnings.push('No labels provided for chart');
  }

  if (!Array.isArray(data.datasets)) {
    errors.push('Chart data datasets must be an array');
  } else {
    if (data.datasets.length === 0) {
      warnings.push('No datasets provided for chart');
    }

    data.datasets.forEach((dataset, index) => {
      const datasetId = `Dataset ${index}`;

      if (!dataset.label || typeof dataset.label !== 'string') {
        warnings.push(`${datasetId}: label should be a non-empty string`);
      }

      if (!Array.isArray(dataset.data)) {
        errors.push(`${datasetId}: data must be an array`);
      } else {
        if (dataset.data.length !== data.labels.length) {
          errors.push(`${datasetId}: data length (${dataset.data.length}) doesn't match labels length (${data.labels.length})`);
        }

        // Check for non-numeric values
        dataset.data.forEach((value, valueIndex) => {
          if (typeof value !== 'number' || isNaN(value)) {
            warnings.push(`${datasetId}, data point ${valueIndex}: value should be a number`);
          }
        });
      }

      // Chart type specific validations
      if (chartType === 'responsiveness' && dataset.data.some(value => value < 0)) {
        warnings.push(`${datasetId}: responsiveness values should not be negative`);
      }

      if (chartType === 'iops-comparison' && dataset.data.some(value => value < 0)) {
        warnings.push(`${datasetId}: IOPS values should not be negative`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Validate component props
 */
export const validateProps = (props: any, componentName: string): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!props || typeof props !== 'object') {
    errors.push(`${componentName}: props must be an object`);
    return { isValid: false, errors, warnings };
  }

  // Validate drives prop if it exists
  if (props.drives !== undefined) {
    const driveValidation = validateDriveAnalysis(props.drives);
    if (!driveValidation.isValid) {
      errors.push(`${componentName}: drives prop validation failed - ${driveValidation.errors.join(', ')}`);
    }
    warnings.push(...driveValidation.warnings.map((w: string) => `${componentName}: ${w}`));
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Runtime type guard for DriveAnalysis
 */
export const isDriveAnalysis = (obj: any): obj is DriveAnalysis => {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.hostname === 'string' &&
    Array.isArray(obj.configurations)
  );
};

/**
 * Runtime type guard for ChartData
 */
export const isValidChartData = (obj: any): obj is ChartData => {
  return (
    obj &&
    typeof obj === 'object' &&
    Array.isArray(obj.labels) &&
    Array.isArray(obj.datasets) &&
    obj.datasets.every((dataset: any) =>
      dataset &&
      typeof dataset === 'object' &&
      typeof dataset.label === 'string' &&
      Array.isArray(dataset.data)
    )
  );
};

/**
 * Check if data has sufficient information for meaningful charts
 */
export const hasMinimumDataForCharts = (drives: DriveAnalysis[]): boolean => {
  if (!drives || drives.length === 0) return false;

  const totalConfigurations = drives.reduce((sum, drive) => sum + (drive.configurations?.length || 0), 0);
  return totalConfigurations >= 2; // Need at least 2 data points for a meaningful chart
};

/**
 * Get data quality score (0-100)
 */
export const calculateDataQuality = (drives: DriveAnalysis[]): number => {
  if (!drives || drives.length === 0) return 0;

  let totalPoints = 0;
  let validPoints = 0;

  drives.forEach(drive => {
    drive.configurations?.forEach(config => {
      totalPoints++;

      // Check for essential fields
      if (config.block_size && config.read_write_pattern) {
        validPoints += 0.3;
      }

      if (typeof config.iops === 'number' && config.iops > 0) {
        validPoints += 0.4;
      }

      if (typeof config.avg_latency === 'number' && config.avg_latency > 0) {
        validPoints += 0.2;
      }

      if (typeof config.bandwidth === 'number' && config.bandwidth > 0) {
        validPoints += 0.1;
      }
    });
  });

  return totalPoints === 0 ? 0 : Math.round((validPoints / totalPoints) * 100);
};