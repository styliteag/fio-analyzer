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
};


