import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Edit2, Search, RefreshCw, X, Check, Trash2 } from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import Loading from '../components/ui/Loading';
import ErrorDisplay from '../components/ui/ErrorDisplay';
import { useTestRuns } from '../hooks/api/useTestRuns';
import { useServerSideTestRuns } from '../hooks/useServerSideTestRuns';
import type { TestRun } from '../types';

interface EditableFields {
  hostname?: string;
  protocol?: string;
  description?: string;
  test_name?: string;
  drive_type?: string;
  drive_model?: string;
}

interface EditingState {
  testRunId: number | null;
  fields: EditableFields;
}

interface GroupEditingState {
  groupKey: string | null;
  fields: EditableFields;
}

const Admin: React.FC = () => {
  // Feature flag for server-side filtering (can be made configurable later)
  const useServerSideFiltering = false;
  
  // Traditional client-side hook (fallback)
  const { 
    testRuns: clientTestRuns, 
    loading: clientLoading, 
    error: clientError, 
    refreshTestRuns, 
    updateTestRun, 
    bulkUpdateTestRuns, 
    bulkDeleteTestRuns 
  } = useTestRuns({ autoFetch: !useServerSideFiltering });
  
  // New server-side filtering hook
  const {
    testRuns: serverTestRuns,
    loading: serverLoading,
    error: serverError,
    activeFilters,
    setActiveFilters,
    clearFilters: clearServerFilters,
    refetch: _refetchServerData,
    hasActiveFilters: hasServerFilters,
    filters: serverFilters
  } = useServerSideTestRuns({ 
    includeHistorical: true, 
    autoFetch: useServerSideFiltering 
  });
  
  // Choose which data source to use based on feature flag
  const testRuns = useServerSideFiltering ? serverTestRuns : clientTestRuns;
  const loading = useServerSideFiltering ? serverLoading : clientLoading;
  const error = useServerSideFiltering ? serverError : clientError;
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const isSearching = searchTerm !== debouncedSearchTerm;
  const [selectedRuns, setSelectedRuns] = useState<Set<number>>(new Set());
  const [editingState, setEditingState] = useState<EditingState>({ testRunId: null, fields: {} });
  const [groupEditingState, setGroupEditingState] = useState<GroupEditingState>({ groupKey: null, fields: {} });
  const [bulkEditModalOpen, setBulkEditModalOpen] = useState(false);
  const [bulkEditFields, setBulkEditFields] = useState<EditableFields>({});
  const [bulkEditEnabled, setBulkEditEnabled] = useState<Record<keyof EditableFields, boolean>>({
    hostname: false,
    protocol: false,
    description: false,
    test_name: false,
    drive_type: false,
    drive_model: false,
  });
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [sortField, setSortField] = useState<keyof TestRun>('timestamp');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [timeSeriesFilter, setTimeSeriesFilter] = useState<string>('all');
  const [selectedGroupRunIds, setSelectedGroupRunIds] = useState<number[]>([]);
  const [displayLimit, setDisplayLimit] = useState(500); // Limit displayed results for performance
  const [showAllResults, setShowAllResults] = useState(false);

  useEffect(() => {
    refreshTestRuns(true); // Always include historical data for admin view
  }, [refreshTestRuns]);

  // Debounce search term to improve performance - reduced delay for faster response
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 150); // Reduced to 150ms for faster response

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Simplified client-side filtering for search only (server handles other filters)
  const filteredRuns = useMemo(() => {
    if (useServerSideFiltering) {
      // When using server-side filtering, only apply search term filter client-side
      if (!debouncedSearchTerm?.trim()) {
        return testRuns;
      }
      
      const searchTerms = debouncedSearchTerm.toLowerCase().split(' ').filter(term => term.trim() !== '');
      if (searchTerms.length === 0) return testRuns;
      
      return testRuns.filter(run => {
        const searchableFields = [
          run.hostname,
          run.protocol,
          run.drive_model,
          run.drive_type,
          run.read_write_pattern,
          run.test_name,
          run.description,
          run.block_size,
          run.test_size,
          run.queue_depth?.toString(),
          run.duration?.toString(),
          run.direct?.toString(),
          run.sync?.toString(),
          run.num_jobs?.toString()
        ].filter(field => field != null).map(field => String(field).toLowerCase()).join(' ');
        
        return searchTerms.every(term => searchableFields.includes(term));
      });
    }
    
    // Legacy client-side filtering logic (kept for fallback)
    const hasSearchTerm = debouncedSearchTerm?.trim();
    let searchTerms: string[] = [];
    
    if (hasSearchTerm) {
      searchTerms = debouncedSearchTerm.toLowerCase().split(' ').filter(term => term.trim() !== '');
    }
    
    return testRuns.filter(run => {
      // Group selection filtering (takes precedence when active)
      if (selectedGroupRunIds.length > 0) {
        if (!selectedGroupRunIds.includes(run.id)) return false;
      } else {
        // Time series filtering (only when no group is selected)
        if (timeSeriesFilter === 'with-history') {
          // Only show historical runs (is_latest = 0)
          if (run.is_latest === 1) return false;
        } else if (timeSeriesFilter === 'latest-only') {
          // Only show latest runs (is_latest = 1)
          if (run.is_latest === 0) return false;
        }
      }
      
      // Date range filtering
      if (fromDate || toDate) {
        const runDate = new Date(run.timestamp);
        
        if (fromDate) {
          const fromDateTime = new Date(fromDate);
          fromDateTime.setHours(0, 0, 0, 0); // Start of day
          if (runDate < fromDateTime) return false;
        }
        
        if (toDate) {
          const toDateTime = new Date(toDate);
          toDateTime.setHours(23, 59, 59, 999); // End of day
          if (runDate > toDateTime) return false;
        }
      }
      
      // Search term filtering
      if (searchTerms.length === 0) return true;
      
      const searchableFields = [
        run.hostname,
        run.protocol,
        run.drive_model,
        run.drive_type,
        run.read_write_pattern,
        run.test_name,
        run.description,
        run.block_size,
        run.test_size,
        run.queue_depth?.toString(),
        run.duration?.toString(),
        run.direct?.toString(),
        run.sync?.toString(),
        run.num_jobs?.toString()
      ].filter(field => field != null).map(field => String(field).toLowerCase()).join(' ');
      
      return searchTerms.every(term => searchableFields.includes(term));
    });
  }, [testRuns, selectedGroupRunIds, timeSeriesFilter, fromDate, toDate, debouncedSearchTerm, useServerSideFiltering]);

  const sortedRuns = useMemo(() => [...filteredRuns].sort((a, b) => {
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
  }), [filteredRuns, sortField, sortDirection]);

  // Limit displayed results for performance (only when not using server-side filtering)
  const displayedRuns = useMemo(() => {
    if (useServerSideFiltering) {
      // No need to limit when using server-side filtering
      return sortedRuns;
    }
    
    if (showAllResults || sortedRuns.length <= displayLimit) {
      return sortedRuns;
    }
    return sortedRuns.slice(0, displayLimit);
  }, [sortedRuns, displayLimit, showAllResults, useServerSideFiltering]);

  const hasMoreResults = !useServerSideFiltering && sortedRuns.length > displayLimit && !showAllResults;

  // Group historical data for special view
  const groupedHistoricalData = timeSeriesFilter === 'with-history' ? (() => {
    const groups: Record<string, TestRun[]> = {};
    
    // Group by hostname, protocol, drive_model, drive_type, test pattern, block_size, queue_depth
    filteredRuns.forEach(run => {
      const key = `${run.hostname}-${run.protocol}-${run.drive_model}-${run.drive_type}-${run.read_write_pattern}-${run.block_size}-${run.queue_depth}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(run);
    });
    
    // Convert to array with aggregated data
    return Object.entries(groups).map(([key, runs]) => {
      const sortedRuns = runs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const firstRun = sortedRuns[0];
      const lastRun = sortedRuns[sortedRuns.length - 1];
      
      return {
        key,
        runs,
        count: runs.length,
        firstRun,
        lastRun,
        startDate: new Date(firstRun.timestamp),
        endDate: new Date(lastRun.timestamp),
        hostname: firstRun.hostname,
        protocol: firstRun.protocol,
        drive_model: firstRun.drive_model,
        drive_type: firstRun.drive_type,
        test_pattern: firstRun.read_write_pattern,
        block_size: firstRun.block_size,
        queue_depth: firstRun.queue_depth
      };
    }).sort((a, b) => b.count - a.count); // Sort by count descending
  })() : [];

  const handleSort = (field: keyof TestRun) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleSelectAll = useCallback(() => {
    if (selectedRuns.size === displayedRuns.length) {
      setSelectedRuns(new Set());
    } else {
      setSelectedRuns(new Set(displayedRuns.map(run => run.id)));
    }
  }, [selectedRuns.size, displayedRuns]);

  const handleSelectRun = (runId: number) => {
    const newSelected = new Set(selectedRuns);
    if (newSelected.has(runId)) {
      newSelected.delete(runId);
    } else {
      newSelected.add(runId);
    }
    setSelectedRuns(newSelected);
  };

  const startEdit = (run: TestRun) => {
    setEditingState({
      testRunId: run.id,
      fields: {
        hostname: run.hostname || '',
        protocol: run.protocol || '',
        description: run.description || '',
        test_name: run.test_name || '',
        drive_type: run.drive_type || '',
        drive_model: run.drive_model || ''
      }
    });
  };

  const cancelEdit = () => {
    setEditingState({ testRunId: null, fields: {} });
  };

  const saveEdit = async () => {
    if (!editingState.testRunId) return;
    
    try {
      await updateTestRun(editingState.testRunId, editingState.fields);
      setEditingState({ testRunId: null, fields: {} });
      refreshTestRuns(true);
    } catch (err) {
      console.error('Failed to update test run:', err);
    }
  };

  const startGroupEdit = (group: any) => {
    setGroupEditingState({
      groupKey: group.key,
      fields: {
        hostname: group.hostname || '',
        protocol: group.protocol || '',
        description: group.firstRun.description || '',
        test_name: group.firstRun.test_name || '',
        drive_type: group.drive_type || '',
        drive_model: group.drive_model || ''
      }
    });
  };

  const cancelGroupEdit = () => {
    setGroupEditingState({ groupKey: null, fields: {} });
  };

  const saveGroupEdit = async () => {
    if (!groupEditingState.groupKey) return;
    
    // Find the group and get all test run IDs
    const group = groupedHistoricalData.find(g => g.key === groupEditingState.groupKey);
    if (!group) return;
    
    const testRunIds = group.runs.map(run => run.id);
    
    try {
      await bulkUpdateTestRuns(testRunIds, groupEditingState.fields);
      setGroupEditingState({ groupKey: null, fields: {} });
      refreshTestRuns(true);
    } catch (err) {
      console.error('Failed to update group:', err);
    }
  };

  const updateGroupEditField = (field: keyof EditableFields, value: string) => {
    setGroupEditingState(prev => ({
      ...prev,
      fields: { ...prev.fields, [field]: value }
    }));
  };

  const handleGroupClick = (group: any) => {
    // Extract all test run IDs from the group
    const runIds = group.runs.map((run: any) => run.id);
    setSelectedGroupRunIds(runIds);
    // Switch to regular table view to show the filtered runs
    setTimeSeriesFilter('all');
  };

  const handleBulkEdit = async () => {
    if (selectedRuns.size === 0) return;
    
    // Only include fields that are enabled for update
    const fieldsToUpdate: EditableFields = {};
    Object.entries(bulkEditEnabled).forEach(([field, enabled]) => {
      if (enabled && bulkEditFields[field as keyof EditableFields] !== undefined) {
        fieldsToUpdate[field as keyof EditableFields] = bulkEditFields[field as keyof EditableFields];
      }
    });
    
    // Guard against empty updates (e.g., user forgot to enable fields)
    if (Object.keys(fieldsToUpdate).length === 0) {
      alert('Please enable at least one field and provide a value to update.');
      return;
    }

    try {
      await bulkUpdateTestRuns(Array.from(selectedRuns), fieldsToUpdate);
      setBulkEditModalOpen(false);
      setBulkEditFields({});
      setBulkEditEnabled({
        hostname: false,
        protocol: false,
        description: false,
        test_name: false,
        drive_type: false,
        drive_model: false,
      });
      setSelectedRuns(new Set());
      refreshTestRuns(true);
    } catch (err) {
      console.error('Failed to bulk update test runs:', err);
      alert(err instanceof Error ? err.message : 'Bulk update failed');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRuns.size === 0) return;
    
    try {
      const result = await bulkDeleteTestRuns(Array.from(selectedRuns));
      setBulkDeleteModalOpen(false);
      setSelectedRuns(new Set());
      
      if (result.failed > 0) {
        console.warn(`Failed to delete ${result.failed} out of ${result.total} test runs`);
      }
      
      refreshTestRuns(true);
    } catch (err) {
      console.error('Failed to bulk delete test runs:', err);
    }
  };

  const updateEditField = (field: keyof EditableFields, value: string) => {
    setEditingState(prev => ({
      ...prev,
      fields: { ...prev.fields, [field]: value }
    }));
  };

  const updateBulkEditField = (field: keyof EditableFields, value: string) => {
    setBulkEditFields(prev => ({ ...prev, [field]: value }));
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
    const selectedTestRuns = testRuns.filter(run => selectedRuns.has(run.id));
    
    return {
      hostname: getMostCommonValue(selectedTestRuns.map(run => run.hostname)),
      protocol: getMostCommonValue(selectedTestRuns.map(run => run.protocol)),
      description: getMostCommonValue(selectedTestRuns.map(run => run.description)),
      test_name: getMostCommonValue(selectedTestRuns.map(run => run.test_name)),
      drive_type: getMostCommonValue(selectedTestRuns.map(run => run.drive_type)),
      drive_model: getMostCommonValue(selectedTestRuns.map(run => run.drive_model)),
    };
  };

  // Prefill form when modal opens
  const openBulkEditModal = () => {
    const commonValues = getCommonValuesFromSelection();
    setBulkEditFields(commonValues);
    setBulkEditModalOpen(true);
  };

  // Handle checkbox change for enabling/disabling field updates
  const handleFieldEnabledChange = (field: keyof EditableFields, enabled: boolean) => {
    setBulkEditEnabled(prev => ({ ...prev, [field]: enabled }));
    
    if (enabled) {
      // When enabling, update the field with the most common value
      const selectedTestRuns = testRuns.filter(run => selectedRuns.has(run.id));
      let values: (string | undefined)[] = [];
      
      switch (field) {
        case 'hostname':
          values = selectedTestRuns.map(run => run.hostname);
          break;
        case 'protocol':
          values = selectedTestRuns.map(run => run.protocol);
          break;
        case 'description':
          values = selectedTestRuns.map(run => run.description);
          break;
        case 'test_name':
          values = selectedTestRuns.map(run => run.test_name);
          break;
        case 'drive_type':
          values = selectedTestRuns.map(run => run.drive_type);
          break;
        case 'drive_model':
          values = selectedTestRuns.map(run => run.drive_model);
          break;
      }
      
      const commonValue = getMostCommonValue(values);
      setBulkEditFields(prev => ({ ...prev, [field]: commonValue }));
    }
  };

  if (loading) {
    return <Loading className="min-h-screen" />;
  }

  if (error) {
    return <ErrorDisplay error={error} onRetry={() => refreshTestRuns(true)} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Test Run Administration
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage test run metadata and configurations
          </p>
        </div>

        {/* Controls */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className="relative">
                <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${isSearching ? 'text-blue-500 animate-pulse' : 'text-gray-400'}`} />
                <Input
                  type="text"
                  placeholder="Search test runs..."
                  value={searchTerm}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                  className={`pl-10 w-64 ${isSearching ? 'border-blue-300' : ''}`}
                />
                {isSearching && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                  </div>
                )}
              </div>
              
              {/* Server-side filtering controls */}
              {useServerSideFiltering && serverFilters && (
                <div className="flex flex-wrap gap-2">
                  <select
                    value={activeFilters.hostnames[0] || ''}
                    onChange={(e) => setActiveFilters({
                      ...activeFilters,
                      hostnames: e.target.value ? [e.target.value] : []
                    })}
                    className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Hosts</option>
                    {serverFilters.hostnames.map(hostname => (
                      <option key={hostname} value={hostname}>{hostname}</option>
                    ))}
                  </select>
                  <select
                    value={activeFilters.protocols[0] || ''}
                    onChange={(e) => setActiveFilters({
                      ...activeFilters,
                      protocols: e.target.value ? [e.target.value] : []
                    })}
                    className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Protocols</option>
                    {serverFilters.protocols.map(protocol => (
                      <option key={protocol} value={protocol}>{protocol}</option>
                    ))}
                  </select>
                  <select
                    value={activeFilters.drive_types[0] || ''}
                    onChange={(e) => setActiveFilters({
                      ...activeFilters,
                      drive_types: e.target.value ? [e.target.value] : []
                    })}
                    className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Drive Types</option>
                    {serverFilters.drive_types.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  {hasServerFilters && (
                    <Button
                      onClick={clearServerFilters}
                      variant="ghost"
                      size="sm"
                      className="text-gray-500 hover:text-gray-700"
                    >
                      Clear Filters
                    </Button>
                  )}
                </div>
              )}
              
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label htmlFor="fromDate" className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    From:
                  </label>
                  <input
                    type="date"
                    id="fromDate"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div className="flex items-center gap-2">
                  <label htmlFor="toDate" className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    To:
                  </label>
                  <input
                    type="date"
                    id="toDate"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                {(fromDate || toDate) && (
                  <Button
                    onClick={() => {
                      setFromDate('');
                      setToDate('');
                    }}
                    variant="secondary"
                    size="sm"
                    className="text-xs"
                  >
                    Clear Dates
                  </Button>
                )}
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label htmlFor="timeSeriesFilter" className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    Filter:
                  </label>
                  <select
                    id="timeSeriesFilter"
                    value={timeSeriesFilter}
                    onChange={(e) => setTimeSeriesFilter(e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">All Test Runs</option>
                    <option value="with-history">With Historical Data</option>
                    <option value="latest-only">Latest Only (No History)</option>
                  </select>
                </div>
                
                <Button
                  onClick={() => refreshTestRuns(true)}
                  variant="secondary"
                  size="sm"
                  icon={RefreshCw}
                  iconPosition="left"
                  className="whitespace-nowrap"
                >
                  Refresh
                </Button>
                
                {selectedGroupRunIds.length > 0 && (
                  <Button
                    onClick={() => setSelectedGroupRunIds([])}
                    variant="outline"
                    size="sm"
                    className="whitespace-nowrap"
                  >
                    Clear Group Filter ({selectedGroupRunIds.length} runs)
                  </Button>
                )}
              </div>
            </div>
            
            {selectedRuns.size > 0 && (
              <div className="flex gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400 py-2">
                  {selectedRuns.size} selected
                </span>
                <Button
                  onClick={openBulkEditModal}
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Edit2 className="h-4 w-4" />
                  Bulk Edit
                </Button>
                <Button
                  onClick={() => setBulkDeleteModalOpen(true)}
                  size="sm"
                  variant="danger"
                  className="flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Bulk Delete
                </Button>
              </div>
            )}
          </div>
        </div>


        {/* Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            {timeSeriesFilter === 'with-history' ? (
              /* Grouped Historical Data Table */
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Configuration
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Count
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Start Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      End Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800">
                  {groupedHistoricalData.map((group) => {
                    const isGroupEditing = groupEditingState.groupKey === group.key;
                    return (
                      <React.Fragment key={group.key}>
                        {/* Main group row */}
                        <tr className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150">
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <div className="font-medium text-sm text-gray-900 dark:text-white">
                                {isGroupEditing ? (
                                  <div className="flex gap-2">
                                    <Input
                                      value={groupEditingState.fields.hostname || ''}
                                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateGroupEditField('hostname', e.target.value)}
                                      className="flex-1"
                                      size="sm"
                                      placeholder="Hostname"
                                    />
                                    <span className="text-gray-500 py-1">•</span>
                                    <Input
                                      value={groupEditingState.fields.protocol || ''}
                                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateGroupEditField('protocol', e.target.value)}
                                      className="flex-1"
                                      size="sm"
                                      placeholder="Protocol"
                                    />
                                  </div>
                                ) : (
                                  `${group.hostname} • ${group.protocol}`
                                )}
                              </div>
                              <div className="text-xs text-gray-600 dark:text-gray-400">
                                {isGroupEditing ? (
                                  <div className="flex gap-2">
                                    <Input
                                      value={groupEditingState.fields.drive_model || ''}
                                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateGroupEditField('drive_model', e.target.value)}
                                      className="flex-1"
                                      size="sm"
                                      placeholder="Drive model"
                                    />
                                    <span className="text-gray-500 py-1">(</span>
                                    <Input
                                      value={groupEditingState.fields.drive_type || ''}
                                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateGroupEditField('drive_type', e.target.value)}
                                      className="flex-1"
                                      size="sm"
                                      placeholder="Drive type"
                                    />
                                    <span className="text-gray-500 py-1">)</span>
                                  </div>
                                ) : (
                                  `${group.drive_model} (${group.drive_type})`
                                )}
                              </div>
                              <div className="flex gap-2 flex-wrap">
                                <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                  {group.test_pattern}
                                </span>
                                <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                                  {group.block_size}
                                </span>
                                <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                  QD{group.queue_depth}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleGroupClick(group)}
                              className="inline-flex items-center px-3 py-1 text-sm font-medium rounded-md bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors duration-150 cursor-pointer"
                              title="Click to view individual test runs"
                            >
                              {group.count} runs
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-900 dark:text-white">
                              {group.startDate.toISOString().split('T')[0]}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {group.startDate.toLocaleTimeString('en-US', { hour12: false, timeStyle: 'short' })}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-900 dark:text-white">
                              {group.endDate.toISOString().split('T')[0]}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {group.endDate.toLocaleTimeString('en-US', { hour12: false, timeStyle: 'short' })}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-900 dark:text-white">
                              {Math.ceil((group.endDate.getTime() - group.startDate.getTime()) / (1000 * 60 * 60 * 24))} days
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {((group.endDate.getTime() - group.startDate.getTime()) / (1000 * 60 * 60)).toFixed(1)} hours
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {isGroupEditing ? (
                              <div className="flex gap-1">
                                <Button onClick={saveGroupEdit} size="sm" variant="primary">
                                  <Check className="h-3 w-3" />
                                </Button>
                                <Button onClick={cancelGroupEdit} size="sm" variant="secondary">
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <Button onClick={() => startGroupEdit(group)} size="sm" variant="secondary">
                                <Edit2 className="h-3 w-3" />
                              </Button>
                            )}
                          </td>
                        </tr>
                        
                        {/* Description row for group */}
                        <tr className="bg-gray-50/50 dark:bg-gray-700/30 transition-colors duration-150">
                          <td colSpan={6} className="px-4 pb-3 pt-1">
                            {isGroupEditing ? (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Description:</span>
                                <Input
                                  value={groupEditingState.fields.description || ''}
                                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateGroupEditField('description', e.target.value)}
                                  className="flex-1"
                                  size="sm"
                                  placeholder="Test description"
                                />
                              </div>
                            ) : (
                              <div className="flex items-start gap-2">
                                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5 whitespace-nowrap">Description:</span>
                                <div className="text-xs leading-relaxed break-words text-gray-600 dark:text-gray-400">
                                  {group.firstRun.test_name || <span className="italic text-gray-400">No description</span>}
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              /* Regular Detailed Table */
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedRuns.size === sortedRuns.length && sortedRuns.length > 0}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      <button onClick={() => handleSort('id')} className="hover:text-gray-700 dark:hover:text-gray-300">
                        ID {sortField === 'id' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      <button onClick={() => handleSort('timestamp')} className="hover:text-gray-700 dark:hover:text-gray-300">
                        Timestamp {sortField === 'timestamp' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      <button onClick={() => handleSort('hostname')} className="hover:text-gray-700 dark:hover:text-gray-300">
                        Hostname {sortField === 'hostname' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      <button onClick={() => handleSort('protocol')} className="hover:text-gray-700 dark:hover:text-gray-300">
                        Protocol {sortField === 'protocol' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      <button onClick={() => handleSort('drive_type')} className="hover:text-gray-700 dark:hover:text-gray-300">
                        Drive Type {sortField === 'drive_type' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      <button onClick={() => handleSort('drive_model')} className="hover:text-gray-700 dark:hover:text-gray-300">
                        Drive Model {sortField === 'drive_model' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      <button onClick={() => handleSort('read_write_pattern')} className="hover:text-gray-700 dark:hover:text-gray-300">
                        Test Pattern {sortField === 'read_write_pattern' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      <button onClick={() => handleSort('block_size')} className="hover:text-gray-700 dark:hover:text-gray-300">
                        BSz {sortField === 'block_size' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      <button onClick={() => handleSort('test_size')} className="hover:text-gray-700 dark:hover:text-gray-300">
                        TSz {sortField === 'test_size' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      <button onClick={() => handleSort('duration')} className="hover:text-gray-700 dark:hover:text-gray-300">
                        Dur {sortField === 'duration' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-auto min-w-24">
                      Test Config
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      <button onClick={() => handleSort('is_latest')} className="hover:text-gray-700 dark:hover:text-gray-300">
                        Status {sortField === 'is_latest' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800">
                  {displayedRuns.map((run) => {
                    const isEditing = editingState.testRunId === run.id;
                    const isSelected = selectedRuns.has(run.id);
                    return (
                      <React.Fragment key={run.id}>
                        {/* Main data row */}
                        <tr 
                          className={`
                            ${isSelected 
                              ? 'bg-blue-50 dark:bg-blue-900/20' 
                              : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                            }
                            transition-colors duration-150
                          `}
                        >
                        <td className="px-4 py-3">
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              checked={selectedRuns.has(run.id)}
                              onChange={() => handleSelectRun(run.id)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          </div>
                        </td>
                        <td className={`px-2 py-2 text-sm ${isSelected ? 'text-blue-900 dark:text-blue-100 font-medium' : 'text-gray-900 dark:text-white'}`}>
                          {run.id}
                        </td>
                        <td className={`px-4 py-3 text-sm ${isSelected ? 'text-blue-900 dark:text-blue-100' : 'text-gray-900 dark:text-white'}`}>
                          <div className="flex flex-col min-w-20 max-w-28">
                            <span className="font-medium font-mono text-xs whitespace-nowrap">{new Date(run.timestamp).toISOString().split('T')[0]}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{new Date(run.timestamp).toLocaleTimeString('en-US', { hour12: false, timeStyle: 'short' })}</span>
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          {isEditing ? (
                            <Input
                              value={editingState.fields.hostname || ''}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateEditField('hostname', e.target.value)}
                              className="w-full"
                              size="sm"
                            />
                          ) : (
                            <div className={`text-sm ${isSelected ? 'text-blue-900 dark:text-blue-100' : 'text-gray-900 dark:text-white'} min-w-32`}>
                              <div className="whitespace-nowrap" title={run.hostname}>
                                {run.hostname || '-'}
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <Input
                              value={editingState.fields.protocol || ''}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateEditField('protocol', e.target.value)}
                              className="w-full"
                              size="sm"
                            />
                          ) : (
                            <div className={`text-sm ${isSelected ? 'text-blue-900 dark:text-blue-100' : 'text-gray-900 dark:text-white'} max-w-20`}>
                              <div className="truncate" title={run.protocol}>
                                {run.protocol || '-'}
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <Input
                              value={editingState.fields.drive_type || ''}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateEditField('drive_type', e.target.value)}
                              className="w-full"
                              size="sm"
                            />
                          ) : (
                            <div className={`text-sm ${isSelected ? 'text-blue-900 dark:text-blue-100' : 'text-gray-900 dark:text-white'} max-w-20`}>
                              <div className="truncate" title={run.drive_type}>
                                {run.drive_type || '-'}
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <Input
                              value={editingState.fields.drive_model || ''}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateEditField('drive_model', e.target.value)}
                              className="w-full"
                              size="sm"
                            />
                          ) : (
                            <div className={`text-sm ${isSelected ? 'text-blue-900 dark:text-blue-100' : 'text-gray-900 dark:text-white'} max-w-28`}>
                              <div className="truncate" title={run.drive_model}>
                                {run.drive_model || '-'}
                              </div>
                            </div>
                          )}
                        </td>
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
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          <span className={`text-sm font-mono ${isSelected ? 'text-blue-900 dark:text-blue-100' : 'text-gray-600 dark:text-gray-300'}`}>
                            {run.block_size || '-'}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          <span className={`text-sm font-mono ${isSelected ? 'text-blue-900 dark:text-blue-100' : 'text-gray-600 dark:text-gray-300'}`}>
                            {run.test_size || '-'}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          <span className={`text-sm ${isSelected ? 'text-blue-900 dark:text-blue-100' : 'text-gray-600 dark:text-gray-300'}`}>
                            {run.duration ? `${run.duration}s` : '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="grid grid-cols-2 gap-2 w-fit">
                            {run.queue_depth && (
                              <div className="flex items-center justify-center px-0 py-0 text-[9px] font-medium rounded bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 w-10 h-5">
                                QD{run.queue_depth}
                              </div>
                            )}
                            {run.direct !== undefined && (
                              <div className="flex items-center justify-center px-0 py-0 text-[9px] font-medium rounded bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 w-10 h-5">
                                DIR{run.direct}
                              </div>
                            )}
                            {run.sync !== undefined && (
                              <div className="flex items-center justify-center px-0 py-0 text-[9px] font-medium rounded bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200 w-10 h-5">
                                SYN{run.sync}
                              </div>
                            )}
                            {run.num_jobs && (
                              <div className="flex items-center justify-center px-0 py-0 text-[9px] font-medium rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 w-10 h-5">
                                NJ{run.num_jobs}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {run.is_latest === 1 ? (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              Latest
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                              Historical
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 relative">
                          {isEditing ? (
                            <div className="flex gap-1">
                              <Button onClick={saveEdit} size="sm" variant="primary">
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button onClick={cancelEdit} size="sm" variant="secondary">
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <Button onClick={() => startEdit(run)} size="sm" variant="secondary">
                              <Edit2 className="h-3 w-3" />
                            </Button>
                          )}
                        </td>
                        </tr>
                        
                        {/* Description row spanning all columns */}
                        <tr className={`
                          ${isSelected 
                            ? 'bg-blue-50 dark:bg-blue-900/20' 
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                          }
                          transition-colors duration-150
                        `}>
                          <td colSpan={15} className="px-4 pb-3 pt-1">
                            {isEditing ? (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Test Name:</span>
                                  <Input
                                    value={editingState.fields.test_name || ''}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateEditField('test_name', e.target.value)}
                                    className="flex-1"
                                    size="sm"
                                    placeholder="Test name"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Description:</span>
                                  <Input
                                    value={editingState.fields.description || ''}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateEditField('description', e.target.value)}
                                    className="flex-1"
                                    size="sm"
                                    placeholder="Test description"
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <div className="flex items-start gap-2">
                                  <span className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5 whitespace-nowrap">Test Name:</span>
                                  <div className={`text-xs leading-relaxed break-words ${isSelected ? 'text-blue-800 dark:text-blue-200' : 'text-gray-600 dark:text-gray-400'}`}>
                                    {run.test_name || <span className="italic text-gray-400">No test name</span>}
                                  </div>
                                </div>
                                <div className="flex items-start gap-2">
                                  <span className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5 whitespace-nowrap">Description:</span>
                                  <div className={`text-xs leading-relaxed break-words ${isSelected ? 'text-blue-800 dark:text-blue-200' : 'text-gray-600 dark:text-gray-400'}`}>
                                    {run.description || <span className="italic text-gray-400">No description</span>}
                                  </div>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          
          {/* Show More Results Button */}
          {hasMoreResults && (
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-t">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Showing {displayedRuns.length} of {sortedRuns.length} results (limited for performance)
                </span>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setShowAllResults(true)}
                    variant="secondary"
                    size="sm"
                    className="text-xs"
                  >
                    Show All {sortedRuns.length} Results
                  </Button>
                  <Button
                    onClick={() => setDisplayLimit(displayLimit + 500)}
                    variant="primary"
                    size="sm"
                    className="text-xs"
                  >
                    Show 500 More
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Results summary */}
        <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          Showing {displayedRuns.length} of {sortedRuns.length} filtered results ({testRuns.length} total)
          {selectedGroupRunIds.length > 0 ? ' (filtered from group)' :
           timeSeriesFilter === 'with-history' ? ' (with historical data)' : 
           timeSeriesFilter === 'latest-only' ? ' (latest only)' : 
           ' (all data)'}
        </div>

        {/* Bulk Edit Modal */}
        <Modal
          isOpen={bulkEditModalOpen}
          onClose={() => setBulkEditModalOpen(false)}
          title="Bulk Edit Test Runs"
          size="md"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Update {selectedRuns.size} selected test runs. Check the fields you want to update with the common values.
            </p>
            
            <div className="space-y-3">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    id="hostname-enabled"
                    checked={bulkEditEnabled.hostname}
                    onChange={(e) => handleFieldEnabledChange('hostname', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="hostname-enabled" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Update Hostname
                  </label>
                </div>
                <Input
                  value={bulkEditFields.hostname || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateBulkEditField('hostname', e.target.value)}
                  placeholder="Common hostname value"
                  disabled={!bulkEditEnabled.hostname}
                  className={`w-full ${!bulkEditEnabled.hostname ? 'opacity-50' : ''}`}
                />
              </div>
              
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    id="protocol-enabled"
                    checked={bulkEditEnabled.protocol}
                    onChange={(e) => handleFieldEnabledChange('protocol', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="protocol-enabled" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Update Protocol
                  </label>
                </div>
                <Input
                  value={bulkEditFields.protocol || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateBulkEditField('protocol', e.target.value)}
                  placeholder="Common protocol value"
                  disabled={!bulkEditEnabled.protocol}
                  className={`w-full ${!bulkEditEnabled.protocol ? 'opacity-50' : ''}`}
                />
              </div>
              
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    id="description-enabled"
                    checked={bulkEditEnabled.description}
                    onChange={(e) => handleFieldEnabledChange('description', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="description-enabled" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Update Description
                  </label>
                </div>
                <Input
                  value={bulkEditFields.description || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateBulkEditField('description', e.target.value)}
                  placeholder="Common description value"
                  disabled={!bulkEditEnabled.description}
                  className={`w-full ${!bulkEditEnabled.description ? 'opacity-50' : ''}`}
                />
              </div>
              
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    id="test_name-enabled"
                    checked={bulkEditEnabled.test_name}
                    onChange={(e) => handleFieldEnabledChange('test_name', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="test_name-enabled" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Update Test Name
                  </label>
                </div>
                <Input
                  value={bulkEditFields.test_name || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateBulkEditField('test_name', e.target.value)}
                  placeholder="Common test name value"
                  disabled={!bulkEditEnabled.test_name}
                  className={`w-full ${!bulkEditEnabled.test_name ? 'opacity-50' : ''}`}
                />
              </div>
              
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    id="drive_type-enabled"
                    checked={bulkEditEnabled.drive_type}
                    onChange={(e) => handleFieldEnabledChange('drive_type', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="drive_type-enabled" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Update Drive Type
                  </label>
                </div>
                <Input
                  value={bulkEditFields.drive_type || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateBulkEditField('drive_type', e.target.value)}
                  placeholder="Common drive type value"
                  disabled={!bulkEditEnabled.drive_type}
                  className={`w-full ${!bulkEditEnabled.drive_type ? 'opacity-50' : ''}`}
                />
              </div>
              
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    id="drive_model-enabled"
                    checked={bulkEditEnabled.drive_model}
                    onChange={(e) => handleFieldEnabledChange('drive_model', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="drive_model-enabled" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Update Drive Model
                  </label>
                </div>
                <Input
                  value={bulkEditFields.drive_model || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateBulkEditField('drive_model', e.target.value)}
                  placeholder="Common drive model value"
                  disabled={!bulkEditEnabled.drive_model}
                  className={`w-full ${!bulkEditEnabled.drive_model ? 'opacity-50' : ''}`}
                />
              </div>
            </div>
            
            <div className="flex gap-3 pt-4">
              <Button onClick={handleBulkEdit} className="flex-1">
                Update {selectedRuns.size} Runs
              </Button>
              <Button 
                onClick={() => setBulkEditModalOpen(false)} 
                variant="secondary"
              >
                Cancel
              </Button>
            </div>
          </div>
        </Modal>

        {/* Bulk Delete Confirmation Modal */}
        <Modal
          isOpen={bulkDeleteModalOpen}
          onClose={() => setBulkDeleteModalOpen(false)}
          title="Confirm Bulk Delete"
          size="md"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 dark:bg-red-900 rounded-full">
              <Trash2 className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Delete {selectedRuns.size} Test Runs
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
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
                onClick={() => setBulkDeleteModalOpen(false)} 
                variant="secondary"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
};

export default Admin;