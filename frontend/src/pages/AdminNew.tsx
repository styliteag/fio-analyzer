import React, { useMemo, useState } from 'react';
import { Settings, Database, Filter, RefreshCw, BarChart3, History, Search, ChevronUp, ChevronDown, Edit2, Check, X, Trash2, ArrowLeft } from 'lucide-react';
import Button from '../components/ui/Button';
import Loading from '../components/ui/Loading';
import ErrorDisplay from '../components/ui/ErrorDisplay';
import Modal from '../components/ui/Modal';
import { useServerSideTestRuns } from '../hooks/useServerSideTestRuns';
import { bulkUpdateTestRuns, deleteTestRuns } from '../services/api/testRuns';
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

const AdminNew: React.FC = () => {
  const navigate = useNavigate();
  const [view, setView] = useState<'latest' | 'history'>('latest');
  const [sortField, setSortField] = useState<keyof TestRun>('timestamp');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedRuns, setSelectedRuns] = useState<Set<number>>(new Set());
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
  const {
    testRuns,
    loading,
    error,
    filters,
    activeFilters,
    setActiveFilters,
    clearFilters,
  } = useServerSideTestRuns({ includeHistorical: true });

  // Split latest vs historical early for easy memoisation
  const latestRuns = useMemo(() => testRuns.filter(r => r.is_latest === 1), [testRuns]);
  const historicalRuns = useMemo(() => testRuns.filter(r => r.is_latest === 0), [testRuns]);

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
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [historicalRuns, view]);

  // Sort latest runs
  const sortedLatestRuns = useMemo(() => {
    return [...latestRuns].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      
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
      
      return sortDirection === 'desc' ? -comparison : comparison;
    });
  }, [latestRuns, sortField, sortDirection]);

  const handleSort = (field: keyof TestRun) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }: { field: keyof TestRun }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />;
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
    const selectedTestRuns = sortedLatestRuns.filter(run => selectedRuns.has(run.id));
    
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
    if (selectedRuns.size === sortedLatestRuns.length) {
      setSelectedRuns(new Set());
    } else {
      setSelectedRuns(new Set(sortedLatestRuns.map(run => run.id)));
    }
  };

  const handleSelectRun = (runId: number) => {
    const newSelected = new Set(selectedRuns);
    if (newSelected.has(runId)) {
      newSelected.delete(runId);
    } else {
      newSelected.add(runId);
    }
    setSelectedRuns(newSelected);
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
    if (selectedRuns.size === 0) return;
    
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
      const result = await bulkUpdateTestRuns(Array.from(selectedRuns), fieldsToUpdate);
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      // Refresh the data after successful update
      // TODO: Add refresh function to the hook
      window.location.reload();
      
      closeBulkEditModal();
      setSelectedRuns(new Set());
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
    if (selectedRuns.size === 0) return;
    
    try {
      const result = await deleteTestRuns(Array.from(selectedRuns));
      
      if (result.failed > 0) {
        alert(`Successfully deleted ${result.successful} test runs, but failed to delete ${result.failed} runs.`);
      } else {
        alert(`Successfully deleted ${result.successful} test runs.`);
      }
      
      // Refresh the data after successful deletion
      window.location.reload();
      
      closeBulkDeleteModal();
      setSelectedRuns(new Set());
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
      const result = await bulkUpdateTestRuns(testRunIds, fieldsToUpdate);
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      // Refresh the data after successful update
      window.location.reload();
      
      closeHistoryEditModal();
    } catch (err) {
      console.error('Failed to update history group:', err);
      alert(err instanceof Error ? err.message : 'History update failed');
    }
  };

  /* ----- rendering helpers ----- */
  const renderFilters = () => {
    if (!filters) return null;
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
              onChange={e => setActiveFilters({ ...activeFilters, hostnames: e.target.value ? [e.target.value] : [] })}
              className="theme-form-select text-sm px-3 py-1.5 min-w-32"
            >
              <option value="">All Hosts</option>
              {filters.hostnames.map(h => (
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
              size="sm"
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
                  checked={selectedRuns.size === sortedLatestRuns.length && sortedLatestRuns.length > 0}
                  onChange={handleSelectAll}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider cursor-pointer hover:theme-text-primary transition-colors"
                onClick={() => handleSort('id')}
              >
                <div className="flex items-center gap-1">
                  ID
                  <SortIcon field="id" />
                </div>
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider cursor-pointer hover:theme-text-primary transition-colors"
                onClick={() => handleSort('timestamp')}
              >
                <div className="flex items-center gap-1">
                  Timestamp
                  <SortIcon field="timestamp" />
                </div>
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider cursor-pointer hover:theme-text-primary transition-colors"
                onClick={() => handleSort('hostname')}
              >
                <div className="flex items-center gap-1">
                  Host
                  <SortIcon field="hostname" />
                </div>
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider cursor-pointer hover:theme-text-primary transition-colors"
                onClick={() => handleSort('protocol')}
              >
                <div className="flex items-center gap-1">
                  Protocol
                  <SortIcon field="protocol" />
                </div>
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider cursor-pointer hover:theme-text-primary transition-colors"
                onClick={() => handleSort('drive_model')}
              >
                <div className="flex items-center gap-1">
                  Model
                  <SortIcon field="drive_model" />
                </div>
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider cursor-pointer hover:theme-text-primary transition-colors"
                onClick={() => handleSort('drive_type')}
              >
                <div className="flex items-center gap-1">
                  Type
                  <SortIcon field="drive_type" />
                </div>
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium theme-text-secondary uppercase tracking-wider cursor-pointer hover:theme-text-primary transition-colors"
                onClick={() => handleSort('read_write_pattern')}
              >
                <div className="flex items-center gap-1">
                  Pattern
                  <SortIcon field="read_write_pattern" />
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
                      checked={selectedRuns.has(run.id)}
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
                    <Button 
                      onClick={() => openHistoryEditModal(group)} 
                      size="sm" 
                      variant="outline"
                      title="Edit all historical runs in this group"
                    >
                      Edit
                    </Button>
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
  if (loading) return <Loading className="min-h-screen" />;
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
          </div>
        </div>

        {/* Bulk Edit Controls */}
        {view === 'latest' && selectedRuns.size > 0 && (
          <div className="mb-4 p-4 theme-card">
            <div className="flex items-center justify-between">
              <span className="text-sm theme-text-secondary">
                {selectedRuns.size} test run{selectedRuns.size !== 1 ? 's' : ''} selected
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
            <div className="text-sm theme-text-secondary">
              {view === 'latest' 
                ? `Showing ${latestRuns.length} latest runs`
                : `Showing ${groupedHistory.length} configuration groups`
              }
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
            Update {selectedRuns.size} selected test runs. Check the fields you want to update with the common values.
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
              Update {selectedRuns.size} Runs
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
              Delete {selectedRuns.size} Test Runs
            </h3>
            <p className="text-sm theme-text-secondary">
              Are you sure you want to delete these {selectedRuns.size} test runs? This action cannot be undone.
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
              Delete {selectedRuns.size} Runs
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
    </div>
  );
};

export default AdminNew; 