import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { Settings, Database, Filter, BarChart3, History, ChevronUp, ChevronDown, Edit2, Trash2, ArrowLeft, Upload } from 'lucide-react';
import Button from '../components/ui/Button';
import Loading from '../components/ui/Loading';
import ErrorDisplay from '../components/ui/ErrorDisplay';
import Modal from '../components/ui/Modal';
import { useServerSideTestRuns } from '../hooks/useServerSideTestRuns';
import { bulkUpdateTestRuns, deleteTestRuns } from '../services/api/testRuns';
import { bulkImportFioData } from '../services/api/upload';
import { fetchTimeSeriesHistory, fetchTimeSeriesServers } from '../services/api/timeSeries';
import { bulkUpdateTimeSeries, deleteTimeSeriesRuns } from '../services/api/timeSeries';
import { useNavigate } from 'react-router-dom';
import type { TestRun } from '../types';

/*
  A leaner Admin page that relies 100% on the server-side filtering hook.
  Two simple views:
    1. Latest runs (is_latest = 1)
    2. Historical time-series (is_latest = 0) – grouped by configuration key
*/

const groupKey = (run: TestRun) => [
  run.hostname,
  run.protocol,
  run.drive_model,
  run.drive_type,
  run.read_write_pattern,
  run.block_size,
  run.queue_depth,
].join('|');

interface EditableFields {
  hostname?: string;
  protocol?: string;
  description?: string;
  test_name?: string;
  drive_type?: string;
  drive_model?: string;
}

interface BulkEditState {
  isOpen: boolean;
  fields: EditableFields;
  enabledFields: Record<keyof EditableFields, boolean>;
}

interface BulkDeleteState {
  isOpen: boolean;
}

interface HistoryEditState {
  isOpen: boolean;
  group: any | null;
  fields: EditableFields;
  enabledFields: Record<keyof EditableFields, boolean>;
}

interface HistoryDeleteState {
  isOpen: boolean;
  group: any | null;
}

interface BulkImportState {
  isOpen: boolean;
  overwrite: boolean;
  dryRun: boolean;
  loading: boolean;
}

interface BulkDeleteAllHistoryState {
  isOpen: boolean;
}

