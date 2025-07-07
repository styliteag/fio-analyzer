import { useState, useEffect, useCallback, useMemo } from 'react';
import { DashboardHeader } from '../components/layout';
import { fetchTestRuns } from '../services/api/testRuns';
import { fetchPerformanceData } from '../services/api/performance';
import { createComparableConfigurations } from '../utils/configurationMatcher';
import HostSelector from '../components/HostSelector';
import ConfigurationCard from '../components/ConfigurationCard';
import MultiChartGrid from '../components/MultiChartGrid';
import Loading from '../components/ui/Loading';
import ErrorDisplay from '../components/ui/ErrorDisplay';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { RefreshCw, Search, Filter, BarChart3, AlertCircle } from 'lucide-react';
import type { PerformanceData } from '../types';
import type { ConfigurationComparison } from '../utils/configurationMatcher';

export default function Compare2() {
  // State management
  const [selectedHosts, setSelectedHosts] = useState<string[]>([]);
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [comparisons, setComparisons] = useState<ConfigurationComparison[]>([]);
  const [selectedComparisonIndex, setSelectedComparisonIndex] = useState(0);
  const [minCoverage, setMinCoverage] = useState(0.3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Helper function to extract hostname from unique value
  const extractHostname = useCallback((uniqueValue: string): string => {
    return uniqueValue.split('|')[0];
  }, []);

  // Load data when hosts change
  const loadData = useCallback(async () => {
    if (selectedHosts.length < 2) {
      setPerformanceData([]);
      setComparisons([]);
      setSelectedComparisonIndex(0);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Extract actual hostnames from unique values
      const actualHostnames = selectedHosts.map(extractHostname);
      // Fetch test runs for selected hosts (latest per config only)
      const runsRes = await fetchTestRuns({
        hostnames: actualHostnames,
        includeHistorical: false
      });

      if (runsRes.error) {
        throw new Error(runsRes.error);
      }

      const runs = runsRes.data || [];
      if (runs.length === 0) {
        setPerformanceData([]);
        setComparisons([]);
        setSelectedComparisonIndex(0);
        setLoading(false);
        return;
      }

      // Fetch performance data for these runs
      const runIds = runs.map(run => run.id);
      const perfRes = await fetchPerformanceData({ testRunIds: runIds });

      if (perfRes.error) {
        throw new Error(perfRes.error);
      }

      const perfData = perfRes.data || [];
      setPerformanceData(perfData);

      // Create comparable configurations (use actual hostnames)
      const configComparisons = createComparableConfigurations(
        perfData,
        actualHostnames,
        minCoverage
      );

      setComparisons(configComparisons);
      setSelectedComparisonIndex(0);

    } catch (err: any) {
      setError(err.message || 'Failed to load comparison data');
      setPerformanceData([]);
      setComparisons([]);
      setSelectedComparisonIndex(0);
    } finally {
      setLoading(false);
    }
  }, [selectedHosts, minCoverage, extractHostname]);

  // Load data when dependencies change
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter configurations based on search term
  const filteredComparisons = useMemo(() => {
    if (!searchTerm.trim()) return comparisons;
    
    const term = searchTerm.toLowerCase();
    return comparisons.filter(comparison => {
      const config = comparison.config;
      const searchText = [
        config.block_size,
        config.read_write_pattern,
        config.protocol,
        config.drive_model,
        config.drive_type,
        config.test_size
      ].join(' ').toLowerCase();
      
      return searchText.includes(term);
    });
  }, [comparisons, searchTerm]);

  // Statistics
  const stats = useMemo(() => {
    return {
      totalRuns: performanceData.length,
      totalConfigs: comparisons.length,
      perfectMatches: comparisons.filter(c => c.hasAllHosts).length,
      averageCoverage: comparisons.length > 0 
        ? Math.round(comparisons.reduce((sum, c) => sum + c.coverage, 0) / comparisons.length * 100)
        : 0
    };
  }, [performanceData, comparisons]);

  return (
    <div className="min-h-screen theme-bg-secondary">
      <DashboardHeader />
      
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Left Sidebar */}
        <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Header */}
            <div>
              <h1 className="text-xl font-bold theme-text-primary mb-2">
                Advanced Host Comparison
              </h1>
              <p className="text-sm theme-text-secondary">
                Compare performance across hosts using identical test configurations
              </p>
            </div>

            {/* Host Selection */}
            <HostSelector
              selectedHosts={selectedHosts}
              onHostsChange={setSelectedHosts}
            />

            {/* Coverage Filter */}
            <div>
              <label className="block text-sm font-medium theme-text-primary mb-2">
                Minimum Host Coverage
              </label>
              <div className="space-y-2">
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.1"
                  value={minCoverage}
                  onChange={(e) => setMinCoverage(parseFloat(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs theme-text-secondary">
                  <span>10%</span>
                  <span className="font-medium">
                    {Math.round(minCoverage * 100)}%
                  </span>
                  <span>100%</span>
                </div>
              </div>
            </div>

            {/* Refresh Button */}
            <Button
              onClick={loadData}
              disabled={loading || selectedHosts.length < 2}
              className="w-full flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Loading...' : 'Refresh Data'}
            </Button>

            {/* Matching Info */}
            <Card className="p-4">
              <h3 className="font-medium theme-text-primary mb-3 flex items-center gap-2">
                <Search className="w-4 h-4" />
                Matching Criteria
              </h3>
              <div className="text-xs theme-text-secondary space-y-1">
                <p><strong>Matches:</strong> Block size, I/O pattern, queue depth, direct, sync, jobs, test size, duration</p>
                <p><strong>Ignores:</strong> Hostname, protocol, drive model, drive type, runtime</p>
                <p className="text-green-600 dark:text-green-400"><strong>Result:</strong> Compare same workloads across different hardware</p>
              </div>
            </Card>

            {/* Statistics */}
            {stats.totalRuns > 0 && (
              <Card className="p-4">
                <h3 className="font-medium theme-text-primary mb-3 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Statistics
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="theme-text-secondary">Total Runs:</span>
                    <span className="theme-text-primary font-medium">{stats.totalRuns}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="theme-text-secondary">Configurations:</span>
                    <span className="theme-text-primary font-medium">{stats.totalConfigs}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="theme-text-secondary">Perfect Matches:</span>
                    <span className="theme-text-primary font-medium">{stats.perfectMatches}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="theme-text-secondary">Avg Coverage:</span>
                    <span className="theme-text-primary font-medium">{stats.averageCoverage}%</span>
                  </div>
                </div>
              </Card>
            )}

            {/* Error Display */}
            {error && (
              <ErrorDisplay
                error={error}
                onRetry={loadData}
                showRetry={true}
              />
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Configuration Selection */}
          <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold theme-text-primary">
                Test Configurations ({filteredComparisons.length})
              </h2>
              
              {/* Search */}
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 theme-text-secondary" />
                <input
                  type="text"
                  placeholder="Search configurations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg theme-bg-primary theme-text-primary text-sm"
                />
              </div>
            </div>

            {/* Configuration Cards */}
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loading message="Loading configurations..." />
              </div>
            ) : filteredComparisons.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-48 overflow-y-auto">
                {filteredComparisons.map((comparison) => (
                  <ConfigurationCard
                    key={comparison.config.id}
                    comparison={comparison}
                    isSelected={selectedComparisonIndex === comparisons.indexOf(comparison)}
                    onSelect={() => setSelectedComparisonIndex(comparisons.indexOf(comparison))}
                  />
                ))}
              </div>
            ) : selectedHosts.length >= 2 ? (
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 theme-text-secondary mx-auto mb-3" />
                <p className="theme-text-secondary">
                  No comparable configurations found.
                  <br />
                  Try lowering the minimum coverage requirement.
                </p>
              </div>
            ) : (
              <div className="text-center py-8">
                <Filter className="w-12 h-12 theme-text-secondary mx-auto mb-3" />
                <p className="theme-text-secondary">
                  Select at least 2 hosts to see comparable configurations
                </p>
              </div>
            )}
          </div>

          {/* Charts */}
          <div className="flex-1 p-4 overflow-y-auto">
            <MultiChartGrid
              comparisons={comparisons}
              selectedComparisonIndex={selectedComparisonIndex}
              className="h-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
}