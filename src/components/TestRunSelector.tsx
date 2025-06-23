import React, { useState, useEffect } from "react";
import Select from "react-select";
import { TestRun, FilterOptions } from "../types";
import { Calendar, HardDrive, Settings, WifiOff } from "lucide-react";
import { apiService } from "../services/apiService";

interface TestRunSelectorProps {
  selectedRuns: TestRun[];
  onSelectionChange: (runs: TestRun[]) => void;
}

const TestRunSelector: React.FC<TestRunSelectorProps> = ({
  selectedRuns,
  onSelectionChange,
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

  useEffect(() => {
    fetchTestRuns();
    fetchFilters();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [testRuns, activeFilters]);

  const fetchTestRuns = async () => {
    try {
      const response = await fetch("http://localhost:8000/api/test-runs");
      const data = await response.json();
      setTestRuns(data);
    } catch (error) {
      console.error("Error fetching test runs:", error);
    }
  };

  const fetchFilters = async () => {
    try {
      const response = await fetch("http://localhost:8000/api/filters");
      const data = await response.json();
      setFilters(data);
    } catch (error) {
      console.error("Error fetching filters:", error);
    }
  };

  const applyFilters = () => {
    let filtered = testRuns;

    if (activeFilters.drive_types.length > 0) {
      filtered = filtered.filter((run) =>
        activeFilters.drive_types.includes(run.drive_type),
      );
    }

    if (activeFilters.drive_models.length > 0) {
      filtered = filtered.filter((run) =>
        activeFilters.drive_models.includes(run.drive_model),
      );
    }

    if (activeFilters.patterns.length > 0) {
      filtered = filtered.filter((run) =>
        activeFilters.patterns.includes(run.read_write_pattern),
      );
    }

    if (activeFilters.block_sizes.length > 0) {
      filtered = filtered.filter((run) =>
        activeFilters.block_sizes.includes(run.block_size),
      );
    }

    setFilteredRuns(filtered);
  };

  const handleRunSelection = (selectedOptions: any) => {
    const selected = selectedOptions
      ? selectedOptions.map((option: any) => option.value)
      : [];
    onSelectionChange(selected);
  };

  const runOptions = filteredRuns.map((run) => ({
    value: run,
    label: `${run.drive_model} - ${run.test_name} (${new Date(run.timestamp).toLocaleDateString()})`,
  }));

  const selectedOptions = selectedRuns.map((run) => ({
    value: run,
    label: `${run.drive_model} - ${run.test_name} (${new Date(run.timestamp).toLocaleDateString()})`,
  }));

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-xl font-semibold mb-4 flex items-center">
        <Settings className="mr-2" size={20} />
        Test Run Selection
      </h2>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <HardDrive size={16} className="inline mr-1" />
            Drive Types
          </label>
          <Select
            isMulti
            options={filters.drive_types.map((type) => ({
              value: type,
              label: type,
            }))}
            onChange={(selected) =>
              setActiveFilters((prev) => ({
                ...prev,
                drive_types: selected ? selected.map((s) => s.value) : [],
              }))
            }
            placeholder="All drive types"
            className="text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Drive Models
          </label>
          <Select
            isMulti
            options={filters.drive_models.map((model) => ({
              value: model,
              label: model,
            }))}
            onChange={(selected) =>
              setActiveFilters((prev) => ({
                ...prev,
                drive_models: selected ? selected.map((s) => s.value) : [],
              }))
            }
            placeholder="All models"
            className="text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Test Patterns
          </label>
          <Select
            isMulti
            options={filters.patterns.map((pattern) => ({
              value: pattern,
              label: pattern.replace(/_/g, " ").toUpperCase(),
            }))}
            onChange={(selected) =>
              setActiveFilters((prev) => ({
                ...prev,
                patterns: selected ? selected.map((s) => s.value) : [],
              }))
            }
            placeholder="All patterns"
            className="text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Block Sizes (KB)
          </label>
          <Select
            isMulti
            options={filters.block_sizes.map((size) => ({
              value: size,
              label: `${size}KB`,
            }))}
            onChange={(selected) =>
              setActiveFilters((prev) => ({
                ...prev,
                block_sizes: selected ? selected.map((s) => s.value) : [],
              }))
            }
            placeholder="All sizes"
            className="text-sm"
          />
        </div>
      </div>

      {/* Test Run Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <Calendar size={16} className="inline mr-1" />
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
        />
      </div>

      {/* Selected Runs Preview */}
      {selectedRuns.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            Selected Runs ({selectedRuns.length}):
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {selectedRuns.map((run) => (
              <div key={run.id} className="bg-gray-50 p-3 rounded text-xs">
                <div className="font-medium">{run.drive_model}</div>
                <div className="text-gray-600">{run.test_name}</div>
                <div className="text-gray-500">
                  {run.block_size}KB, QD{run.queue_depth}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TestRunSelector;
