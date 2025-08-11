import type { PerformanceData } from '../types';
import { sortBlockSizes } from './sorting';
import { getMetricValue } from '../components/charts/chartProcessors';

export type SortOption = 
  | "name" 
  | "iops" 
  | "latency" 
  | "bandwidth" 
  | "blocksize" 
  | "drivemodel" 
  | "protocol" 
  | "hostname" 
  | "queuedepth";

export type GroupOption = 
  | "none"
  | "drive" 
  | "test" 
  | "blocksize" 
  | "protocol" 
  | "hostname" 
  | "queuedepth" 
  | "iodepth" 
  | "numjobs" 
  | "direct" 
  | "sync" 
  | "testsize" 
  | "duration";

export interface SortingOptions {
  sortBy: SortOption;
  sortOrder: 'asc' | 'desc';
  groupBy: GroupOption;
}

/**
 * Extract sort value from performance data item
 */
export const getSortValue = (item: PerformanceData, sortBy: SortOption): any => {
  switch (sortBy) {
    case "name":
      return `${item.test_name}_${item.drive_model}_${item.block_size}`;
    case "iops":
      return getMetricValue(item.metrics, "iops");
    case "latency":
      return getMetricValue(item.metrics, "avg_latency");
    case "bandwidth":
      return getMetricValue(item.metrics, "bandwidth");
    case "blocksize":
      return item.block_size;
    case "drivemodel":
      return item.drive_model;
    case "protocol":
      return item.protocol || "";
    case "hostname":
      return item.hostname || "";
    case "queuedepth":
      return item.queue_depth || (item as any).iodepth || 0;
    default:
      return item.test_name;
  }
};

/**
 * Compare two values for sorting
 */
export const compareValues = (
  aValue: any, 
  bValue: any, 
  sortBy: SortOption, 
  sortOrder: 'asc' | 'desc'
): number => {
  // Special handling for block size sorting
  if (sortBy === "blocksize") {
    const sorted = sortBlockSizes([aValue, bValue]);
    const result = sorted[0] === aValue ? -1 : 1;
    return sortOrder === "asc" ? result : -result;
  }

  const comparison = typeof aValue === "string"
    ? aValue.localeCompare(bValue)
    : aValue - bValue;
  
  return sortOrder === "asc" ? comparison : -comparison;
};

/**
 * Format group key consistently
 */
export const formatGroupKey = (groupBy: GroupOption, item: PerformanceData): string => {
  switch (groupBy) {
    case "drive":
      return item.drive_model;
    case "test":
      return item.read_write_pattern;
    case "blocksize":
      return item.block_size.toString();
    case "protocol":
      return item.protocol || "Unknown";
    case "hostname":
      return item.hostname || "Unknown";
    case "queuedepth": {
      const queueDepth = item.queue_depth || (item as any).iodepth || 0;
      return `QD${queueDepth}`;
    }
    case "iodepth": {
      const ioDepth = (item as any).iodepth || item.queue_depth || 0;
      return `IOD${ioDepth}`;
    }
    case "numjobs": {
      const numJobs = (item as any).num_jobs || 1;
      return `${numJobs} Jobs`;
    }
    case "direct": {
      const direct = (item as any).direct;
      if (direct === null || direct === undefined) return "Direct IO: Unknown";
      return direct === 1 ? "Direct IO: Yes" : "Direct IO: No";
    }
    case "sync": {
      const sync = (item as any).sync;
      if (sync === null || sync === undefined) return "Sync: Unknown";
      return sync === 1 ? "Sync: On" : "Sync: Off";
    }
    case "testsize": {
      const testSize = (item as any).test_size || "Unknown";
      return `Size: ${testSize}`;
    }
    case "duration": {
      const duration = (item as any).duration || 0;
      return `${duration}s`;
    }
    default:
      return "Default";
  }
};

/**
 * Apply sorting to performance data array
 */
export const applySorting = (
  data: PerformanceData[], 
  options: SortingOptions
): PerformanceData[] => {
  const { sortBy, sortOrder } = options;
  
  const sortedData = [...data];
  sortedData.sort((a, b) => {
    const aValue = getSortValue(a, sortBy);
    const bValue = getSortValue(b, sortBy);
    return compareValues(aValue, bValue, sortBy, sortOrder);
  });

  return sortedData;
};

/**
 * Apply grouping sort to performance data array
 */
export const applyGroupingSorting = (
  data: PerformanceData[], 
  options: SortingOptions
): PerformanceData[] => {
  const { sortBy, sortOrder, groupBy } = options;
  
  if (groupBy === "none") {
    return applySorting(data, options);
  }

  const sortedData = [...data];
  sortedData.sort((a, b) => {
    // First sort by group
    const aGroupValue = formatGroupKey(groupBy, a);
    const bGroupValue = formatGroupKey(groupBy, b);
    
    // Special handling for block size sorting
    if (groupBy === "blocksize") {
      const blockComparison = sortBlockSizes([a.block_size.toString(), b.block_size.toString()])[0] === a.block_size.toString() ? -1 : 1;
      if (blockComparison !== 0) return blockComparison;
    } else {
      const groupComparison = typeof aGroupValue === "string"
        ? aGroupValue.localeCompare(bGroupValue)
        : (Number(aGroupValue) || 0) - (Number(bGroupValue) || 0);
      
      if (groupComparison !== 0) return groupComparison;
    }

    // If groups are the same, apply original sorting within the group
    const aValue = getSortValue(a, sortBy);
    const bValue = getSortValue(b, sortBy);
    return compareValues(aValue, bValue, sortBy, sortOrder);
  });

  return sortedData;
};

/**
 * Main function that combines sorting and grouping
 */
export const applySortingAndGrouping = (
  data: PerformanceData[],
  options: SortingOptions,
): PerformanceData[] => {
  return applyGroupingSorting(data, options);
};