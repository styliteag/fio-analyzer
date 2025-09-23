export const API_BASE_URL = (import.meta as unknown as { env?: { VITE_API_URL?: string } })?.env?.VITE_API_URL || '';

let basicAuthHeader: string | null = null;
export function setBasicAuth(username: string, password: string) {
  const token = btoa(`${username}:${password}`);
  basicAuthHeader = `Basic ${token}`;
}
export function clearAuth() {
  basicAuthHeader = null;
}

function buildUrl(path: string): string {
  if (!API_BASE_URL) return path; // relative in dev
  if (API_BASE_URL.endsWith('/')) return API_BASE_URL + path.replace(/^\//, '');
  return API_BASE_URL + (path.startsWith('/') ? path : `/${path}`);
}

export async function getJson<T>(path: string, init?: RequestInit & { signal?: AbortSignal }): Promise<T> {
  const res = await fetch(buildUrl(path), {
    headers: {
      'Accept': 'application/json',
      ...(basicAuthHeader ? { Authorization: basicAuthHeader } : {}),
    },
    ...init,
  });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function postForm(path: string, body: FormData): Promise<Response> {
  return fetch(buildUrl(path), {
    method: 'POST',
    headers: {
      ...(basicAuthHeader ? { Authorization: basicAuthHeader } : {}),
    },
    body,
  });
}

type MeResp = { username: string; role: string };
export const Api = {
  info: () => getJson<Record<string, unknown>>('/api/info'),
  me: () => getJson<MeResp>('/api/users/me'),
  // Users
  createUser: async (username: string, password: string) => {
    const form = new FormData();
    form.append('username', username);
    form.append('password', password);
    return postForm('/api/users/', form);
  },
  updateUser: async (username: string, password: string) => {
    const form = new FormData();
    form.append('password', password);
    return fetch(buildUrl(`/api/users/${encodeURIComponent(username)}`), {
      method: 'PUT',
      headers: {
        ...(basicAuthHeader ? { Authorization: basicAuthHeader } : {}),
      },
      body: form,
    });
  },
  deleteUser: async (username: string) => {
    return fetch(buildUrl(`/api/users/${encodeURIComponent(username)}`), {
      method: 'DELETE',
      headers: {
        ...(basicAuthHeader ? { Authorization: basicAuthHeader } : {}),
      },
    });
  },
  listUsers: () => getJson<Array<{ username: string; role?: string }>>('/api/users/'),

  // Filters
  filters: () => getJson<Record<string, unknown>>('/api/filters'),

  // Test Runs
  testRuns: (init?: RequestInit & { signal?: AbortSignal }) => getJson<Array<Record<string, unknown>>>('/api/test-runs/', init),
  getTestRun: (id: number) => getJson<Record<string, unknown>>(`/api/test-runs/${id}`),
  updateTestRun: (id: number, payload: FormData | URLSearchParams | Record<string, unknown>) => {
    const body = payload instanceof FormData ? payload : payload instanceof URLSearchParams ? payload : JSON.stringify(payload);
    const headers: Record<string, string> = basicAuthHeader ? { Authorization: basicAuthHeader } : {};
    if (!(payload instanceof FormData)) headers['Content-Type'] = payload instanceof URLSearchParams ? 'application/x-www-form-urlencoded' : 'application/json';
    return fetch(buildUrl(`/api/test-runs/${id}`), { method: 'PUT', headers, body: body as BodyInit });
  },
  deleteTestRun: (id: number) => fetch(buildUrl(`/api/test-runs/${id}`), { method: 'DELETE', headers: { ...(basicAuthHeader ? { Authorization: basicAuthHeader } : {}) } }),
  bulkUpdateTestRuns: (body: BodyInit) => fetch(buildUrl('/api/test-runs/bulk'), { method: 'PUT', headers: { ...(basicAuthHeader ? { Authorization: basicAuthHeader } : {}) }, body }),

  // Performance Data
  performanceData: (params: { test_run_ids?: Array<number> | string }) => {
    const query = new URLSearchParams();
    if (params?.test_run_ids) query.set('test_run_ids', Array.isArray(params.test_run_ids) ? params.test_run_ids.join(',') : params.test_run_ids);
    return getJson<Record<string, unknown>>(`/api/test-runs/performance-data${query.toString() ? `?${query.toString()}` : ''}`);
  },

  // Time Series
  timeSeriesServers: () => getJson<Record<string, unknown>>('/api/time-series/servers'),
  timeSeriesAll: () => getJson<Record<string, unknown>>('/api/time-series/all'),
  timeSeriesLatest: () => getJson<Record<string, unknown>>('/api/time-series/latest'),
  timeSeriesHistory: (params: Record<string, string>) => {
    const qs = new URLSearchParams(params);
    return getJson<Record<string, unknown>>(`/api/time-series/history${qs.toString() ? `?${qs.toString()}` : ''}`);
  },
  timeSeriesTrends: (params: Record<string, string>) => {
    const qs = new URLSearchParams(params);
    return getJson<Record<string, unknown>>(`/api/time-series/trends${qs.toString() ? `?${qs.toString()}` : ''}`);
  },

  // Imports
  uploadImport: (form: FormData) => postForm('/api/import', form),
  uploadImportBulk: () => postForm('/api/import/bulk', new FormData()),
};


