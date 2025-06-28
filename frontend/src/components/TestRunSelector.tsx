import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import { TestRun, FilterOptions } from '../types';
import { fetchTestRuns, fetchFilters, deleteTestRun } from '../utils/api';
import { Calendar, HardDrive, Settings, Edit2, Trash2, Plus, Users } from 'lucide-react';
import EditTestRunModal from './EditTestRunModal';
import BulkEditModal from './BulkEditModal';
import { getSelectStyles } from '../hooks/useThemeColors';

interface TestRunSelectorProps {
  selectedRuns: TestRun[];
  onSelectionChange: (runs: TestRun[]) => void;
  refreshTrigger?: number;
}

const TestRunSelector: React.FC<TestRunSelectorProps> = ({
  selectedRuns,
  onSelectionChange,
  refreshTrigger = 0,
}) => {
  // Configuration
  const SELECTED_RUNS_COLUMNS = {
    sm: 2,     // 2 columns on small screens (mobile)
    md: 3,     // 3 columns on medium screens (tablet)  
    lg: 4,     // 4 columns on large screens (laptop)
    xl: 5,     // 5 columns on extra large screens (desktop)
    '2xl': 6   // 6 columns on 2xl screens (wide desktop)
  };

  const [testRuns, setTestRuns] = useState<TestRun[]>([]);
  const [filteredRuns, setFilteredRuns] = useState<TestRun[]>([]);
  const [filters, setFilters] = useState<FilterOptions>({
    drive_types: [],
    drive_models: [],
    patterns: [],
    block_sizes: [],
    hostnames: [],
    protocols: [],
  });
  const [activeFilters, setActiveFilters] = useState({
    drive_types: [] as string[],
    drive_models: [] as string[],
    patterns: [] as string[],
    block_sizes: [] as number[],
    hostnames: [] as string[],
    protocols: [] as string[],
  });
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [testRunToEdit, setTestRunToEdit] = useState<TestRun | null>(null);
  const [bulkEditModalOpen, setBulkEditModalOpen] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  useEffect(() => {
    loadTestRuns();
    loadFilters();
  }, [refreshTrigger]);

  useEffect(() => {
    applyFilters();
  }, [testRuns, activeFilters]);

  const loadTestRuns = async () => {
    try {
      const data = await fetchTestRuns();
      setTestRuns(data);
    } catch (error) {
      console.error('Error fetching test runs:', error);
    }
  };

  const loadFilters = async () => {
    try {
      const data = await fetchFilters();
      setFilters(data);
    } catch (error) {
      console.error('Error fetching filters:', error);
    }
  };

  const applyFilters = () => {
    let filtered = testRuns;

    if (activeFilters.drive_types.length > 0) {
      filtered = filtered.filter(run => 
        activeFilters.drive_types.includes(run.drive_type)
      );
    }

    if (activeFilters.drive_models.length > 0) {
      filtered = filtered.filter(run => 
        activeFilters.drive_models.includes(run.drive_model)
      );
    }

    if (activeFilters.patterns.length > 0) {
      filtered = filtered.filter(run => 
        activeFilters.patterns.includes(run.read_write_pattern)
      );
    }

    if (activeFilters.block_sizes.length > 0) {
      filtered = filtered.filter(run => 
        activeFilters.block_sizes.includes(run.block_size)
      );
    }

    if (activeFilters.hostnames.length > 0) {
      filtered = filtered.filter(run => 
        run.hostname && activeFilters.hostnames.includes(run.hostname)
      );
    }

    if (activeFilters.protocols.length > 0) {
      filtered = filtered.filter(run => 
        run.protocol && activeFilters.protocols.includes(run.protocol)
      );
    }

    setFilteredRuns(filtered);
  };

  const handleSelectAllMatching = () => {
    // Get all filtered runs that aren't already selected
    const newRuns = filteredRuns.filter(run => 
      !selectedRuns.some(selected => selected.id === run.id)
    );
    
    // Add them to the current selection
    const updatedSelectedRuns = [...selectedRuns, ...newRuns];
    onSelectionChange(updatedSelectedRuns);
  };

  const hasActiveFilters = () => {
    return activeFilters.drive_types.length > 0 || 
           activeFilters.drive_models.length > 0 || 
           activeFilters.patterns.length > 0 || 
           activeFilters.block_sizes.length > 0 ||
           activeFilters.hostnames.length > 0 ||
           activeFilters.protocols.length > 0;
  };

  const getUnselectedMatchingCount = () => {
    return filteredRuns.filter(run => 
      !selectedRuns.some(selected => selected.id === run.id)
    ).length;
  };

  const handleRunSelection = (selectedOptions: any) => {
    const selected = selectedOptions ? selectedOptions.map((option: any) => option.value) : [];
    onSelectionChange(selected);
  };

  const handleEditTestRun = (testRun: TestRun) => {
    setTestRunToEdit(testRun);
    setEditModalOpen(true);
  };

  const handleSaveTestRun = (updatedTestRun: TestRun) => {
    // Update the test runs list
    setTestRuns(prev => prev.map(run => 
      run.id === updatedTestRun.id ? updatedTestRun : run
    ));
    
    // Update selected runs if this run is selected
    const updatedSelectedRuns = selectedRuns.map(run =>
      run.id === updatedTestRun.id ? updatedTestRun : run
    );
    onSelectionChange(updatedSelectedRuns);
    
    // Refresh filters to include any new drive types/models
    loadFilters();
  };

  const handleBulkSave = (updatedRuns: TestRun[]) => {
    // Update the test runs list with all updated runs
    setTestRuns(prev => {
      const updatedMap = new Map(updatedRuns.map(run => [run.id, run]));
      return prev.map(run => updatedMap.get(run.id) || run);
    });
    
    // Update selected runs with the updated data
    const updatedMap = new Map(updatedRuns.map(run => [run.id, run]));
    const updatedSelectedRuns = selectedRuns.map(run => updatedMap.get(run.id) || run);
    onSelectionChange(updatedSelectedRuns);
    
    // Refresh filters to include any new drive types/models
    loadFilters();
  };

  const handleBulkEdit = () => {
    setBulkEditModalOpen(true);
  };

  const handleDeleteTestRun = async (testRun: TestRun) => {
    if (!confirm(`Are you sure you want to delete the test run "${testRun.test_name}" for ${testRun.drive_model}?`)) {
      return;
    }

    setDeleting(testRun.id);

    try {
      await deleteTestRun(testRun.id);
      
      // Remove from test runs list
      setTestRuns(prev => prev.filter(run => run.id !== testRun.id));
      
      // Remove from selected runs if it was selected
      const updatedSelectedRuns = selectedRuns.filter(run => run.id !== testRun.id);
      onSelectionChange(updatedSelectedRuns);
      
      // Refresh filters
      loadFilters();
    } catch (err) {
      alert('Network error occurred while deleting test run');
    } finally {
      setDeleting(null);
    }
  };

  const runOptions = filteredRuns.map(run => ({
    value: run,
    label: `${run.drive_model} - ${run.test_name} (${new Date(run.timestamp).toLocaleDateString()})`,
  }));

  const selectedOptions = selectedRuns.map(run => ({
    value: run,
    label: `${run.drive_model} - ${run.test_name} (${new Date(run.timestamp).toLocaleDateString()})`,
  }));

  return (
    <div className="theme-card rounded-lg shadow-md p-4 mb-4 border">
      <h2 className="text-lg font-semibold mb-3 flex items-center theme-text-primary">
        <Settings className="mr-2 theme-text-secondary" size={18} />
        Test Run Selection
      </h2>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
        <div>
          <label className="block text-xs font-medium theme-text-secondary mb-1">
            <HardDrive size={14} className="inline mr-1 theme-text-tertiary" />
            Drive Types
          </label>
          <Select
            isMulti
            options={filters.drive_types.map(type => ({ value: type, label: type }))}
            onChange={(selected) => 
              setActiveFilters(prev => ({
                ...prev,
                drive_types: selected ? selected.map(s => s.value) : []
              }))
            }
            placeholder="All drive types"
            className="text-xs"
            styles={getSelectStyles()}
          />
        </div>

        <div>
          <label className="block text-xs font-medium theme-text-secondary mb-1">
            Drive Models
          </label>
          <Select
            isMulti
            options={filters.drive_models.map(model => ({ value: model, label: model }))}
            onChange={(selected) => 
              setActiveFilters(prev => ({
                ...prev,
                drive_models: selected ? selected.map(s => s.value) : []
              }))
            }
            placeholder="All models"
            className="text-xs"
            styles={getSelectStyles()}
          />
        </div>

        <div>
          <label className="block text-xs font-medium theme-text-secondary mb-1">
            Test Patterns
          </label>
          <Select
            isMulti
            options={filters.patterns.map(pattern => ({ 
              value: pattern, 
              label: pattern.replace(/_/g, ' ').toUpperCase() 
            }))}
            onChange={(selected) => 
              setActiveFilters(prev => ({
                ...prev,
                patterns: selected ? selected.map(s => s.value) : []
              }))
            }
            placeholder="All patterns"
            className="text-xs"
            styles={getSelectStyles()}
          />
        </div>

        <div>
          <label className="block text-xs font-medium theme-text-secondary mb-1">
            Block Sizes (KB)
          </label>
          <Select
            isMulti
            options={filters.block_sizes.map(size => ({ value: size, label: `${size}KB` }))}
            onChange={(selected) => 
              setActiveFilters(prev => ({
                ...prev,
                block_sizes: selected ? selected.map(s => s.value) : []
              }))
            }
            placeholder="All sizes"
            className="text-xs"
            styles={getSelectStyles()}
          />
        </div>

        <div>
          <label className="block text-xs font-medium theme-text-secondary mb-1">
            Hostnames
          </label>
          <Select
            isMulti
            options={filters.hostnames.map(hostname => ({ value: hostname, label: hostname }))}
            onChange={(selected) => 
              setActiveFilters(prev => ({
                ...prev,
                hostnames: selected ? selected.map(s => s.value) : []
              }))
            }
            placeholder="All hosts"
            className="text-xs"
            styles={getSelectStyles()}
          />
        </div>

        <div>
          <label className="block text-xs font-medium theme-text-secondary mb-1">
            Protocols
          </label>
          <Select
            isMulti
            options={filters.protocols.map(protocol => ({ value: protocol, label: protocol }))}
            onChange={(selected) => 
              setActiveFilters(prev => ({
                ...prev,
                protocols: selected ? selected.map(s => s.value) : []
              }))
            }
            placeholder="All protocols"
            className="text-xs"
            styles={getSelectStyles()}
          />
        </div>
      </div>

      {/* Test Run Selection */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-medium theme-text-secondary">
            <Calendar size={14} className="inline mr-1 theme-text-tertiary" />
            Select Test Runs ({filteredRuns.length} available)
          </label>
          {hasActiveFilters() && getUnselectedMatchingCount() > 0 && (
            <button
              onClick={handleSelectAllMatching}
              className="inline-flex items-center px-2 py-1 text-xs theme-btn-primary rounded transition-colors"
              title={`Add all ${getUnselectedMatchingCount()} matching test runs`}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add All ({getUnselectedMatchingCount()})
            </button>
          )}
        </div>
        <Select
          isMulti
          options={runOptions}
          value={selectedOptions}
          onChange={handleRunSelection}
          placeholder="Select test runs to compare..."
          className="text-sm"
          maxMenuHeight={150}
          menuPlacement="auto"
          menuShouldScrollIntoView={true}
          styles={{
            ...getSelectStyles(),
            control: (base) => ({
              ...getSelectStyles().control(base),
              maxHeight: '120px',
              overflowY: 'auto'
            }),
            valueContainer: (base) => ({
              ...base,
              maxHeight: '100px',
              overflowY: 'auto'
            }),
            multiValue: (base) => ({
              ...getSelectStyles().multiValue(base),
              fontSize: '0.75rem',
              margin: '1px'
            })
          }}
        />
      </div>

      {/* Selected Runs Preview */}
      {selectedRuns.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-medium theme-text-secondary">
              Selected Runs ({selectedRuns.length}):
            </h3>
            {selectedRuns.length > 1 && (
              <button
                onClick={handleBulkEdit}
                className="inline-flex items-center px-2 py-1 text-xs theme-btn-secondary border rounded transition-colors"
                title="Edit all selected test runs at once"
              >
                <Users className="h-3 w-3 mr-1" />
                Edit All
              </button>
            )}
          </div>
          <div className="max-h-48 overflow-y-auto border theme-border-secondary rounded-md p-2 theme-bg-tertiary">
            <div className={`grid gap-2 grid-cols-${SELECTED_RUNS_COLUMNS.sm} md:grid-cols-${SELECTED_RUNS_COLUMNS.md} lg:grid-cols-${SELECTED_RUNS_COLUMNS.lg} xl:grid-cols-${SELECTED_RUNS_COLUMNS.xl} 2xl:grid-cols-${SELECTED_RUNS_COLUMNS['2xl']}`}>
            {selectedRuns.map(run => (
              <div key={run.id} className="theme-bg-secondary p-2 rounded text-xs relative group border theme-border-primary">
                <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-0.5">
                  <button
                    onClick={() => handleEditTestRun(run)}
                    className="p-0.5 rounded theme-hover"
                    title="Edit drive info"
                    disabled={deleting === run.id}
                  >
                    <Edit2 className="h-2.5 w-2.5 theme-text-secondary" />
                  </button>
                  <button
                    onClick={() => handleDeleteTestRun(run)}
                    className="p-0.5 rounded theme-hover"
                    title="Delete test run"
                    disabled={deleting === run.id}
                  >
                    <Trash2 className="h-2.5 w-2.5 theme-text-error" />
                  </button>
                </div>
                <div className="pl-6">
                  <div className="font-medium theme-text-primary text-xs truncate">{run.drive_model}</div>
                  <div className="theme-text-secondary text-xs truncate">{run.test_name}</div>
                  <div className="theme-text-tertiary text-xs">
                    {run.block_size}KB, QD{run.queue_depth}
                  </div>
                  {(run.hostname || run.protocol) && (
                    <div className="theme-text-tertiary text-xs truncate mt-0.5">
                      {run.hostname && <span>📡 {run.hostname}</span>}
                      {run.hostname && run.protocol && <span className="mx-1">•</span>}
                      {run.protocol && <span>🔗 {run.protocol}</span>}
                    </div>
                  )}
                  <div className="theme-text-tertiary mt-0.5">
                    <span className="inline-block px-1 py-0.5 theme-bg-accent theme-text-accent rounded text-xs">
                      {run.drive_type}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            </div>
          </div>
        </div>
      )}
      
      <EditTestRunModal
        testRun={testRunToEdit}
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setTestRunToEdit(null);
        }}
        onSave={handleSaveTestRun}
      />
      
      <BulkEditModal
        testRuns={selectedRuns}
        isOpen={bulkEditModalOpen}
        onClose={() => setBulkEditModalOpen(false)}
        onSave={handleBulkSave}
      />
    </div>
  );
};

export default TestRunSelector;