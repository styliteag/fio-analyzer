export const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || '';

function buildUrl(path: string): string {
  if (!API_BASE_URL) return path; // relative in dev
  if (API_BASE_URL.endsWith('/')) return API_BASE_URL + path.replace(/^\//, '');
  return API_BASE_URL + (path.startsWith('/') ? path : `/${path}`);
}

export async function getJson<T>(path: string, init?: RequestInit & { signal?: AbortSignal }): Promise<T> {
  const res = await fetch(buildUrl(path), {
    headers: { 'Accept': 'application/json' },
    ...init,
  });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export const Api = {
  info: () => getJson<any>('/api/info'),
};


