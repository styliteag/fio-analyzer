import React from 'react';
import { LucideIcon } from 'lucide-react';
import Card from '../ui/Card';
import Loading from '../ui/Loading';

export interface MetricCardData {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  description?: string;
}

export interface MetricsCardProps {
  /** Single metric data or array of metrics */
  metrics: MetricCardData | MetricCardData[];
  /** Loading state */
  loading?: boolean;
  /** Error state */
  error?: string | null;
  /** Custom className for the container */
  className?: string;
  /** Custom className for individual cards */
  cardClassName?: string;
  /** Grid layout configuration */
  gridCols?: {
    default?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  /** Format large numbers with locale string */
  formatNumbers?: boolean;
  /** Show loading skeleton for individual cards */
  showCardLoading?: boolean;
}

/**
 * Reusable MetricsCard component that handles different metric types
 * Supports single metric or grid of metrics with responsive layout
 * Includes loading states, error handling, and consistent styling
 */
export default function MetricsCard({
  metrics,
  loading = false,
  error = null,
  className = '',
  cardClassName = '',
  gridCols = { default: 1, md: 2, lg: 3 },
  formatNumbers = true,
  showCardLoading = true
}: MetricsCardProps) {
  // Normalize metrics to always be an array
  const metricsArray = Array.isArray(metrics) ? metrics : [metrics];

  // Generate responsive grid classes
  const generateGridClasses = () => {
    const classes = ['grid', 'gap-6'];
    
    if (gridCols.default) classes.push(`grid-cols-${gridCols.default}`);
    if (gridCols.sm) classes.push(`sm:grid-cols-${gridCols.sm}`);
    if (gridCols.md) classes.push(`md:grid-cols-${gridCols.md}`);
    if (gridCols.lg) classes.push(`lg:grid-cols-${gridCols.lg}`);
    if (gridCols.xl) classes.push(`xl:grid-cols-${gridCols.xl}`);
    
    return classes.join(' ');
  };

  // Format value based on type and options
  const formatValue = (value: string | number): string => {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' && formatNumbers) {
      return value.toLocaleString();
    }
    return value.toString();
  };

  // Show error state
  if (error) {
    return (
      <div className={`${className}`}>
        <Card className={`p-6 border-red-200 dark:border-red-800 ${cardClassName}`}>
          <div className="text-center">
            <p className="text-red-600 dark:text-red-400 text-sm">
              Error loading metrics: {error}
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className={`${generateGridClasses()} ${className}`}>
      {metricsArray.map((metric, index) => (
        <Card key={index} className={`p-6 ${cardClassName}`}>
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="theme-text-secondary text-sm font-medium mb-1">
                {metric.title}
              </p>
              <div className="theme-text-primary text-2xl font-bold">
                {loading && showCardLoading ? (
                  <Loading size="sm" />
                ) : (
                  formatValue(metric.value)
                )}
              </div>
              {metric.description && (
                <p className="theme-text-secondary text-xs mt-1 leading-tight">
                  {metric.description}
                </p>
              )}
            </div>
            <div className={`${metric.color} opacity-80 ml-4 flex-shrink-0`}>
              <metric.icon className="w-8 h-8" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// Helper function to create metric data objects
export const createMetric = (
  title: string,
  value: string | number,
  icon: LucideIcon,
  color: string,
  description?: string
): MetricCardData => ({
  title,
  value,
  icon,
  color,
  description
});

// Preset color schemes for consistency
export const metricColors = {
  blue: 'text-blue-600 dark:text-blue-400',
  green: 'text-green-600 dark:text-green-400',
  purple: 'text-purple-600 dark:text-purple-400',
  orange: 'text-orange-600 dark:text-orange-400',
  indigo: 'text-indigo-600 dark:text-indigo-400',
  red: 'text-red-600 dark:text-red-400',
  yellow: 'text-yellow-600 dark:text-yellow-400',
  cyan: 'text-cyan-600 dark:text-cyan-400',
  teal: 'text-teal-600 dark:text-teal-400',
  pink: 'text-pink-600 dark:text-pink-400',
} as const;

// Example usage types for better TypeScript support
export type MetricColorKey = keyof typeof metricColors;