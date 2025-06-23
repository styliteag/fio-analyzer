import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';
import { Upload as UploadIcon, Check, AlertCircle, ArrowLeft, FileText } from 'lucide-react';

export default function Upload() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [driveModel, setDriveModel] = useState('');
  const [driveType, setDriveType] = useState('');
  const [customDriveType, setCustomDriveType] = useState('');
  const [showCustomType, setShowCustomType] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setMessage(null);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      setMessage({ type: 'error', text: 'Please select a FIO JSON file' });
      return;
    }

    setUploading(true);
    
    const finalDriveType = showCustomType ? customDriveType : driveType;
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('drive_model', driveModel || 'Unknown');
      formData.append('drive_type', finalDriveType || 'Unknown');

      const response = await fetch('http://localhost:8000/api/import', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: 'FIO results imported successfully!' });
        setFile(null);
        setDriveModel('');
        setDriveType('');
        setCustomDriveType('');
        setShowCustomType(false);
        
        // Reset file input
        const fileInput = document.getElementById('file-input') as HTMLInputElement;
        if (fileInput) fileInput.value = '';

        // Navigate back to home after 2 seconds
        setTimeout(() => {
          navigate('/');
        }, 2000);
      } else {
        setMessage({ type: 'error', text: result.error || 'Import failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error occurred' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => navigate('/')}
              className="flex items-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back to Dashboard
            </button>
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <div className="flex items-center">
                <UploadIcon className="h-8 w-8 text-blue-600 dark:text-blue-400 mr-3" />
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Upload FIO Results</h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          {/* Instructions */}
          <div className="mb-8">
            <div className="flex items-center mb-4">
              <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Import Benchmark Data</h2>
            </div>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Upload FIO JSON output files to analyze storage performance metrics. The system will automatically 
              extract IOPS, latency, throughput, and detailed percentile data from your benchmark results.
            </p>
            
            {/* FIO Command Examples */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-6">
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Generate FIO JSON files with these commands:</h3>
              <div className="space-y-2 text-sm font-mono text-gray-700 dark:text-gray-300">
                <div className="bg-white dark:bg-gray-800 p-2 rounded border dark:border-gray-600">
                  <div className="text-gray-500 dark:text-gray-400 text-xs mb-1"># Sequential read test</div>
                  <div>fio --name=seqread --rw=read --bs=64k --iodepth=16 --runtime=60 --time_based --output-format=json --output=results.json</div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-2 rounded border dark:border-gray-600">
                  <div className="text-gray-500 dark:text-gray-400 text-xs mb-1"># Random mixed workload</div>
                  <div>fio --name=randtest --rw=randrw --rwmixread=70 --bs=4k --iodepth=32 --runtime=120 --time_based --output-format=json --output=results.json</div>
                </div>
              </div>
            </div>
          </div>

          {/* Upload Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* File Upload */}
            <div>
              <label htmlFor="file-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                FIO JSON Results File *
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg hover:border-gray-400 dark:hover:border-gray-500 transition-colors">
                <div className="space-y-1 text-center">
                  <UploadIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
                  <div className="flex text-sm text-gray-600 dark:text-gray-300">
                    <label
                      htmlFor="file-input"
                      className="relative cursor-pointer bg-white dark:bg-gray-800 rounded-md font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
                    >
                      <span>Upload a file</span>
                      <input
                        id="file-input"
                        name="file-upload"
                        type="file"
                        accept=".json"
                        className="sr-only"
                        onChange={handleFileChange}
                      />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">JSON files only</p>
                </div>
              </div>
              {file && (
                <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                  Selected: <span className="font-medium">{file.name}</span>
                </div>
              )}
            </div>

            {/* Drive Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="drive-model" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Drive Model
                </label>
                <input
                  id="drive-model"
                  type="text"
                  value={driveModel}
                  onChange={(e) => setDriveModel(e.target.value)}
                  placeholder="e.g., Samsung 980 PRO"
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Optional: Specify the storage device model</p>
              </div>

              <div>
                <label htmlFor="drive-type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Drive Type
                </label>
                {!showCustomType ? (
                  <select
                    id="drive-type"
                    value={driveType}
                    onChange={(e) => handleDriveTypeChange(e.target.value)}
                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
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
                      className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setShowCustomType(false);
                        setCustomDriveType('');
                        setDriveType('');
                      }}
                      className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-500"
                    >
                      Cancel
                    </button>
                  </div>
                )}
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Optional: Categorize the storage device</p>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex items-center justify-between pt-6">
              <button
                type="submit"
                disabled={!file || uploading}
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {uploading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                    Importing Results...
                  </>
                ) : (
                  <>
                    <UploadIcon className="h-5 w-5 mr-3" />
                    Import FIO Results
                  </>
                )}
              </button>

              {message && (
                <div className={`flex items-center ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                  {message.type === 'success' ? (
                    <Check className="h-5 w-5 mr-2" />
                  ) : (
                    <AlertCircle className="h-5 w-5 mr-2" />
                  )}
                  <span className="font-medium">{message.text}</span>
                </div>
              )}
            </div>
          </form>

          {/* Success Message */}
          {message?.type === 'success' && (
            <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex">
                <Check className="h-5 w-5 text-green-400 mr-3 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-green-800">Import Successful!</h3>
                  <p className="text-sm text-green-700 mt-1">
                    Your FIO results have been processed and stored. Redirecting to dashboard...
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}