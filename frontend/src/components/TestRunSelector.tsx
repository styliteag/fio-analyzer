import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import { TestRun, FilterOptions } from '../types';
import { Calendar, HardDrive, Settings, Edit2, Trash2 } from 'lucide-react';
import EditTestRunModal from './EditTestRunModal';
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
  const [testRuns, setTestRuns] = useState<TestRun[]>([]);
  const [filteredRuns, setFilteredRuns] = useState<TestRun[]>([]);
  const [filters, setFilters] = useState<FilterOptions>({
    drive_types: [],
    drive_models: [],
    patterns: [],
    block_sizes: [],
  });
  const [activeFilters, setActiveFilters] = useState({
    drive_types: [] as string[],
    drive_models: [] as string[],
    patterns: [] as string[],
    block_sizes: [] as number[],
  });
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [testRunToEdit, setTestRunToEdit] = useState<TestRun | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  useEffect(() => {
    fetchTestRuns();
    fetchFilters();
  }, [refreshTrigger]);

  useEffect(() => {
    applyFilters();
  }, [testRuns, activeFilters]);

  const fetchTestRuns = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/test-runs');
      const data = await response.json();
      setTestRuns(data);
    } catch (error) {
      console.error('Error fetching test runs:', error);
    }
  };

  const fetchFilters = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/filters');
      const data = await response.json();
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

    setFilteredRuns(filtered);
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
    fetchFilters();
  };

  const handleDeleteTestRun = async (testRun: TestRun) => {
    if (!confirm(`Are you sure you want to delete the test run "${testRun.test_name}" for ${testRun.drive_model}?`)) {
      return;
    }

    setDeleting(testRun.id);

    try {
      const response = await fetch(`http://localhost:8000/api/test-runs/${testRun.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Remove from test runs list
        setTestRuns(prev => prev.filter(run => run.id !== testRun.id));
        
        // Remove from selected runs if it was selected
        const updatedSelectedRuns = selectedRuns.filter(run => run.id !== testRun.id);
        onSelectionChange(updatedSelectedRuns);
        
        // Refresh filters
        fetchFilters();
      } else {
        const result = await response.json();
        alert(result.error || 'Failed to delete test run');
      }
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
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
      </div>

      {/* Test Run Selection */}
      <div>
        <label className="block text-xs font-medium theme-text-secondary mb-1">
          <Calendar size={14} className="inline mr-1 theme-text-tertiary" />
          Select Test Runs ({filteredRuns.length} available)
        </label>
        <Select
          isMulti
          options={runOptions}
          value={selectedOptions}
          onChange={handleRunSelection}
          placeholder="Select test runs to compare..."
          className="text-sm"
          maxMenuHeight={200}
          styles={getSelectStyles()}
        />
      </div>

      {/* Selected Runs Preview */}
      {selectedRuns.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-medium theme-text-secondary mb-1">
            Selected Runs ({selectedRuns.length}):
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
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
    </div>
  );
};

export default TestRunSelector;