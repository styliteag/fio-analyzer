import React, { useState, useEffect, useCallback } from 'react';
import { Edit2, Search, RefreshCw, X, Check, Trash2 } from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import Loading from '../components/ui/Loading';
import ErrorDisplay from '../components/ui/ErrorDisplay';
import { useTestRuns } from '../hooks/api/useTestRuns';
import type { TestRun } from '../types';

interface EditableFields {
  hostname?: string;
  protocol?: string;
  description?: string;
  drive_type?: string;
  drive_model?: string;
}

interface EditingState {
  testRunId: number | null;
  fields: EditableFields;
}

const Admin: React.FC = () => {
  const { testRuns, loading, error, refreshTestRuns, updateTestRun, bulkUpdateTestRuns, bulkDeleteTestRuns } = useTestRuns();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRuns, setSelectedRuns] = useState<Set<number>>(new Set());
  const [editingState, setEditingState] = useState<EditingState>({ testRunId: null, fields: {} });
  const [bulkEditModalOpen, setBulkEditModalOpen] = useState(false);
  const [bulkEditFields, setBulkEditFields] = useState<EditableFields>({});
  const [bulkEditEnabled, setBulkEditEnabled] = useState<Record<keyof EditableFields, boolean>>({
    hostname: false,
    protocol: false,
    description: false,
    drive_type: false,
    drive_model: false,
  });
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [sortField, setSortField] = useState<keyof TestRun>('timestamp');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    refreshTestRuns(true); // Include historical data for admin view
  }, [refreshTestRuns]);

  const filteredRuns = testRuns.filter(run => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      run.hostname?.toLowerCase().includes(searchLower) ||
      run.protocol?.toLowerCase().includes(searchLower) ||
      run.drive_model?.toLowerCase().includes(searchLower) ||
      run.drive_type?.toLowerCase().includes(searchLower) ||
      run.read_write_pattern?.toLowerCase().includes(searchLower)
    );
  });

  const sortedRuns = [...filteredRuns].sort((a, b) => {
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

  const handleSort = (field: keyof TestRun) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleSelectAll = useCallback(() => {
    if (selectedRuns.size === sortedRuns.length) {
      setSelectedRuns(new Set());
    } else {
      setSelectedRuns(new Set(sortedRuns.map(run => run.id)));
    }
  }, [selectedRuns.size, sortedRuns]);

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
        description: run.test_name || '',
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

  const handleBulkEdit = async () => {
    if (selectedRuns.size === 0) return;
    
    // Only include fields that are enabled for update
    const fieldsToUpdate: EditableFields = {};
    Object.entries(bulkEditEnabled).forEach(([field, enabled]) => {
      if (enabled && bulkEditFields[field as keyof EditableFields]) {
        fieldsToUpdate[field as keyof EditableFields] = bulkEditFields[field as keyof EditableFields];
      }
    });
    
    try {
      await bulkUpdateTestRuns(Array.from(selectedRuns), fieldsToUpdate);
      setBulkEditModalOpen(false);
      setBulkEditFields({});
      setBulkEditEnabled({
        hostname: false,
        protocol: false,
        description: false,
        drive_type: false,
        drive_model: false,
      });
      setSelectedRuns(new Set());
      refreshTestRuns(true);
    } catch (err) {
      console.error('Failed to bulk update test runs:', err);
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
      description: getMostCommonValue(selectedTestRuns.map(run => run.test_name)),
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
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Search test runs..."
                  value={searchTerm}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              <Button
                onClick={() => refreshTestRuns(true)}
                variant="secondary"
                size="sm"
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
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
                    Hostname
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Protocol
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Drive Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Drive Model
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {sortedRuns.map((run) => {
                  const isEditing = editingState.testRunId === run.id;
                  return (
                    <tr key={run.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedRuns.has(run.id)}
                          onChange={() => handleSelectRun(run.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{run.id}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {new Date(run.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <Input
                            value={editingState.fields.hostname || ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateEditField('hostname', e.target.value)}
                            className="w-full"
                            size="sm"
                          />
                        ) : (
                          <span className="text-sm text-gray-900 dark:text-white">{run.hostname || '-'}</span>
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
                          <span className="text-sm text-gray-900 dark:text-white">{run.protocol || '-'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <Input
                            value={editingState.fields.description || ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateEditField('description', e.target.value)}
                            className="w-full"
                            size="sm"
                          />
                        ) : (
                          <span className="text-sm text-gray-900 dark:text-white">{run.test_name || '-'}</span>
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
                          <span className="text-sm text-gray-900 dark:text-white">{run.drive_type || '-'}</span>
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
                          <span className="text-sm text-gray-900 dark:text-white">{run.drive_model || '-'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
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
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Results summary */}
        <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          Showing {sortedRuns.length} of {testRuns.length} test runs
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