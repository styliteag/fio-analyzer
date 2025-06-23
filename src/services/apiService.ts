import {
  TestRun,
  PerformanceData,
  FilterOptions,
  ChartTemplate,
} from "../types";
import {
  mockTestRuns,
  mockFilters,
  generateMockPerformanceData,
  mockChartTemplates,
  simulateNetworkDelay,
} from "./mockDataService";

const API_BASE_URL = "http://localhost:8000/api";
const BACKEND_TIMEOUT = 5000; // 5 seconds

// Track backend availability
let backendAvailable = true;
let lastBackendCheck = 0;
const BACKEND_CHECK_INTERVAL = 30000; // Check every 30 seconds

// Utility function to check if backend is available
const checkBackendHealth = async (): Promise<boolean> => {
  const now = Date.now();

  // Don't check too frequently
  if (now - lastBackendCheck < BACKEND_CHECK_INTERVAL && backendAvailable) {
    return backendAvailable;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout for health check

    const response = await fetch(`${API_BASE_URL}/health`, {
      signal: controller.signal,
      method: "GET",
    });

    clearTimeout(timeoutId);
    backendAvailable = response.ok;
    lastBackendCheck = now;

    return backendAvailable;
  } catch (error) {
    backendAvailable = false;
    lastBackendCheck = now;
    return false;
  }
};

// Enhanced fetch with timeout and fallback
const fetchWithFallback = async <T>(
  endpoint: string,
  fallbackData: T,
  options: RequestInit = {},
): Promise<{ data: T; isUsingMockData: boolean }> => {
  try {
    // Check backend health first
    const isHealthy = await checkBackendHealth();
    if (!isHealthy) {
      console.warn("Backend is not available, using mock data");
      await simulateNetworkDelay(200, 800);
      return { data: fallbackData, isUsingMockData: true };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), BACKEND_TIMEOUT);

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { data, isUsingMockData: false };
  } catch (error) {
    console.warn(`API call failed for ${endpoint}:`, error);
    console.info("Falling back to mock data");

    // Mark backend as unavailable
    backendAvailable = false;
    lastBackendCheck = Date.now();

    // Simulate network delay for consistent UX
    await simulateNetworkDelay(200, 800);

    return { data: fallbackData, isUsingMockData: true };
  }
};

// API service functions
export const apiService = {
  // Get test runs with fallback to mock data
  async getTestRuns(): Promise<{ data: TestRun[]; isUsingMockData: boolean }> {
    return fetchWithFallback("/test-runs", mockTestRuns);
  },

  // Get filter options with fallback to mock data
  async getFilters(): Promise<{
    data: FilterOptions;
    isUsingMockData: boolean;
  }> {
    return fetchWithFallback("/filters", mockFilters);
  },

  // Get performance data with fallback to mock data
  async getPerformanceData(
    testRunIds: number[],
    metricTypes: string[] = ["iops", "avg_latency", "throughput"],
  ): Promise<{ data: PerformanceData[]; isUsingMockData: boolean }> {
    const endpoint = `/performance-data?test_run_ids=${testRunIds.join(",")}&metric_types=${metricTypes.join(",")}`;
    const mockData = generateMockPerformanceData(testRunIds);

    return fetchWithFallback(endpoint, mockData);
  },

  // Get chart templates with fallback to mock data
  async getChartTemplates(): Promise<{
    data: ChartTemplate[];
    isUsingMockData: boolean;
  }> {
    return fetchWithFallback("/chart-templates", mockChartTemplates);
  },

  // Get backend status
  getBackendStatus(): { isAvailable: boolean; lastChecked: number } {
    return {
      isAvailable: backendAvailable,
      lastChecked: lastBackendCheck,
    };
  },

  // Force backend health check
  async forceBackendCheck(): Promise<boolean> {
    lastBackendCheck = 0; // Reset cache
    return checkBackendHealth();
  },
};

// Export individual functions for backward compatibility
export const {
  getTestRuns,
  getFilters,
  getPerformanceData,
  getChartTemplates,
  getBackendStatus,
  forceBackendCheck,
} = apiService;
