import React, { useState, useCallback } from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import { Loading } from '../../ui';
import { useChartData } from './hooks/useChartData';
import {
  IOPSComparisonChart,
  LatencyAnalysisChart,
  BandwidthTrendsChart,
  ResponsivenessChart
} from './components';
import type { PerformanceGraphsProps, ChartType, ChartError, ChartFilters } from './types';

/**
 * Simple error boundary component
 */
class PerformanceGraphsErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('PerformanceGraphs Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full p-8 text-center border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-950/20">
          <h4 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
            Chart Rendering Error
          </h4>
          <p className="text-sm text-red-600 dark:text-red-300 mb-4">
            {this.state.error?.message || 'An error occurred while rendering the performance graphs.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Main PerformanceGraphs component container
 */
const PerformanceGraphsInner: React.FC<PerformanceGraphsProps> = ({ drives }) => {
  const { actualTheme } = useTheme();
  const [activeChart, setActiveChart] = useState<ChartType>('iops-comparison');
  const [filters] = useState<ChartFilters>({
    selectedPatterns: ['random_read', 'random_write', 'sequential_read', 'sequential_write'],
    selectedHosts: [],
    selectedMetrics: ['iops', 'avg_latency', 'bandwidth'],
    selectedBlockSizes: []
  });

  // Use chart data hook
  const { filteredData, loading, error: dataError } = useChartData(drives, filters);
  const [error, setError] = useState<ChartError | null>(null);

  // Handle chart type changes
  const handleChartTypeChange = useCallback((chartType: ChartType) => {
    setActiveChart(chartType);
    setError(null);
  }, []);

  // Clear errors
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Use data error if available
  const currentError = error || dataError;

  // Loading state
  if (loading) {
    return (
      <div className="w-full flex justify-center py-12">
        <Loading />
      </div>
    );
  }

  // Empty state handling
  if (!drives || drives.length === 0) {
    return (
      <div className="w-full p-8 text-center">
        <h4 className="text-xl font-bold theme-text-primary mb-2">
          Performance Graphs
        </h4>
        <p className="text-sm theme-text-secondary mb-4">
          Interactive chart-based visualization of storage performance metrics.
        </p>
        <div className="py-8">
          <p className="text-lg theme-text-primary">No performance data available</p>
          <p className="text-sm theme-text-secondary mt-2">
            Please select hosts with performance data to view graphs
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="mb-6">
        <h4 className="text-xl font-bold theme-text-primary mb-2">
          Performance Graphs
        </h4>
        <p className="text-sm theme-text-secondary mb-4">
          Interactive chart-based visualization of storage performance metrics across {drives.length} drive configurations.
        </p>
      </div>

      {/* Error Display */}
      {currentError && (
        <div className="p-4 border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-950/20">
          <div className="flex justify-between items-start">
            <div>
              <h5 className="text-sm font-semibold text-red-800 dark:text-red-200">
                {currentError.type.charAt(0).toUpperCase() + currentError.type.slice(1)} Error
              </h5>
              <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                {currentError.message}
              </p>
            </div>
            <button
              onClick={clearError}
              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Chart Type Selection */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => handleChartTypeChange('iops-comparison')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeChart === 'iops-comparison'
              ? 'bg-blue-600 text-white dark:bg-blue-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          IOPS Comparison
        </button>
        <button
          onClick={() => handleChartTypeChange('latency-analysis')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeChart === 'latency-analysis'
              ? 'bg-blue-600 text-white dark:bg-blue-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          Latency Analysis
        </button>
        <button
          onClick={() => handleChartTypeChange('bandwidth-trends')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeChart === 'bandwidth-trends'
              ? 'bg-blue-600 text-white dark:bg-blue-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          Bandwidth Trends
        </button>
        <button
          onClick={() => handleChartTypeChange('responsiveness')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeChart === 'responsiveness'
              ? 'bg-blue-600 text-white dark:bg-blue-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          Responsiveness
        </button>
      </div>

      {/* Chart Content */}
      <div className="w-full">
        {activeChart === 'iops-comparison' && (
          <IOPSComparisonChart
            data={filteredData}
            filters={filters}
            height={400}
            className="w-full"
          />
        )}
        {activeChart === 'latency-analysis' && (
          <LatencyAnalysisChart
            data={filteredData}
            filters={filters}
            height={400}
            className="w-full"
          />
        )}
        {activeChart === 'bandwidth-trends' && (
          <BandwidthTrendsChart
            data={filteredData}
            filters={filters}
            height={400}
            className="w-full"
          />
        )}
        {activeChart === 'responsiveness' && (
          <ResponsivenessChart
            data={filteredData}
            filters={filters}
            height={400}
            className="w-full"
          />
        )}
      </div>

      {/* Development Info */}
      {typeof window !== 'undefined' && (
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h6 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">
            Development Info
          </h6>
          <div className="text-xs text-blue-600 dark:text-blue-300 space-y-1">
            <p>Total drives: {drives.length}</p>
            <p>Available configurations: {drives.reduce((sum, drive) => sum + drive.configurations.length, 0)}</p>
            <p>Unique hosts: {new Set(drives.map(d => d.hostname)).size}</p>
            <p>Active chart: {activeChart}</p>
            <p>Series count: {filteredData.series.length}</p>
            <p>Block sizes: {filteredData.blockSizes.length}</p>
            <p>Theme: {actualTheme}</p>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * PerformanceGraphs component with error boundary
 */
const PerformanceGraphs: React.FC<PerformanceGraphsProps> = ({ drives }) => {
  return (
    <PerformanceGraphsErrorBoundary>
      <PerformanceGraphsInner drives={drives} />
    </PerformanceGraphsErrorBoundary>
  );
};

export default PerformanceGraphs;