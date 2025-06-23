import { useState, useEffect } from 'react';
import { TestRun } from '../types';
import { X, Save, AlertCircle } from 'lucide-react';

interface EditTestRunModalProps {
  testRun: TestRun | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (testRun: TestRun) => void;
}

export default function EditTestRunModal({ testRun, isOpen, onClose, onSave }: EditTestRunModalProps) {
  const [driveModel, setDriveModel] = useState('');
  const [driveType, setDriveType] = useState('');
  const [customDriveType, setCustomDriveType] = useState('');
  const [showCustomType, setShowCustomType] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (testRun) {
      setDriveModel(testRun.drive_model);
      setDriveType(testRun.drive_type);
      setCustomDriveType('');
      setShowCustomType(false);
      setError(null);
    }
  }, [testRun]);

  const handleSave = async () => {
    if (!testRun) return;

    setSaving(true);
    setError(null);

    const finalDriveType = showCustomType ? customDriveType : driveType;

    try {
      const response = await fetch(`http://localhost:8000/api/test-runs/${testRun.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          drive_model: driveModel,
          drive_type: finalDriveType,
        }),
      });

      if (response.ok) {
        const updatedTestRun = { ...testRun, drive_model: driveModel, drive_type: finalDriveType };
        onSave(updatedTestRun);
        onClose();
      } else {
        const result = await response.json();
        setError(result.error || 'Failed to update test run');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) {
      onClose();
      setError(null);
    }
  };

  const handleDriveTypeChange = (value: string) => {
    if (value === 'custom') {
      setShowCustomType(true);
      setDriveType('');
    } else {
      setShowCustomType(false);
      setDriveType(value);
      setCustomDriveType('');
    }
  };

  if (!isOpen || !testRun) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-lg font-medium text-gray-900">Edit Test Run</h3>
          <button
            onClick={handleClose}
            disabled={saving}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Test Run Info */}
          <div className="bg-gray-50 rounded-lg p-4 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div><span className="font-medium">Test:</span> {testRun.test_name}</div>
              <div><span className="font-medium">Block Size:</span> {testRun.block_size}k</div>
              <div><span className="font-medium">Pattern:</span> {testRun.read_write_pattern}</div>
              <div><span className="font-medium">Queue Depth:</span> {testRun.queue_depth}</div>
            </div>
          </div>

          {/* Drive Model */}
          <div>
            <label htmlFor="drive-model" className="block text-sm font-medium text-gray-700 mb-1">
              Drive Model
            </label>
            <input
              id="drive-model"
              type="text"
              value={driveModel}
              onChange={(e) => setDriveModel(e.target.value)}
              placeholder="e.g., Samsung 980 PRO"
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              disabled={saving}
            />
          </div>

          {/* Drive Type */}
          <div>
            <label htmlFor="drive-type" className="block text-sm font-medium text-gray-700 mb-1">
              Drive Type
            </label>
            {!showCustomType ? (
              <select
                id="drive-type"
                value={driveType}
                onChange={(e) => handleDriveTypeChange(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                disabled={saving}
              >
                <option value="">Select type</option>
                <option value="NVMe SSD">NVMe SSD</option>
                <option value="SATA SSD">SATA SSD</option>
                <option value="HDD">HDD</option>
                <option value="Optane">Optane</option>
                <option value="eUFS">eUFS</option>
                <option value="eMMC">eMMC</option>
                <option value="SD Card">SD Card</option>
                <option value="custom">+ Add Custom Type</option>
              </select>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customDriveType}
                  onChange={(e) => setCustomDriveType(e.target.value)}
                  placeholder="Enter custom drive type"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  disabled={saving}
                />
                <button
                  type="button"
                  onClick={() => {
                    setShowCustomType(false);
                    setCustomDriveType('');
                    setDriveType('');
                  }}
                  className="px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center p-3 text-sm text-red-800 bg-red-50 border border-red-200 rounded-md">
              <AlertCircle className="h-4 w-4 mr-2" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={handleClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || (!driveModel && !driveType && !customDriveType)}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}