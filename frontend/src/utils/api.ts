// API utility functions with authentication
const API_BASE_URL = import.meta.env.VITE_API_URL || '.';

// Get stored authentication credentials
const getAuthHeaders = (): HeadersInit => {
  const storedAuth = localStorage.getItem('fio-auth');
  if (storedAuth) {
    try {
      const { credentials } = JSON.parse(storedAuth);
      return {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json'
      };
    } catch {
      // If parsing fails, remove invalid auth data
      localStorage.removeItem('fio-auth');
    }
  }
  return {
    'Content-Type': 'application/json'
  };
};

// Authenticated fetch wrapper
export const authenticatedFetch = async (endpoint: string, options: RequestInit = {}): Promise<Response> => {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    ...getAuthHeaders(),
    ...options.headers
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  // If we get 401, the auth is invalid - clear it
  if (response.status === 401) {
    localStorage.removeItem('fio-auth');
    // Reload the page to trigger re-authentication
    window.location.reload();
  }

  return response;
};

// API functions
export const fetchTestRuns = async () => {
  const response = await authenticatedFetch('/api/test-runs');
  if (!response.ok) {
    throw new Error('Failed to fetch test runs');
  }
  return response.json();
};

export const fetchPerformanceData = async (testRunIds: number[], metricTypes?: string[]) => {
  const params = new URLSearchParams({
    test_run_ids: testRunIds.join(',')
  });
  
  if (metricTypes && metricTypes.length > 0) {
    params.append('metric_types', metricTypes.join(','));
  }

  const response = await authenticatedFetch(`/api/performance-data?${params}`);
  if (!response.ok) {
    throw new Error('Failed to fetch performance data');
  }
  return response.json();
};

export const fetchFilters = async () => {
  const response = await authenticatedFetch('/api/filters');
  if (!response.ok) {
    throw new Error('Failed to fetch filters');
  }
  return response.json();
};

export const updateTestRun = async (id: number, data: { drive_model?: string; drive_type?: string; hostname?: string; protocol?: string }) => {
  const response = await authenticatedFetch(`/api/test-runs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    throw new Error('Failed to update test run');
  }
  return response.json();
};

export const deleteTestRun = async (id: number) => {
  const response = await authenticatedFetch(`/api/test-runs/${id}`, {
    method: 'DELETE'
  });
  if (!response.ok) {
    throw new Error('Failed to delete test run');
  }
  return response.json();
};

export const importFioData = async (file: File, metadata: {
  drive_model: string;
  drive_type: string;
  hostname: string;
  protocol: string;
  description: string;
  date?: string;
}) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('drive_model', metadata.drive_model);
  formData.append('drive_type', metadata.drive_type);
  formData.append('hostname', metadata.hostname);
  formData.append('protocol', metadata.protocol);
  formData.append('description', metadata.description);
  if (metadata.date) {
    formData.append('date', metadata.date);
  }

  const storedAuth = localStorage.getItem('fio-auth');
  const headers: HeadersInit = {};
  if (storedAuth) {
    try {
      const { credentials } = JSON.parse(storedAuth);
      headers['Authorization'] = `Basic ${credentials}`;
    } catch {
      localStorage.removeItem('fio-auth');
    }
  }

  const response = await fetch(`${API_BASE_URL}/api/import`, {
    method: 'POST',
    headers,
    body: formData
  });

  if (response.status === 401) {
    localStorage.removeItem('fio-auth');
    window.location.reload();
  }

  if (!response.ok) {
    throw new Error('Failed to import FIO data');
  }
  return response.json();
};

export const clearDatabase = async () => {
  const response = await authenticatedFetch('/api/clear-database', {
    method: 'DELETE'
  });
  if (!response.ok) {
    throw new Error('Failed to clear database');
  }
  return response.json();
};