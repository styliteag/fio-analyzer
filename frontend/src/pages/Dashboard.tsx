import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TestRunSelector from '../components/TestRunSelector';
import TemplateSelector from '../components/TemplateSelector';
import InteractiveChart from '../components/InteractiveChart';
import ThemeToggle from '../components/ThemeToggle';
import { TestRun, ChartTemplate, PerformanceData } from '../types';
import { Activity, Database, Upload } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const [selectedRuns, setSelectedRuns] = useState<TestRun[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ChartTemplate | null>(null);
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (selectedRuns.length > 0 && selectedTemplate) {
      fetchPerformanceData();
    }
  }, [selectedRuns, selectedTemplate]);

  useEffect(() => {
    // Refresh data when navigating back to dashboard
    const handleFocus = () => {
      setRefreshTrigger(prev => prev + 1);
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const fetchPerformanceData = async () => {
    if (selectedRuns.length === 0) return;

    setLoading(true);
    try {
      const runIds = selectedRuns.map(run => run.id).join(',');
      const metrics = selectedTemplate?.metrics.join(',') || 'iops,avg_latency,throughput';
      
      const response = await fetch(
        `http://localhost:8000/api/performance-data?test_run_ids=${runIds}&metric_types=${metrics}`
      );
      const data = await response.json();
      setPerformanceData(data);
    } catch (error) {
      console.error('Error fetching performance data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-blue-600 dark:text-blue-400 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Storage Performance Visualizer
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <button
                onClick={() => navigate('/upload')}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </button>
              <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                <Database className="h-4 w-4 mr-1" />
                FIO Benchmark Analysis
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Test Run Selection */}
        <div className="w-full mb-8">
          <TestRunSelector
            selectedRuns={selectedRuns}
            onSelectionChange={setSelectedRuns}
            refreshTrigger={refreshTrigger}
          />
        </div>

        {/* Two Column Layout for Templates and Graphs */}
        <div className="w-full grid grid-cols-10 gap-8">
          {/* Left Column - Templates (30%) */}
          <div className="col-span-3">
            <TemplateSelector
              selectedTemplate={selectedTemplate}
              onTemplateSelect={setSelectedTemplate}
            />
          </div>

          {/* Right Column - Chart (70%) */}
          <div className="col-span-7">
            {selectedTemplate && (
              <div className="relative">
                {loading && (
                  <div className="absolute inset-0 bg-white dark:bg-gray-800 bg-opacity-75 dark:bg-opacity-75 flex items-center justify-center z-10 rounded-lg">
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400 mr-3"></div>
                      <span className="text-gray-600 dark:text-gray-300">Loading performance data...</span>
                    </div>
                  </div>
                )}
                <InteractiveChart
                  template={selectedTemplate}
                  data={performanceData}
                />
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        {selectedRuns.length === 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 text-center mt-8">
            <Activity className="h-12 w-12 text-blue-400 dark:text-blue-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-blue-900 dark:text-blue-200 mb-2">
              Get Started with Performance Analysis
            </h3>
            <p className="text-blue-700 dark:text-blue-300 mb-4">
              Select test runs from the dropdown above to begin visualizing your storage performance data.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="bg-white dark:bg-gray-800 p-4 rounded border border-blue-200 dark:border-blue-800">
                <div className="font-medium text-blue-900 dark:text-blue-200 mb-1">1. Select Test Runs</div>
                <div className="text-blue-700 dark:text-blue-300">Choose benchmark results to compare</div>
              </div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded border border-blue-200 dark:border-blue-800">
                <div className="font-medium text-blue-900 dark:text-blue-200 mb-1">2. Pick a Template</div>
                <div className="text-blue-700 dark:text-blue-300">Select visualization type for your analysis</div>
              </div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded border border-blue-200 dark:border-blue-800">
                <div className="font-medium text-blue-900 dark:text-blue-200 mb-1">3. Analyze Results</div>
                <div className="text-blue-700 dark:text-blue-300">Interactive charts with export options</div>
              </div>
            </div>
            
            <div className="mt-6">
              <button
                onClick={() => navigate('/upload')}
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <Upload className="h-5 w-5 mr-2" />
                Upload FIO Results
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-sm text-gray-600 dark:text-gray-300">
            <p>Storage Performance Visualizer - Analyze FIO benchmark results with interactive charts</p>
            <p className="mt-1">Features: Multi-drive comparison, latency analysis, throughput trends, and more</p>
          </div>
        </div>
      </footer>
    </div>
  );
}