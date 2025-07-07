import { memo } from 'react';
import { Check, HardDrive, Clock, Layers, Zap, Users } from 'lucide-react';
import type { ConfigurationComparison } from '../utils/configurationMatcher';
import { getConfigurationSummary } from '../utils/configurationMatcher';

interface ConfigurationCardProps {
  comparison: ConfigurationComparison;
  isSelected: boolean;
  onSelect: () => void;
  className?: string;
}

function ConfigurationCard({ comparison, isSelected, onSelect, className = '' }: ConfigurationCardProps) {
  const { config, hostData, coverage, hasAllHosts } = comparison;
  const summary = getConfigurationSummary(config);

  // Coverage color classes
  const getCoverageColor = (coverage: number) => {
    if (coverage >= 0.8) return 'text-green-600 bg-green-100 dark:bg-green-900/30';
    if (coverage >= 0.6) return 'text-amber-600 bg-amber-100 dark:bg-amber-900/30';
    return 'text-red-600 bg-red-100 dark:bg-red-900/30';
  };

  const coveragePercent = Math.round(coverage * 100);

  return (
    <div
      onClick={onSelect}
      className={`
        relative p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 hover:shadow-lg
        ${isSelected 
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md' 
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300'
        }
        ${className}
      `}
    >
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
          <Check className="w-4 h-4 text-white" />
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold theme-text-primary text-sm leading-tight">
            {summary.primary}
          </h3>
          {summary.secondary !== 'Standard' && (
            <p className="text-xs theme-text-secondary mt-1">
              {summary.secondary}
            </p>
          )}
        </div>
        
        <div className={`px-2 py-1 rounded-full text-xs font-medium ${getCoverageColor(coverage)}`}>
          {coveragePercent}%
        </div>
      </div>

      {/* Test parameters only - no hardware info */}
      <div className="mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
        <span className="text-xs theme-text-secondary">
          Test Configuration (hardware-agnostic)
        </span>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="flex items-center gap-1">
          <Layers className="w-3 h-3 theme-text-secondary" />
          <span className="text-xs theme-text-secondary">
            QD {config.queue_depth}
          </span>
        </div>
        
        {config.duration > 0 && (
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 theme-text-secondary" />
            <span className="text-xs theme-text-secondary">
              {config.duration}s
            </span>
          </div>
        )}
        
        {config.num_jobs > 1 && (
          <div className="flex items-center gap-1">
            <Zap className="w-3 h-3 theme-text-secondary" />
            <span className="text-xs theme-text-secondary">
              {config.num_jobs} jobs
            </span>
          </div>
        )}
        
        <div className="flex items-center gap-1">
          <Users className="w-3 h-3 theme-text-secondary" />
          <span className="text-xs theme-text-secondary">
            {hostData.length} hosts
          </span>
        </div>
      </div>

      {/* Host coverage indicators with hardware diversity */}
      <div className="space-y-1">
        <div className="text-xs theme-text-secondary font-medium">Hosts with this config:</div>
        <div className="flex flex-wrap gap-1">
          {hostData.map(({ hostname, run }, index) => (
            <span
              key={`${hostname}-${run.protocol}-${run.drive_type}-${run.drive_model}-${run.id || index}`}
              className="inline-block px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-full"
              title={`${hostname} - ${run.protocol} - ${run.drive_type} - ${run.drive_model}`}
            >
              {hostname}
            </span>
          ))}
        </div>
      </div>

      {/* All hosts indicator */}
      {hasAllHosts && (
        <div className="mt-2 flex items-center gap-1">
          <Check className="w-3 h-3 text-green-600" />
          <span className="text-xs text-green-600 font-medium">
            Complete coverage
          </span>
        </div>
      )}
    </div>
  );
}

export default memo(ConfigurationCard);