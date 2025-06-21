import { useState, useEffect } from 'react';
import TestRunSelector from './components/TestRunSelector';
import TemplateSelector from './components/TemplateSelector';
import InteractiveChart from './components/InteractiveChart';
import { TestRun, ChartTemplate, PerformanceData } from './types';
import { Activity, Database } from 'lucide-react';

function App() {
  const [selectedRuns, setSelectedRuns] = useState<TestRun[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ChartTemplate | null>(null);
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedRuns.length > 0 && selectedTemplate) {
      fetchPerformanceData();
    }
  }, [selectedRuns, selectedTemplate]);

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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">
                Storage Performance Visualizer
              </h1>
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <Database className="h-4 w-4 mr-1" />
              FIO Benchmark Analysis
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-4 lg:gap-6">
          <div className="lg:col-span-1 space-y-6">
            {/* Test Run Selection */}
            <TestRunSelector
              selectedRuns={selectedRuns}
              onSelectionChange={setSelectedRuns}
            />

            {/* Template Selection */}
            <TemplateSelector
              selectedTemplate={selectedTemplate}
              onTemplateSelect={setSelectedTemplate}
            />
          </div>

          <div className="mt-6 lg:mt-0 lg:col-span-3">
            {/* Chart Display */}
            {selectedTemplate && (
              <div className="relative">
                {loading && (
                  <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10 rounded-lg">
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
                      <span className="text-gray-600">Loading performance data...</span>
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
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
            <Activity className="h-12 w-12 text-blue-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-blue-900 mb-2">
              Get Started with Performance Analysis
            </h3>
            <p className="text-blue-700 mb-4">
              Select test runs from the dropdown above to begin visualizing your storage performance data.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="bg-white p-4 rounded border border-blue-200">
                <div className="font-medium text-blue-900 mb-1">1. Select Test Runs</div>
                <div className="text-blue-700">Choose benchmark results to compare</div>
              </div>
              <div className="bg-white p-4 rounded border border-blue-200">
                <div className="font-medium text-blue-900 mb-1">2. Pick a Template</div>
                <div className="text-blue-700">Select visualization type for your analysis</div>
              </div>
              <div className="bg-white p-4 rounded border border-blue-200">
                <div className="font-medium text-blue-900 mb-1">3. Analyze Results</div>
                <div className="text-blue-700">Interactive charts with export options</div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-sm text-gray-600">
            <p>Storage Performance Visualizer - Analyze FIO benchmark results with interactive charts</p>
            <p className="mt-1">Features: Multi-drive comparison, latency analysis, throughput trends, and more</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;