import { useState, useEffect } from "react";
import TestRunSelector from "./components/TestRunSelector";
import TemplateSelector from "./components/TemplateSelector";
import InteractiveChart from "./components/InteractiveChart";
import { TestRun, ChartTemplate, PerformanceData } from "./types";
import { Activity, Database, Wifi, WifiOff, RefreshCw } from "lucide-react";
import { apiService } from "./services/apiService";

function App() {
  const [selectedRuns, setSelectedRuns] = useState<TestRun[]>([]);
  const [selectedTemplate, setSelectedTemplate] =
    useState<ChartTemplate | null>(null);
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [isUsingMockData, setIsUsingMockData] = useState(false);
  const [retryingConnection, setRetryingConnection] = useState(false);

  useEffect(() => {
    if (selectedRuns.length > 0 && selectedTemplate) {
      fetchPerformanceData();
    }
  }, [selectedRuns, selectedTemplate]);

  const fetchPerformanceData = async () => {
    if (selectedRuns.length === 0) return;

    setLoading(true);
    try {
      const runIds = selectedRuns.map((run) => run.id);
      const metrics = selectedTemplate?.metrics || [
        "iops",
        "avg_latency",
        "throughput",
      ];

      const result = await apiService.getPerformanceData(runIds, metrics);
      setPerformanceData(result.data);
      setIsUsingMockData(result.isUsingMockData);
    } catch (error) {
      console.error("Error fetching performance data:", error);
      setPerformanceData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRetryConnection = async () => {
    setRetryingConnection(true);
    try {
      const isBackendAvailable = await apiService.forceBackendCheck();

      if (isBackendAvailable && selectedRuns.length > 0 && selectedTemplate) {
        // If backend is now available and we have selections, refetch data
        await fetchPerformanceData();
      }
    } catch (error) {
      console.error("Error retrying connection:", error);
    } finally {
      setRetryingConnection(false);
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
            <div className="flex items-center space-x-4">
              <div className="flex items-center text-sm text-gray-600">
                <Database className="h-4 w-4 mr-1" />
                FIO Benchmark Analysis
              </div>
              {isUsingMockData && (
                <div className="flex items-center space-x-2">
                  <div className="flex items-center text-sm text-amber-600 bg-amber-50 px-2 py-1 rounded-md border border-amber-200">
                    <WifiOff className="h-4 w-4 mr-1" />
                    Demo Mode
                  </div>
                  <button
                    onClick={handleRetryConnection}
                    disabled={retryingConnection}
                    className="flex items-center text-sm text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-md border border-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Try to reconnect to backend"
                  >
                    <RefreshCw
                      className={`h-4 w-4 mr-1 ${retryingConnection ? "animate-spin" : ""}`}
                    />
                    {retryingConnection ? "Connecting..." : "Retry Connection"}
                  </button>
                </div>
              )}
              {!isUsingMockData && performanceData.length > 0 && (
                <div className="flex items-center text-sm text-green-600 bg-green-50 px-2 py-1 rounded-md border border-green-200">
                  <Wifi className="h-4 w-4 mr-1" />
                  Live Data
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Full Width */}
      <main className="w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Test Run Selection - Full Width */}
        <div className="w-full mb-8">
          <TestRunSelector
            selectedRuns={selectedRuns}
            onSelectionChange={setSelectedRuns}
          />
        </div>

        {/* Two Column Layout for Templates and Graphs - Full Width */}
        <div className="w-full grid grid-cols-10 gap-8">
          {/* Left Column - Templates (30%) */}
          <div className="col-span-3 bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Templates
            </h2>
            <TemplateSelector
              selectedTemplate={selectedTemplate}
              onTemplateSelect={setSelectedTemplate}
            />
          </div>

          {/* Right Column - Graphs (70%) */}
          <div className="col-span-7 bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Graphs</h2>
            {selectedTemplate ? (
              <div className="relative">
                {loading && (
                  <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10 rounded-lg">
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
                      <span className="text-gray-600">
                        Loading performance data...
                      </span>
                    </div>
                  </div>
                )}
                <InteractiveChart
                  template={selectedTemplate}
                  data={performanceData}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                <div className="text-center">
                  <Activity className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>Select a template to view charts</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Instructions - Full Width */}
        {selectedRuns.length === 0 && (
          <div className="max-w-7xl mx-auto mt-8">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
              <Activity className="h-12 w-12 text-blue-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-blue-900 mb-2">
                Get Started with Performance Analysis
              </h3>
              <p className="text-blue-700 mb-4">
                Select test runs from the dropdown above to begin visualizing
                your storage performance data.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="bg-white p-4 rounded border border-blue-200">
                  <div className="font-medium text-blue-900 mb-1">
                    1. Select Test Runs
                  </div>
                  <div className="text-blue-700">
                    Choose benchmark results to compare
                  </div>
                </div>
                <div className="bg-white p-4 rounded border border-blue-200">
                  <div className="font-medium text-blue-900 mb-1">
                    2. Pick a Template
                  </div>
                  <div className="text-blue-700">
                    Select visualization type for your analysis
                  </div>
                </div>
                <div className="bg-white p-4 rounded border border-blue-200">
                  <div className="font-medium text-blue-900 mb-1">
                    3. Analyze Results
                  </div>
                  <div className="text-blue-700">
                    Interactive charts with export options
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-sm text-gray-600">
            <p>
              Storage Performance Visualizer - Analyze FIO benchmark results
              with interactive charts
            </p>
            <p className="mt-1">
              Features: Multi-drive comparison, latency analysis, throughput
              trends, and more
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
