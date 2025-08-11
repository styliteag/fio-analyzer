import React, { memo, useMemo, useCallback } from 'react';
import { Edit2, Trash2, HardDrive, Network, Server, Activity, Clock, Layers, Database, Zap } from 'lucide-react';
import type { TestRun } from '../../types';

interface TestRunGridProps {
    selectedRuns: TestRun[];
    onEdit: (testRun: TestRun) => void;
    onDelete: (testRun: TestRun) => void;
    deleting: number | null;
}

// Individual TestRunCard component for better memoization
const TestRunCard = memo<{
  run: TestRun;
  deleting: number | null;
  onEdit: (testRun: TestRun) => void;
  onDelete: (testRun: TestRun) => void;
}>(({ run, deleting, onEdit, onDelete }) => {
  // Memoized handlers to prevent re-creation
  const handleEdit = useCallback(() => onEdit(run), [onEdit, run]);
  const handleDelete = useCallback(() => onDelete(run), [onDelete, run]);

  // Memoized icon components
  const driveTypeIcon = useMemo(() => {
    return <HardDrive className="h-3 w-3" />;
  }, []);

  const protocolIcon = useMemo(() => {
    switch (run.protocol?.toLowerCase()) {
      case 'nfs':
      case 'smb':
        return <Network className="h-3 w-3" />;
      case 'nvme':
        return <Activity className="h-3 w-3" />;
      default:
        return <Network className="h-3 w-3" />;
    }
  }, [run.protocol]);

  // Memoized date formatting
  const formattedDate = useMemo(() => {
    const date = new Date(run.timestamp);
    return date.toLocaleDateString();
  }, [run.timestamp]);

  // Memoized duration formatting
  const formattedDuration = useMemo(() => {
    if (!run.duration) return null;
    if (run.duration < 60) return `${run.duration}s`;
    const minutes = Math.floor(run.duration / 60);
    const seconds = run.duration % 60;
    return `${minutes}m${seconds > 0 ? ` ${seconds}s` : ''}`;
  }, [run.duration]);

  return (
    <div
      className="theme-bg-secondary p-3 rounded-md text-xs relative group border theme-border-primary hover:theme-bg-primary transition-colors"
    >
      {/* Action buttons */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        <button
          type="button"
          onClick={handleEdit}
          className="p-1 rounded theme-hover"
          title="Edit drive info"
          disabled={deleting === run.id}
        >
          <Edit2 className="h-3 w-3 theme-text-secondary" />
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="p-1 rounded theme-hover"
          title="Delete test run"
          disabled={deleting === run.id}
        >
          <Trash2 className="h-3 w-3 theme-text-error" />
        </button>
      </div>

      {/* Drive info */}
      <div className="space-y-1">
        <div className="font-medium theme-text-primary text-sm truncate pr-8">
          {run.drive_model}
        </div>
        
        {/* Test pattern */}
        <div className="flex items-center gap-1 theme-text-secondary">
          <Activity className="h-3 w-3" />
          <span className="truncate">{run.test_name}</span>
        </div>

        {/* Block size and queue depth */}
        <div className="flex items-center gap-2 theme-text-tertiary text-xs">
          <span>{run.block_size}</span>
          <span>•</span>
          <span>QD{run.queue_depth}</span>
        </div>

        {/* Additional test parameters */}
        <div className="flex flex-wrap gap-1 theme-text-tertiary text-xs">
          {/* Duration */}
          {formattedDuration && (
            <div className="flex items-center gap-1">
              <Clock className="h-2 w-2" />
              <span>{formattedDuration}</span>
            </div>
          )}
          
          {/* Sync */}
          {run.sync !== undefined && (
            <div className="flex items-center gap-1">
              <Zap className="h-2 w-2" />
              <span>Sync{run.sync}</span>
            </div>
          )}
          
          {/* Direct */}
          {run.direct !== undefined && (
            <div className="flex items-center gap-1">
              <Database className="h-2 w-2" />
              <span>Direct{run.direct}</span>
            </div>
          )}
          
          {/* NumJobs */}
          {run.num_jobs && (
            <div className="flex items-center gap-1">
              <Layers className="h-2 w-2" />
              <span>Jobs{run.num_jobs}</span>
            </div>
          )}
          
          {/* TestSize */}
          {run.test_size && (
            <div className="flex items-center gap-1">
              <Database className="h-2 w-2" />
              <span>{run.test_size}</span>
            </div>
          )}
        </div>

        {/* Hostname and protocol */}
        {(run.hostname || run.protocol) && (
          <div className="flex items-center gap-2 theme-text-tertiary text-xs">
            {run.hostname && (
              <div className="flex items-center gap-1">
                <Server className="h-3 w-3" />
                <span className="truncate">{run.hostname}</span>
              </div>
            )}
            {run.protocol && (
              <div className="flex items-center gap-1">
                {protocolIcon}
                <span>{run.protocol}</span>
              </div>
            )}
          </div>
        )}

        {/* Drive type and date */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1">
            {driveTypeIcon}
            <span className="px-2 py-0.5 theme-bg-accent theme-text-accent rounded text-xs">
              {run.drive_type}
            </span>
          </div>
          <span className="theme-text-tertiary text-xs">
            {formattedDate}
          </span>
        </div>
      </div>
    </div>
  );
});

TestRunCard.displayName = 'TestRunCard';

const TestRunGrid: React.FC<TestRunGridProps> = ({
    selectedRuns,
    onEdit,
    onDelete,
    deleting,
}) => {
    // Memoized responsive grid columns configuration
    const gridColumns = useMemo(() => ({
        sm: 2, // 2 columns on small screens (mobile)
        md: 3, // 3 columns on medium screens (tablet)
        lg: 4, // 4 columns on large screens (laptop)
        xl: 5, // 5 columns on extra large screens (desktop)
        "2xl": 6, // 6 columns on 2xl screens (wide desktop)
    }), []);

    // Memoized grid classes to prevent recalculation
    const gridClasses = useMemo(() => {
        return `grid gap-3 grid-cols-${gridColumns.sm} md:grid-cols-${gridColumns.md} lg:grid-cols-${gridColumns.lg} xl:grid-cols-${gridColumns.xl} 2xl:grid-cols-${gridColumns["2xl"]}`;
    }, [gridColumns]);

    if (selectedRuns.length === 0) {
        return null;
    }

    return (
        <div className="mt-4">
            <div className="max-h-60 overflow-y-auto border theme-border-secondary rounded-md p-3 theme-bg-tertiary">
                <div className={gridClasses}>
                    {selectedRuns.map((run) => (
                        <TestRunCard
                            key={run.id}
                            run={run}
                            deleting={deleting}
                            onEdit={onEdit}
                            onDelete={onDelete}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

// Export memoized version with shallow comparison
export default memo(TestRunGrid, (prevProps, nextProps) => {
    // Check if arrays are the same reference first (most common case)
    if (prevProps.selectedRuns === nextProps.selectedRuns &&
        prevProps.onEdit === nextProps.onEdit &&
        prevProps.onDelete === nextProps.onDelete &&
        prevProps.deleting === nextProps.deleting) {
        return true;
    }

    // Check if selectedRuns array content changed
    if (prevProps.selectedRuns.length !== nextProps.selectedRuns.length) {
        return false;
    }

    // Check if any run object references changed
    for (let i = 0; i < prevProps.selectedRuns.length; i++) {
        if (prevProps.selectedRuns[i] !== nextProps.selectedRuns[i]) {
            return false;
        }
    }

    // Check other props
    return prevProps.deleting === nextProps.deleting;
});