const Admin: React.FC = () => {
  const navigate = useNavigate();
  const [view, setView] = useState<'latest' | 'history'>('latest');
  
  // Latest Runs state (uses /api/test-runs)
  const [latestSortField, setLatestSortField] = useState<keyof TestRun>('timestamp');
  const [latestSortDirection, setLatestSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedLatestRuns, setSelectedLatestRuns] = useState<Set<number>>(new Set());
  
  // History state (uses /api/time-series)
  const [selectedHistoryRuns, setSelectedHistoryRuns] = useState<Set<number>>(new Set());
  const [timeSeriesData, setTimeSeriesData] = useState<any[]>([]);
  const [timeSeriesLoading, setTimeSeriesLoading] = useState(false);
  const [bulkEditState, setBulkEditState] = useState<BulkEditState>({
    isOpen: false,
    fields: {},
    enabledFields: {
    hostname: false,
    protocol: false,
    description: false,
    test_name: false,
    drive_type: false,
    drive_model: false,
    }
  });
  const [bulkDeleteState, setBulkDeleteState] = useState<BulkDeleteState>({
    isOpen: false,
  });
  const [historyEditState, setHistoryEditState] = useState<HistoryEditState>({
    isOpen: false,
    group: null,
    fields: {},
    enabledFields: {
      hostname: false,
      protocol: false,
      description: false,
      test_name: false,
      drive_type: false,
      drive_model: false,
    }
  });
  const [historyDeleteState, setHistoryDeleteState] = useState<HistoryDeleteState>({
    isOpen: false,
    group: null,
  });
  const [bulkImportState, setBulkImportState] = useState<BulkImportState>({
    isOpen: false,
    overwrite: false,
    dryRun: false,
    loading: false,
  });
  const [bulkDeleteAllHistoryState, setBulkDeleteAllHistoryState] = useState<BulkDeleteAllHistoryState>({
    isOpen: false,
  });
  const {
    testRuns,
    loading,
    error,
    filters,
    activeFilters,
    setActiveFilters,
    clearFilters,
    refetch,
  } = useServerSideTestRuns({
    autoFetch: view === 'latest' // Only auto-fetch when in latest view
  });

  // Combined loading state
  const isLoading = loading || (view === 'history' && timeSeriesLoading);

  // Split latest vs historical early for easy memoisation
  const latestRuns = useMemo(() => testRuns.filter(r => r.is_latest === 1), [testRuns]);
  
  // Add state for historical hostnames
  const [historyHostnames, setHistoryHostnames] = useState<string[]>([]);

  // Fetch historical hostnames when switching to history view
  useEffect(() => {
    if (view === 'history') {
      fetchTimeSeriesServers().then(res => {
        if (res && res.data) {
          setHistoryHostnames(res.data.map((s: any) => s.hostname));
        }
      });
    }
  }, [view]);

  // When switching to History, set host filter to none
  useEffect(() => {
    if (view === 'history') {
      setActiveFilters({ 
        hostnames: [''], 
        protocols: [], 
        drive_types: [], 
        drive_models: [], 
        patterns: [],
        block_sizes: [], 
        queue_depths: [], 
        host_disk_combinations: [],
        syncs: [], 
        directs: [], 
        num_jobs: [], 
        test_sizes: [],
        durations: [] 
      });
    }
  }, [view, setActiveFilters]);

  // Fetch time-series data for history view - use regular API call for admin purposes
  const fetchTimeSeriesData = useCallback(async () => {
    if (view === 'history' && activeFilters.hostnames[0]) {
      setTimeSeriesLoading(true);
      try {
        const filterOptions: import('../services/api/timeSeries').TimeSeriesHistoryOptions = { 
          days: 30,
          limit: 10000 // Sufficient for admin operations - no need for complete dataset
        };
        filterOptions.hostname = activeFilters.hostnames[0];
        if (activeFilters.protocols.length > 0) filterOptions.protocol = activeFilters.protocols[0];
        if (activeFilters.drive_types.length > 0) filterOptions.driveType = activeFilters.drive_types[0];
        if (activeFilters.drive_models.length > 0) filterOptions.driveModel = activeFilters.drive_models[0];
        if (activeFilters.patterns.length > 0) filterOptions.readWritePattern = activeFilters.patterns[0];
        if (activeFilters.block_sizes.length > 0) filterOptions.blockSize = String(activeFilters.block_sizes[0]);
        if (activeFilters.queue_depths.length > 0) filterOptions.queueDepth = activeFilters.queue_depths[0];
        if (activeFilters.syncs.length > 0) filterOptions.sync = activeFilters.syncs[0];
        if (activeFilters.directs.length > 0) filterOptions.direct = activeFilters.directs[0];
        if (activeFilters.num_jobs.length > 0) filterOptions.numJobs = activeFilters.num_jobs[0];
        if (activeFilters.durations.length > 0) filterOptions.duration = activeFilters.durations[0];
        
        const response = await fetchTimeSeriesHistory(filterOptions);
        if (response.error) {
          console.error('Error fetching time-series data:', response.error);
          setTimeSeriesData([]);
        } else {
          // Handle both old array format and new paginated format for compatibility
          let responseData = [];
          if (response.data) {
            if (response.data.data && Array.isArray(response.data.data)) {
              // New paginated format
              responseData = response.data.data;
            } else if (Array.isArray(response.data)) {
              // Old array format
              responseData = response.data;
            }
          }
          setTimeSeriesData(responseData);
        }
      } catch (error) {
        console.error('Error fetching time-series data:', error);
        setTimeSeriesData([]);
      } finally {
        setTimeSeriesLoading(false);
      }
    } else if (view === 'history') {
      setTimeSeriesData([]);
    }
  }, [view, activeFilters]);

  // Fetch data when view changes
  useEffect(() => {
    if (view === 'history') {
      fetchTimeSeriesData();
    } else if (view === 'latest') {
      refetch(); // Manually refetch test runs when switching to latest view
    }
  }, [fetchTimeSeriesData, refetch, view]);

  // Use time-series data for history view, regular test runs for latest view
  const historicalRuns = useMemo(() => {
    if (view === 'history') {
      // Transform time-series data to match TestRun structure for grouping
      return timeSeriesData.map((ts: any) => ({
        ...ts,
        is_latest: 0, // Mark as historical
        id: ts.test_run_id,
        test_run_id: ts.test_run_id,
      }));
    } else {
      return testRuns.filter(r => r.is_latest === 0);
    }
  }, [view, timeSeriesData, testRuns]);

  // Group historical runs by hardware / test config key
  const groupedHistory = useMemo(() => {
    if (view !== 'history') return [];
    const map: Record<string, { key: string; count: number; first: TestRun; last: TestRun; runs: TestRun[] }> = {};
    historicalRuns.forEach(r => {
      const k = groupKey(r);
      const existing = map[k];
      if (!existing) {
        map[k] = { key: k, count: 1, first: r, last: r, runs: [r] };
      } else {
        existing.count += 1;
        existing.runs.push(r);
        // track oldest / newest timestamps
        if (new Date(r.timestamp) < new Date(existing.first.timestamp)) existing.first = r;
        if (new Date(r.timestamp) > new Date(existing.last.timestamp)) existing.last = r;
      }
    });
    return Object.values(map).filter(g => g.count >= 2).sort((a, b) => b.count - a.count);
  }, [historicalRuns, view]);

  // Sort latest runs
  const sortedLatestRuns = useMemo(() => {
    return [...latestRuns].sort((a, b) => {
    const aVal = a[latestSortField];
    const bVal = b[latestSortField];
    
    if (aVal === undefined || aVal === null) return 1;
    if (bVal === undefined || bVal === null) return -1;
    
    let comparison = 0;
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      comparison = aVal.localeCompare(bVal);
    } else if (typeof aVal === 'number' && typeof bVal === 'number') {
      comparison = aVal - bVal;
    } else {
      comparison = String(aVal).localeCompare(String(bVal));
    }
    
    return latestSortDirection === 'desc' ? -comparison : comparison;
    });
  }, [latestRuns, latestSortField, latestSortDirection]);

  const handleLatestSort = (field: keyof TestRun) => {
    if (latestSortField === field) {
      setLatestSortDirection(latestSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setLatestSortField(field);
      setLatestSortDirection('asc');
    }
  };

  const LatestSortIcon = ({ field }: { field: keyof TestRun }) => {
    if (latestSortField !== field) return null;
    return latestSortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />;
  };

  // Helper function to find the most common value in an array
  const getMostCommonValue = (values: (string | undefined)[]): string => {
    const nonEmptyValues = values.filter((v): v is string => v !== undefined && v !== null && v.trim() !== '');
    if (nonEmptyValues.length === 0) return '';
    
    const counts: Record<string, number> = {};
    nonEmptyValues.forEach(value => {
      counts[value] = (counts[value] || 0) + 1;
    });
    
    const entries = Object.entries(counts);
    if (entries.length === 0) return '';
    
    const mostCommon = entries.reduce((a, b) => counts[a[0]] > counts[b[0]] ? a : b);
    return mostCommon[0];
  };

  // Get most common values from selected test runs
  const getCommonValuesFromSelection = (): EditableFields => {
    const selectedTestRuns = view === 'latest' 
      ? sortedLatestRuns.filter(run => selectedLatestRuns.has(run.id))
      : timeSeriesData.filter(run => selectedHistoryRuns.has(run.id));
    
    return {
      hostname: getMostCommonValue(selectedTestRuns.map(run => run.hostname)),
      protocol: getMostCommonValue(selectedTestRuns.map(run => run.protocol)),
      description: getMostCommonValue(selectedTestRuns.map(run => run.description)),
      test_name: getMostCommonValue(selectedTestRuns.map(run => run.test_name)),
      drive_type: getMostCommonValue(selectedTestRuns.map(run => run.drive_type)),
      drive_model: getMostCommonValue(selectedTestRuns.map(run => run.drive_model)),
    };
  };

  const handleSelectAll = () => {
    if (view === 'latest') {
      if (selectedLatestRuns.size === sortedLatestRuns.length) {
        setSelectedLatestRuns(new Set());
    } else {
        setSelectedLatestRuns(new Set(sortedLatestRuns.map(run => run.id)));
      }
    } else {
      if (selectedHistoryRuns.size === timeSeriesData.length) {
        setSelectedHistoryRuns(new Set());
      } else {
        setSelectedHistoryRuns(new Set(timeSeriesData.map(run => run.id)));
      }
    }
  };

  const handleSelectRun = (runId: number) => {
    if (view === 'latest') {
      const newSelected = new Set(selectedLatestRuns);
    if (newSelected.has(runId)) {
      newSelected.delete(runId);
    } else {
      newSelected.add(runId);
    }
      setSelectedLatestRuns(newSelected);
    } else {
      const newSelected = new Set(selectedHistoryRuns);
      if (newSelected.has(runId)) {
        newSelected.delete(runId);
      } else {
        newSelected.add(runId);
      }
      setSelectedHistoryRuns(newSelected);
    }
  };

  const openBulkEditModal = () => {
    const commonValues = getCommonValuesFromSelection();
    setBulkEditState({
      isOpen: true,
      fields: commonValues,
      enabledFields: {
        hostname: false,
        protocol: false,
        description: false,
        test_name: false,
        drive_type: false,
        drive_model: false,
      }
    });
  };

  const closeBulkEditModal = () => {
    setBulkEditState(prev => ({ ...prev, isOpen: false }));
  };

  const updateBulkEditField = (field: keyof EditableFields, value: string) => {
    setBulkEditState(prev => ({
      ...prev,
      fields: { ...prev.fields, [field]: value }
    }));
  };

  const toggleFieldEnabled = (field: keyof EditableFields) => {
    setBulkEditState(prev => ({
      ...prev,
      enabledFields: { ...prev.enabledFields, [field]: !prev.enabledFields[field] }
    }));
  };

  const handleBulkEdit = async () => {
    const selectedCount = view === 'latest' ? selectedLatestRuns.size : selectedHistoryRuns.size;
    if (selectedCount === 0) return;
    
    // Only include fields that are enabled for update
    const fieldsToUpdate: EditableFields = {};
    Object.entries(bulkEditState.enabledFields).forEach(([field, enabled]) => {
      if (enabled && bulkEditState.fields[field as keyof EditableFields] !== undefined) {
        fieldsToUpdate[field as keyof EditableFields] = bulkEditState.fields[field as keyof EditableFields];
      }
    });
    
    // Guard against empty updates
    if (Object.keys(fieldsToUpdate).length === 0) {
      alert('Please enable at least one field and provide a value to update.');
      return;
    }

    try {
      // Use the appropriate bulk update function based on the current view
      const selectedIds = view === 'latest' ? Array.from(selectedLatestRuns) : Array.from(selectedHistoryRuns);
      const result = view === 'history' 
        ? await bulkUpdateTimeSeries(selectedIds, fieldsToUpdate)
        : await bulkUpdateTestRuns(selectedIds, fieldsToUpdate);
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      // Refresh the data after successful update
      if (view === 'history') {
        await fetchTimeSeriesData();
      } else {
      await refetch();
      }
      
      closeBulkEditModal();
      if (view === 'latest') {
        setSelectedLatestRuns(new Set());
      } else {
        setSelectedHistoryRuns(new Set());
      }
    } catch (err) {
      console.error('Failed to bulk update test runs:', err);
      alert(err instanceof Error ? err.message : 'Bulk update failed');
    }
  };

  const openBulkDeleteModal = () => {
    setBulkDeleteState({ isOpen: true });
  };

  const closeBulkDeleteModal = () => {
    setBulkDeleteState({ isOpen: false });
  };

  const handleBulkDelete = async () => {
    const selectedCount = view === 'latest' ? selectedLatestRuns.size : selectedHistoryRuns.size;
    if (selectedCount === 0) return;
    
    try {
      const selectedIds = view === 'latest' ? Array.from(selectedLatestRuns) : Array.from(selectedHistoryRuns);
      const result = await deleteTestRuns(selectedIds);
      
      if (result.failed > 0) {
        console.warn(`Successfully deleted ${result.successful} test runs, but failed to delete ${result.failed} runs.`);
      }
      
      // Refresh the data after successful deletion
      if (view === 'history') {
        await fetchTimeSeriesData();
      } else {
      await refetch();
      }
      
      closeBulkDeleteModal();
      if (view === 'latest') {
        setSelectedLatestRuns(new Set());
      } else {
        setSelectedHistoryRuns(new Set());
      }
    } catch (err) {
      console.error('Failed to bulk delete test runs:', err);
      alert(err instanceof Error ? err.message : 'Bulk delete failed');
    }
  };

  // History edit functions
  const openHistoryEditModal = (group: any) => {
    // Get most common values from the group's runs
    const commonValues = {
      hostname: getMostCommonValue(group.runs.map((run: TestRun) => run.hostname)),
      protocol: getMostCommonValue(group.runs.map((run: TestRun) => run.protocol)),
      description: getMostCommonValue(group.runs.map((run: TestRun) => run.description)),
      test_name: getMostCommonValue(group.runs.map((run: TestRun) => run.test_name)),
      drive_type: getMostCommonValue(group.runs.map((run: TestRun) => run.drive_type)),
      drive_model: getMostCommonValue(group.runs.map((run: TestRun) => run.drive_model)),
    };
    
    setHistoryEditState({
      isOpen: true,
      group,
      fields: commonValues,
      enabledFields: {
        hostname: false,
        protocol: false,
        description: false,
        test_name: false,
        drive_type: false,
        drive_model: false,
      }
    });
  };

  const closeHistoryEditModal = () => {
    setHistoryEditState(prev => ({ ...prev, isOpen: false }));
  };

  const updateHistoryEditField = (field: keyof EditableFields, value: string) => {
    setHistoryEditState(prev => ({
      ...prev,
      fields: { ...prev.fields, [field]: value }
    }));
  };

  const toggleHistoryFieldEnabled = (field: keyof EditableFields) => {
    setHistoryEditState(prev => ({
      ...prev,
      enabledFields: { ...prev.enabledFields, [field]: !prev.enabledFields[field] }
    }));
  };

  const handleHistoryEdit = async () => {
    if (!historyEditState.group) return;
    
    // Only include fields that are enabled for update
    const fieldsToUpdate: EditableFields = {};
    Object.entries(historyEditState.enabledFields).forEach(([field, enabled]) => {
      if (enabled && historyEditState.fields[field as keyof EditableFields] !== undefined) {
        fieldsToUpdate[field as keyof EditableFields] = historyEditState.fields[field as keyof EditableFields];
      }
    });
    
    // Guard against empty updates
    if (Object.keys(fieldsToUpdate).length === 0) {
      alert('Please enable at least one field and provide a value to update.');
      return;
    }

    try {
      // Update all runs in the history group
      const testRunIds = historyEditState.group.runs.map((run: TestRun) => run.id);
      const result = await bulkUpdateTimeSeries(testRunIds, fieldsToUpdate);
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      // Refresh the data after successful update
      await fetchTimeSeriesData();
      
      closeHistoryEditModal();
    } catch (err) {
      console.error('Failed to update history group:', err);
      alert(err instanceof Error ? err.message : 'History update failed');
    }
  };

  // History delete functions
  const openHistoryDeleteModal = (group: any) => {
    setHistoryDeleteState({
      isOpen: true,
      group,
    });
  };

  const closeHistoryDeleteModal = () => {
    setHistoryDeleteState({ isOpen: false, group: null });
  };

  const handleHistoryDelete = async () => {
    if (!historyDeleteState.group) return;

    try {
      // Find the latest run (is_latest = 1) and exclude it from deletion
      const historicalRunsToDelete = historyDeleteState.group.runs.filter((run: TestRun) => run.is_latest === 0);
      
      if (historicalRunsToDelete.length === 0) {
        console.warn('No historical runs to delete. Only the latest run will be kept.');
        closeHistoryDeleteModal();
        return;
      }

      const testRunIds = historicalRunsToDelete.map((run: TestRun) => run.id);
      const result = await deleteTimeSeriesRuns(testRunIds);
      
      if (result.data && result.data.notFound && result.data.notFound > 0) {
        console.warn(`Deleted ${result.data.deleted} historical runs, but ${result.data.notFound} were not found.`);
      }
      
      // Refresh the data after successful deletion
      await fetchTimeSeriesData();
      
      closeHistoryDeleteModal();
    } catch (err) {
      console.error('Failed to delete history group:', err);
      alert(err instanceof Error ? err.message : 'History deletion failed');
    }
  };

  const openBulkImportModal = () => {
    setBulkImportState(prev => ({ ...prev, isOpen: true }));
  };

  const closeBulkImportModal = () => {
    setBulkImportState(prev => ({ ...prev, isOpen: false }));
  };

  const handleBulkImport = async () => {
    setBulkImportState(prev => ({ ...prev, loading: true }));

    try {
      const result = await bulkImportFioData({
        overwrite: bulkImportState.overwrite,
        dryRun: bulkImportState.dryRun,
      });

      // Refresh data if not dry run
      if (!bulkImportState.dryRun) {
        refetch();
      }

      // Close modal
      closeBulkImportModal();

      // Show success message
      alert(result.message);

    } catch (err) {
      console.error('Bulk import failed:', err);
      alert(err instanceof Error ? err.message : 'Bulk import failed');
    } finally {
      setBulkImportState(prev => ({ ...prev, loading: false }));
    }
  };

  const openBulkDeleteAllHistoryModal = () => {
    setBulkDeleteAllHistoryState({ isOpen: true });
  };

  const closeBulkDeleteAllHistoryModal = () => {
    setBulkDeleteAllHistoryState({ isOpen: false });
  };

  const handleBulkDeleteAllHistory = async () => {
    if (groupedHistory.length === 0) return;

    try {
      // Collect all historical run IDs from all groups
      const allHistoricalRunIds: number[] = [];
      groupedHistory.forEach(group => {
        group.runs.forEach(run => {
          allHistoricalRunIds.push(run.id);
        });
      });

      if (allHistoricalRunIds.length === 0) {
        console.warn('No historical runs to delete.');
        closeBulkDeleteAllHistoryModal();
        return;
      }

      const result = await deleteTimeSeriesRuns(allHistoricalRunIds);
      
      if (result.data && result.data.notFound && result.data.notFound > 0) {
        console.warn(`Deleted ${result.data.deleted} historical runs, but ${result.data.notFound} were not found.`);
      }
      
      // Refresh the data after successful deletion
      await fetchTimeSeriesData();
      
      closeBulkDeleteAllHistoryModal();
    } catch (err) {
      console.error('Failed to bulk delete all history:', err);
      alert(err instanceof Error ? err.message : 'Bulk delete all history failed');
    }
  };

  /* ----- rendering helpers ----- */
  const renderFilters = () => {
    if (!filters) return null;
    const hostOptions = view === 'history' ? historyHostnames : filters.hostnames;
    return (
      <div className="theme-card p-4 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-4 w-4 theme-text-accent" />
          <h3 className="text-sm font-medium theme-text-primary">Filter Options</h3>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium theme-text-secondary whitespace-nowrap">Host:</label>
            <select
              value={activeFilters.hostnames[0] || ''}
              onChange={e => setActiveFilters({ ...activeFilters, hostnames: e.target.value ? [e.target.value] : [''] })}
              className="theme-form-select text-sm px-3 py-1.5 min-w-32"
            >
              <option value="">None</option>
              {hostOptions.map(h => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium theme-text-secondary whitespace-nowrap">Protocol:</label>
            <select
              value={activeFilters.protocols[0] || ''}
              onChange={e => setActiveFilters({ ...activeFilters, protocols: e.target.value ? [e.target.value] : [] })}
              className="theme-form-select text-sm px-3 py-1.5 min-w-32"
            >
              <option value="">All Protocols</option>
              {filters.protocols.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium theme-text-secondary whitespace-nowrap">Drive Type:</label>
            <select
              value={activeFilters.drive_types[0] || ''}
              onChange={e => setActiveFilters({ ...activeFilters, drive_types: e.target.value ? [e.target.value] : [] })}
              className="theme-form-select text-sm px-3 py-1.5 min-w-32"
            >
              <option value="">All Drive Types</option>
              {filters.drive_types.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          {(activeFilters.hostnames.length + activeFilters.protocols.length + activeFilters.drive_types.length) > 0 && (
            <Button
              onClick={clearFilters}
              variant="secondary"
              className="text-xs"
            >
              Clear Filters
            </Button>
          )}
        </div>
      </div>
    );
  };

  const renderLatestTable = () => (
    <div className="theme-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="theme-bg-secondary">
            <tr>
              <th className="px-4 py-3 text-left">
                  <input
                  type="checkbox"
                  checked={selectedLatestRuns.size === sortedLatestRuns.length && sortedLatestRuns.length > 0}
                  onChange={handleSelectAll}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider cursor-pointer hover:theme-text-primary transition-colors"
                onClick={() => handleLatestSort('id')}
              >
                <div className="flex items-center gap-1">
                  ID
                  <LatestSortIcon field="id" />
                </div>
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider cursor-pointer hover:theme-text-primary transition-colors"
                onClick={() => handleLatestSort('timestamp')}
              >
                <div className="flex items-center gap-1">
                  Timestamp
                  <LatestSortIcon field="timestamp" />
              </div>
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider cursor-pointer hover:theme-text-primary transition-colors"
                onClick={() => handleLatestSort('hostname')}
              >
                <div className="flex items-center gap-1">
                  Host
                  <LatestSortIcon field="hostname" />
                </div>
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider cursor-pointer hover:theme-text-primary transition-colors"
                onClick={() => handleLatestSort('protocol')}
              >
                <div className="flex items-center gap-1">
                  Protocol
                  <LatestSortIcon field="protocol" />
                </div>
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider cursor-pointer hover:theme-text-primary transition-colors"
                onClick={() => handleLatestSort('drive_model')}
              >
                <div className="flex items-center gap-1">
                  Model
                  <LatestSortIcon field="drive_model" />
              </div>
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider cursor-pointer hover:theme-text-primary transition-colors"
                onClick={() => handleLatestSort('drive_type')}
              >
                <div className="flex items-center gap-1">
                  Type
                  <LatestSortIcon field="drive_type" />
            </div>
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider cursor-pointer hover:theme-text-primary transition-colors"
                onClick={() => handleLatestSort('read_write_pattern')}
              >
                <div className="flex items-center gap-1">
                  Pattern
                  <LatestSortIcon field="read_write_pattern" />
              </div>
                    </th>
              <th className="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">
                Config
                    </th>
                  </tr>
                </thead>
          <tbody className="theme-bg-card">
            {sortedLatestRuns.map((run, index) => (
              <React.Fragment key={run.id}>
                {/* Main data row */}
                <tr className={index % 2 === 0 ? 'theme-bg-secondary' : 'theme-bg-card'}>
                          <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedLatestRuns.has(run.id)}
                      onChange={() => handleSelectRun(run.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs theme-text-primary">{run.id}</td>
                  <td className="px-4 py-3 text-xs theme-text-secondary">
                    {new Date(run.timestamp).toISOString().slice(0, 19).replace('T', ' ')}
                  </td>
                  <td className="px-4 py-3 text-sm theme-text-primary">{run.hostname}</td>
                  <td className="px-4 py-3 text-sm theme-text-primary">{run.protocol}</td>
                  <td className="px-4 py-3 text-sm theme-text-primary">{run.drive_model}</td>
                  <td className="px-4 py-3 text-sm theme-text-primary">{run.drive_type}</td>
                  <td className="px-4 py-3">
                    {run.read_write_pattern ? (
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        run.read_write_pattern.includes('read') 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                      }`}>
                        {run.read_write_pattern}
                      </span>
                    ) : (
                      <span className="text-sm theme-text-quaternary">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {run.queue_depth && (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          QD{run.queue_depth}
                        </span>
                      )}
                      {run.block_size && (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                          {run.block_size}
                                </span>
                      )}
                      {run.direct !== undefined && (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                          DIR{run.direct}
                                </span>
                      )}
                      {run.sync !== undefined && (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200">
                          SYN{run.sync}
                                </span>
                      )}
                      {run.test_size && (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                          {run.test_size}
                        </span>
                      )}
                      {run.duration && (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          {run.duration}s
                        </span>
                      )}
                            </div>
                          </td>
                        </tr>
                        
                {/* Description row spanning all columns */}
                <tr className={index % 2 === 0 ? 'theme-bg-secondary' : 'theme-bg-card'}>
                  <td colSpan={10} className="px-4 pb-3 pt-1">
                    <div className="space-y-1">
                      <div className="flex items-start gap-2">
                        <span className="text-xs theme-text-quaternary font-medium mt-0.5 whitespace-nowrap">Test Name:</span>
                        <div className="text-xs leading-relaxed break-words theme-text-secondary">
                          {run.test_name || <span className="italic theme-text-quaternary">No test name</span>}
                              </div>
                      </div>
                              <div className="flex items-start gap-2">
                        <span className="text-xs theme-text-quaternary font-medium mt-0.5 whitespace-nowrap">Description:</span>
                        <div className="text-xs leading-relaxed break-words theme-text-secondary">
                          {run.description || <span className="italic theme-text-quaternary">No description</span>}
                                </div>
                              </div>
                    </div>
                          </td>
                        </tr>
                      </React.Fragment>
            ))}
                </tbody>
              </table>
      </div>
    </div>
  );

  const renderHistoryTable = () => (
    <div className="theme-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="theme-bg-secondary">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Configuration</th>
              <th className="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">First Run</th>
              <th className="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Last Run</th>
              <th className="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Count</th>
              <th className="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">rw</th>
              <th className="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Config</th>
              <th className="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
          <tbody className="theme-bg-card">
            {groupedHistory.map((group, index) => (
              <React.Fragment key={group.key}>
                {/* Main group row */}
                <tr className={index % 2 === 0 ? 'theme-bg-secondary' : 'theme-bg-card'}>
                        <td className="px-4 py-3">
                    <div className="max-w-md">
                      <div className="text-sm theme-text-primary font-medium mb-1">
                        {group.first.hostname} • {group.first.protocol}
                          </div>
                      <div className="text-xs theme-text-secondary">
                        {group.first.drive_model} ({group.first.drive_type})
                          </div>
                      <div className="flex gap-1 mt-1">
                        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          {group.first.read_write_pattern}
                        </span>
                        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                          {group.first.block_size}
                        </span>
                        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          QD{group.first.queue_depth}
                        </span>
                              </div>
                            </div>
                        </td>
                  <td className="px-4 py-3 text-xs theme-text-secondary">
                    {new Date(group.first.timestamp).toLocaleDateString()}
                        </td>
                  <td className="px-4 py-3 text-xs theme-text-secondary">
                    {new Date(group.last.timestamp).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                    <span className="inline-flex items-center px-3 py-1 text-sm font-medium rounded-md bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                      {group.count} runs
                    </span>
                        </td>
                        <td className="px-4 py-3">
                    {group.first.read_write_pattern ? (
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        group.first.read_write_pattern.includes('read') 
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                            }`}>
                        {group.first.read_write_pattern}
                            </span>
                          ) : (
                      <span className="text-sm theme-text-quaternary">-</span>
                          )}
                        </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {group.first.queue_depth && (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          QD{group.first.queue_depth}
                          </span>
                      )}
                      {group.first.block_size && (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                          {group.first.block_size}
                          </span>
                      )}
                      {group.first.direct !== undefined && (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                          DIR{group.first.direct}
                          </span>
                      )}
                      {group.first.sync !== undefined && (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200">
                          SYN{group.first.sync}
                        </span>
                      )}
                      {group.first.test_size && (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                          {group.first.test_size}
                        </span>
                      )}
                      {group.first.duration && (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          {group.first.duration}s
                        </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button 
                        onClick={() => openHistoryEditModal(group)} 
                        size="sm" 
                        variant="outline"
                        title="Edit all historical runs in this group"
                      >
                        Edit
                              </Button>
                      <Button 
                        onClick={() => openHistoryDeleteModal(group)} 
                        size="sm" 
                        variant="danger"
                        title="Delete all historical runs, keeping only the latest"
                      >
                        Delete History
                              </Button>
                            </div>
                        </td>
                        </tr>
                        
                        {/* Description row spanning all columns */}
                <tr className={index % 2 === 0 ? 'theme-bg-secondary' : 'theme-bg-card'}>
                  <td colSpan={12} className="px-4 pb-3 pt-1">
                              <div className="space-y-1">
                                <div className="flex items-start gap-2">
                        <span className="text-xs theme-text-quaternary font-medium mt-0.5 whitespace-nowrap">Test Name:</span>
                        <div className="text-xs leading-relaxed break-words theme-text-secondary">
                          {group.first.test_name || <span className="italic theme-text-quaternary">No test name</span>}
                                  </div>
                                </div>
                                <div className="flex items-start gap-2">
                        <span className="text-xs theme-text-quaternary font-medium mt-0.5 whitespace-nowrap">Description:</span>
                        <div className="text-xs leading-relaxed break-words theme-text-secondary">
                          {group.first.description || <span className="italic theme-text-quaternary">No description</span>}
                                  </div>
                                </div>
                              </div>
                          </td>
                        </tr>
                      </React.Fragment>
            ))}
                </tbody>
              </table>
          </div>
    </div>
  );

  /* ----- main render ----- */
  if (isLoading) return <Loading className="min-h-screen" />;
  if (error) return <ErrorDisplay error={error} onRetry={() => window.location.reload()} />;

  return (
    <div className="min-h-screen theme-bg-secondary">
      {/* Header */}
      <header className="theme-header shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Button
                onClick={() => navigate('/')}
                variant="ghost"
                size="sm"
                className="mr-4 flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
              <Settings className="h-8 w-8 theme-text-accent mr-3" />
              <h1 className="text-2xl font-bold theme-text-primary">
                Test Run Administration
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center text-sm theme-text-secondary">
                <Database className="h-4 w-4 mr-1" />
                FIO Benchmark Analysis
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* View Toggle */}
        <div className="mb-6">
          <div className="flex gap-2">
            <Button 
              onClick={() => setView('latest')} 
              variant={view === 'latest' ? 'primary' : 'secondary'}
              className="flex items-center gap-2"
            >
              <BarChart3 className="h-4 w-4" />
              Latest Runs ({latestRuns.length})
            </Button>
            <Button 
              onClick={() => setView('history')} 
              variant={view === 'history' ? 'primary' : 'secondary'}
              className="flex items-center gap-2"
            >
              <History className="h-4 w-4" />
              History ({groupedHistory.length})
            </Button>
            <Button 
              onClick={openBulkImportModal}
              variant="secondary"
              className="flex items-center gap-2 ml-auto"
            >
              <Upload className="h-4 w-4" />
              Bulk Import
            </Button>
          </div>
        </div>

        {/* Bulk Edit Controls */}
        {view === 'latest' && selectedLatestRuns.size > 0 && (
          <div className="mb-4 p-4 theme-card">
              <div className="flex items-center justify-between">
              <span className="text-sm theme-text-secondary">
                {selectedLatestRuns.size} test run{selectedLatestRuns.size !== 1 ? 's' : ''} selected
                </span>
                <div className="flex gap-2">
                  <Button
                  onClick={openBulkEditModal}
                  variant="primary"
                    size="sm"
                  className="flex items-center gap-2"
                  >
                  <Edit2 className="h-4 w-4" />
                  Bulk Edit
                  </Button>
                  <Button
                  onClick={openBulkDeleteModal}
                  variant="danger"
                    size="sm"
                  className="flex items-center gap-2"
                  >
                  <Trash2 className="h-4 w-4" />
                  Bulk Delete
                  </Button>
                </div>
              </div>
            </div>
          )}

        {/* Filters */}
        {renderFilters()}

        {/* Results */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold theme-text-primary">
              {view === 'latest' ? 'Latest Test Runs' : 'Historical Data Groups'}
            </h2>
            <div className="flex items-center gap-4">
              <div className="text-sm theme-text-secondary">
                {view === 'latest' 
                  ? `Showing ${latestRuns.length} latest runs`
                  : `Showing ${groupedHistory.length} configuration groups`
                }
              </div>
              {view === 'history' && groupedHistory.length > 0 && (
                <Button
                  onClick={openBulkDeleteAllHistoryModal}
                  variant="danger"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Bulk Delete All History
                </Button>
              )}
            </div>
          </div>
          {view === 'latest' ? renderLatestTable() : renderHistoryTable()}
        </div>
      </main>

        {/* Bulk Edit Modal */}
        <Modal
        isOpen={bulkEditState.isOpen}
        onClose={closeBulkEditModal}
          title="Bulk Edit Test Runs"
          size="md"
        >
          <div className="space-y-4">
          <p className="text-sm theme-text-secondary">
            Update {view === 'latest' ? selectedLatestRuns.size : selectedHistoryRuns.size} selected test runs. Check the fields you want to update with the common values.
            </p>
            
            <div className="space-y-3">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    id="hostname-enabled"
                  checked={bulkEditState.enabledFields.hostname}
                  onChange={() => toggleFieldEnabled('hostname')}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                <label htmlFor="hostname-enabled" className="text-sm font-medium theme-text-primary">
                    Update Hostname
                  </label>
                </div>
              <input
                type="text"
                value={bulkEditState.fields.hostname || ''}
                onChange={(e) => updateBulkEditField('hostname', e.target.value)}
                  placeholder="Common hostname value"
                disabled={!bulkEditState.enabledFields.hostname}
                className={`w-full px-3 py-2 text-sm border rounded-md theme-form-input ${!bulkEditState.enabledFields.hostname ? 'opacity-50' : ''}`}
                />
              </div>
              
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    id="protocol-enabled"
                  checked={bulkEditState.enabledFields.protocol}
                  onChange={() => toggleFieldEnabled('protocol')}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                <label htmlFor="protocol-enabled" className="text-sm font-medium theme-text-primary">
                    Update Protocol
                  </label>
                </div>
              <input
                type="text"
                value={bulkEditState.fields.protocol || ''}
                onChange={(e) => updateBulkEditField('protocol', e.target.value)}
                  placeholder="Common protocol value"
                disabled={!bulkEditState.enabledFields.protocol}
                className={`w-full px-3 py-2 text-sm border rounded-md theme-form-input ${!bulkEditState.enabledFields.protocol ? 'opacity-50' : ''}`}
                />
              </div>
              
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    id="description-enabled"
                  checked={bulkEditState.enabledFields.description}
                  onChange={() => toggleFieldEnabled('description')}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                <label htmlFor="description-enabled" className="text-sm font-medium theme-text-primary">
                    Update Description
                  </label>
                </div>
              <input
                type="text"
                value={bulkEditState.fields.description || ''}
                onChange={(e) => updateBulkEditField('description', e.target.value)}
                  placeholder="Common description value"
                disabled={!bulkEditState.enabledFields.description}
                className={`w-full px-3 py-2 text-sm border rounded-md theme-form-input ${!bulkEditState.enabledFields.description ? 'opacity-50' : ''}`}
                />
              </div>
              
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    id="test_name-enabled"
                  checked={bulkEditState.enabledFields.test_name}
                  onChange={() => toggleFieldEnabled('test_name')}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                <label htmlFor="test_name-enabled" className="text-sm font-medium theme-text-primary">
                    Update Test Name
                  </label>
                </div>
              <input
                type="text"
                value={bulkEditState.fields.test_name || ''}
                onChange={(e) => updateBulkEditField('test_name', e.target.value)}
                  placeholder="Common test name value"
                disabled={!bulkEditState.enabledFields.test_name}
                className={`w-full px-3 py-2 text-sm border rounded-md theme-form-input ${!bulkEditState.enabledFields.test_name ? 'opacity-50' : ''}`}
                />
              </div>
              
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    id="drive_type-enabled"
                  checked={bulkEditState.enabledFields.drive_type}
                  onChange={() => toggleFieldEnabled('drive_type')}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                <label htmlFor="drive_type-enabled" className="text-sm font-medium theme-text-primary">
                    Update Drive Type
                  </label>
                </div>
              <input
                type="text"
                value={bulkEditState.fields.drive_type || ''}
                onChange={(e) => updateBulkEditField('drive_type', e.target.value)}
                  placeholder="Common drive type value"
                disabled={!bulkEditState.enabledFields.drive_type}
                className={`w-full px-3 py-2 text-sm border rounded-md theme-form-input ${!bulkEditState.enabledFields.drive_type ? 'opacity-50' : ''}`}
                />
              </div>
              
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    id="drive_model-enabled"
                  checked={bulkEditState.enabledFields.drive_model}
                  onChange={() => toggleFieldEnabled('drive_model')}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                <label htmlFor="drive_model-enabled" className="text-sm font-medium theme-text-primary">
                    Update Drive Model
                  </label>
                </div>
              <input
                type="text"
                value={bulkEditState.fields.drive_model || ''}
                onChange={(e) => updateBulkEditField('drive_model', e.target.value)}
                  placeholder="Common drive model value"
                disabled={!bulkEditState.enabledFields.drive_model}
                className={`w-full px-3 py-2 text-sm border rounded-md theme-form-input ${!bulkEditState.enabledFields.drive_model ? 'opacity-50' : ''}`}
                />
              </div>
            </div>
            
            <div className="flex gap-3 pt-4">
              <Button onClick={handleBulkEdit} className="flex-1">
              Update {view === 'latest' ? selectedLatestRuns.size : selectedHistoryRuns.size} Runs
              </Button>
              <Button 
              onClick={closeBulkEditModal} 
                variant="secondary"
              >
                Cancel
              </Button>
            </div>
          </div>
        </Modal>

        {/* Bulk Delete Confirmation Modal */}
        <Modal
        isOpen={bulkDeleteState.isOpen}
        onClose={closeBulkDeleteModal}
          title="Confirm Bulk Delete"
          size="md"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 dark:bg-red-900 rounded-full">
              <Trash2 className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            
            <div className="text-center">
            <h3 className="text-lg font-medium theme-text-primary mb-2">
              Delete {view === 'latest' ? selectedLatestRuns.size : selectedHistoryRuns.size} Test Runs
              </h3>
            <p className="text-sm theme-text-secondary">
              Are you sure you want to delete these {view === 'latest' ? selectedLatestRuns.size : selectedHistoryRuns.size} test runs? This action cannot be undone.
                All associated performance metrics and data will be permanently removed.
              </p>
            </div>
            
            <div className="flex gap-3 pt-4">
              <Button 
                onClick={handleBulkDelete} 
                variant="danger"
                className="flex-1"
              >
                <Trash2 className="h-4 w-4 mr-2" />
              Delete {view === 'latest' ? selectedLatestRuns.size : selectedHistoryRuns.size} Runs
              </Button>
              <Button 
              onClick={closeBulkDeleteModal} 
                variant="secondary"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </Modal>

      {/* History Edit Modal */}
      <Modal
        isOpen={historyEditState.isOpen}
        onClose={closeHistoryEditModal}
        title="Edit History Line"
        size="lg"
      >
        <div className="space-y-4">
          {historyEditState.group && (
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                Editing {historyEditState.group.count} Historical Runs
              </h4>
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <p><strong>Configuration:</strong> {historyEditState.group.first.hostname} • {historyEditState.group.first.protocol}</p>
                <p><strong>Drive:</strong> {historyEditState.group.first.drive_model} ({historyEditState.group.first.drive_type})</p>
                <p><strong>Test Pattern:</strong> {historyEditState.group.first.read_write_pattern} • Block Size: {historyEditState.group.first.block_size} • Queue Depth: {historyEditState.group.first.queue_depth}</p>
                <p><strong>Date Range:</strong> {new Date(historyEditState.group.first.timestamp).toISOString().split('T')[0]} to {new Date(historyEditState.group.last.timestamp).toISOString().split('T')[0]}</p>
      </div>
            </div>
          )}
          
          <p className="text-sm theme-text-secondary">
            Update all {historyEditState.group?.count || 0} historical test runs in this group. Check the fields you want to update with the common values.
          </p>
          
          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  id="history-hostname-enabled"
                  checked={historyEditState.enabledFields.hostname}
                  onChange={() => toggleHistoryFieldEnabled('hostname')}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="history-hostname-enabled" className="text-sm font-medium theme-text-primary">
                  Update Hostname
                </label>
              </div>
              <input
                type="text"
                value={historyEditState.fields.hostname || ''}
                onChange={(e) => updateHistoryEditField('hostname', e.target.value)}
                placeholder="Common hostname value"
                disabled={!historyEditState.enabledFields.hostname}
                className={`w-full px-3 py-2 text-sm border rounded-md theme-form-input ${!historyEditState.enabledFields.hostname ? 'opacity-50' : ''}`}
              />
            </div>
            
            <div>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  id="history-protocol-enabled"
                  checked={historyEditState.enabledFields.protocol}
                  onChange={() => toggleHistoryFieldEnabled('protocol')}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="history-protocol-enabled" className="text-sm font-medium theme-text-primary">
                  Update Protocol
                </label>
              </div>
              <input
                type="text"
                value={historyEditState.fields.protocol || ''}
                onChange={(e) => updateHistoryEditField('protocol', e.target.value)}
                placeholder="Common protocol value"
                disabled={!historyEditState.enabledFields.protocol}
                className={`w-full px-3 py-2 text-sm border rounded-md theme-form-input ${!historyEditState.enabledFields.protocol ? 'opacity-50' : ''}`}
              />
            </div>
            
            <div>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  id="history-description-enabled"
                  checked={historyEditState.enabledFields.description}
                  onChange={() => toggleHistoryFieldEnabled('description')}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="history-description-enabled" className="text-sm font-medium theme-text-primary">
                  Update Description
                </label>
              </div>
              <input
                type="text"
                value={historyEditState.fields.description || ''}
                onChange={(e) => updateHistoryEditField('description', e.target.value)}
                placeholder="Common description value"
                disabled={!historyEditState.enabledFields.description}
                className={`w-full px-3 py-2 text-sm border rounded-md theme-form-input ${!historyEditState.enabledFields.description ? 'opacity-50' : ''}`}
              />
            </div>
            
            <div>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  id="history-test_name-enabled"
                  checked={historyEditState.enabledFields.test_name}
                  onChange={() => toggleHistoryFieldEnabled('test_name')}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="history-test_name-enabled" className="text-sm font-medium theme-text-primary">
                  Update Test Name
                </label>
              </div>
              <input
                type="text"
                value={historyEditState.fields.test_name || ''}
                onChange={(e) => updateHistoryEditField('test_name', e.target.value)}
                placeholder="Common test name value"
                disabled={!historyEditState.enabledFields.test_name}
                className={`w-full px-3 py-2 text-sm border rounded-md theme-form-input ${!historyEditState.enabledFields.test_name ? 'opacity-50' : ''}`}
              />
            </div>
            
            <div>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  id="history-drive_type-enabled"
                  checked={historyEditState.enabledFields.drive_type}
                  onChange={() => toggleHistoryFieldEnabled('drive_type')}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="history-drive_type-enabled" className="text-sm font-medium theme-text-primary">
                  Update Drive Type
                </label>
              </div>
              <input
                type="text"
                value={historyEditState.fields.drive_type || ''}
                onChange={(e) => updateHistoryEditField('drive_type', e.target.value)}
                placeholder="Common drive type value"
                disabled={!historyEditState.enabledFields.drive_type}
                className={`w-full px-3 py-2 text-sm border rounded-md theme-form-input ${!historyEditState.enabledFields.drive_type ? 'opacity-50' : ''}`}
              />
            </div>
            
            <div>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  id="history-drive_model-enabled"
                  checked={historyEditState.enabledFields.drive_model}
                  onChange={() => toggleHistoryFieldEnabled('drive_model')}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="history-drive_model-enabled" className="text-sm font-medium theme-text-primary">
                  Update Drive Model
                </label>
              </div>
              <input
                type="text"
                value={historyEditState.fields.drive_model || ''}
                onChange={(e) => updateHistoryEditField('drive_model', e.target.value)}
                placeholder="Common drive model value"
                disabled={!historyEditState.enabledFields.drive_model}
                className={`w-full px-3 py-2 text-sm border rounded-md theme-form-input ${!historyEditState.enabledFields.drive_model ? 'opacity-50' : ''}`}
              />
            </div>
          </div>
          
          <div className="flex gap-3 pt-4">
            <Button onClick={handleHistoryEdit} className="flex-1">
              Update {historyEditState.group?.count || 0} Historical Runs
            </Button>
            <Button 
              onClick={closeHistoryEditModal} 
              variant="secondary"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* History Delete Confirmation Modal */}
      <Modal
        isOpen={historyDeleteState.isOpen}
        onClose={closeHistoryDeleteModal}
        title="Delete History"
        size="md"
      >
        <div className="space-y-4">
          {historyDeleteState.group && (
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
              <h4 className="font-medium text-red-900 dark:text-red-100 mb-2">
                Delete {historyDeleteState.group.runs.filter((run: TestRun) => run.is_latest === 0).length} Historical Runs
              </h4>
              <div className="text-sm text-red-800 dark:text-red-200">
                <p><strong>Configuration:</strong> {historyDeleteState.group.first.hostname} • {historyDeleteState.group.first.protocol}</p>
                <p><strong>Drive:</strong> {historyDeleteState.group.first.drive_model} ({historyDeleteState.group.first.drive_type})</p>
                <p><strong>Test Pattern:</strong> {historyDeleteState.group.first.read_write_pattern} • Block Size: {historyDeleteState.group.first.block_size} • Queue Depth: {historyDeleteState.group.first.queue_depth}</p>
                <p><strong>Date Range:</strong> {new Date(historyDeleteState.group.first.timestamp).toISOString().split('T')[0]} to {new Date(historyDeleteState.group.last.timestamp).toISOString().split('T')[0]}</p>
              </div>
            </div>
          )}
          
          <div className="text-center">
            <h3 className="text-lg font-medium theme-text-primary mb-2">
              Delete Historical Runs
            </h3>
            <p className="text-sm theme-text-secondary">
              This will delete all historical runs in this group, keeping only the latest run. 
              This action cannot be undone. All associated performance metrics and data for the historical runs will be permanently removed.
            </p>
          </div>
          
          <div className="flex gap-3 pt-4">
            <Button 
              onClick={handleHistoryDelete} 
              variant="danger"
              className="flex-1"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete {historyDeleteState.group ? historyDeleteState.group.runs.filter((run: TestRun) => run.is_latest === 0).length : 0} Historical Runs
            </Button>
            <Button 
              onClick={closeHistoryDeleteModal} 
              variant="secondary"
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Bulk Import Modal */}
      <Modal
        isOpen={bulkImportState.isOpen}
        onClose={closeBulkImportModal}
        title="Bulk Import FIO Files"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm theme-text-secondary">
            Import all uploaded FIO JSON files from the uploads directory. This will process all files that haven&apos;t been imported yet.
          </p>
          
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="overwrite-enabled"
                checked={bulkImportState.overwrite}
                onChange={(e) => setBulkImportState(prev => ({ ...prev, overwrite: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="overwrite-enabled" className="text-sm font-medium theme-text-primary">
                Overwrite existing files
              </label>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="dry-run-enabled"
                checked={bulkImportState.dryRun}
                onChange={(e) => setBulkImportState(prev => ({ ...prev, dryRun: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="dry-run-enabled" className="text-sm font-medium theme-text-primary">
                Dry run (preview only)
              </label>
            </div>
          </div>
          
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
              Import Options
            </h4>
            <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <p><strong>Overwrite:</strong> {bulkImportState.overwrite ? 'Yes - will reimport existing files' : 'No - will skip existing files'}</p>
              <p><strong>Dry Run:</strong> {bulkImportState.dryRun ? 'Yes - will only preview what would be imported' : 'No - will actually import files'}</p>
            </div>
          </div>
          
          <div className="flex gap-3 pt-4">
            <Button 
              onClick={handleBulkImport} 
              disabled={bulkImportState.loading}
              className="flex-1"
            >
              {bulkImportState.loading ? (
                <>
                  <Loading className="h-4 w-4 mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  {bulkImportState.dryRun ? 'Preview Import' : 'Start Import'}
                </>
              )}
            </Button>
            <Button 
              onClick={closeBulkImportModal} 
              variant="secondary"
              disabled={bulkImportState.loading}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Bulk Delete All History Modal */}
      <Modal
        isOpen={bulkDeleteAllHistoryState.isOpen}
        onClose={closeBulkDeleteAllHistoryModal}
        title="Bulk Delete All History"
        size="md"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 dark:bg-red-900 rounded-full">
            <Trash2 className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          
          <div className="text-center">
            <h3 className="text-lg font-medium theme-text-primary mb-2">
              Delete All Historical Data
            </h3>
            <p className="text-sm theme-text-secondary">
              Are you sure you want to delete ALL historical test runs currently in view? This will delete {' '}
              {groupedHistory.reduce((total, group) => total + group.count, 0)} test runs from {' '}
              {groupedHistory.length} configuration groups.
            </p>
            <p className="text-sm theme-text-secondary mt-2 font-medium">
              This action cannot be undone. All associated performance metrics and data will be permanently removed.
            </p>
          </div>
          
          <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
            <h4 className="font-medium text-red-900 dark:text-red-100 mb-2">
              Summary of Deletion
            </h4>
            <div className="text-sm text-red-800 dark:text-red-200">
              <p><strong>Total Historical Runs:</strong> {groupedHistory.reduce((total, group) => total + group.count, 0)}</p>
              <p><strong>Configuration Groups:</strong> {groupedHistory.length}</p>
              <p><strong>Action:</strong> Delete all historical test runs from all groups</p>
            </div>
          </div>
          
          <div className="flex gap-3 pt-4">
            <Button 
              onClick={handleBulkDeleteAllHistory} 
              variant="danger"
              className="flex-1"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete All {groupedHistory.reduce((total, group) => total + group.count, 0)} Historical Runs
            </Button>
            <Button 
              onClick={closeBulkDeleteAllHistoryModal} 
              variant="secondary"
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Admin;