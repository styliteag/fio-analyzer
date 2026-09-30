// Base API service with authentication and common functionality
import type { ApiFilters } from '../../types/api';
import { getErrorMessage } from '../../types/api';

const API_BASE_URL = import.meta.env.VITE_API_URL || "";

export interface ApiResponse<T = unknown> {
    data?: T;
    error?: string;
    status: number;
}

// Browser session: the backend sets an HttpOnly cookie at login (POST /api/auth/login);
// the password is never stored here. Cookie-authenticated writes need the CSRF header.
export const CSRF_HEADERS = { "X-Requested-With": "fio-analyzer" } as const;
const LEGACY_AUTH_KEY = "fio-auth"; // pre-session builds stored Basic credentials here

let signedIn = false;

/** Called by AuthContext; a 401 only reloads the app while a user is signed in (no reload loop) */
export const setSignedIn = (value: boolean): void => {
    signedIn = value;
};

/** Remove Basic credentials that older builds kept in localStorage */
export const forgetLegacyCredentials = (): void => {
    try {
        localStorage.removeItem(LEGACY_AUTH_KEY);
    } catch {
        // storage unavailable: nothing stored either
    }
};

/** Session expired or revoked: back to the login page */
export const handleUnauthorized = (): void => {
    if (!signedIn) return;
    signedIn = false;
    window.location.reload();
};

/** fetch() with the session cookie and the CSRF header */
export const sessionFetch = (url: string, options: RequestInit = {}): Promise<Response> =>
    fetch(url, {
        ...options,
        credentials: "include",
        headers: { ...CSRF_HEADERS, ...options.headers },
    });

// Authenticated fetch wrapper with AbortSignal support
export const authenticatedFetch = async (
    endpoint: string,
    options: RequestInit = {},
): Promise<Response> => {
    const response = await sessionFetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            ...options.headers,
        },
    });

    if (response.status === 401) {
        handleUnauthorized();
    }

    return response;
};

// Generic API call handler with error handling and AbortSignal support
export const apiCall = async <T>(
    endpoint: string,
    options: RequestInit = {},
): Promise<ApiResponse<T>> => {
    try {
        const response = await authenticatedFetch(endpoint, options);
        
        if (!response.ok) {
            return {
                status: response.status,
                error: `API Error: ${response.statusText}`,
            };
        }

        // Ensure we only attempt JSON parsing when the content-type is JSON
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
            return {
                status: response.status,
                error: `Unexpected response format (content-type: ${contentType || 'unknown'})`,
            };
        }

        const data = await response.json();
        return {
            status: response.status,
            data,
        };
    } catch (error) {
        // Handle AbortError specifically
        if (error instanceof Error && error.name === 'AbortError') {
            return {
                status: 0,
                error: 'Request cancelled',
            };
        }
        
        return {
            status: 500,
            error: getErrorMessage(error),
        };
    }
};

// Re-export ApiFilters from types (no need to duplicate)

// Build query parameters from filters
export const buildFilterParams = (filters: ApiFilters): URLSearchParams => {
    const params = new URLSearchParams();
    
    // Add array parameters if they exist and have values
    if (filters.hostnames?.length) {
        params.append('hostnames', filters.hostnames.join(','));
    }
    if (filters.protocols?.length) {
        params.append('protocols', filters.protocols.join(','));
    }
    if (filters.drive_types?.length) {
        params.append('drive_types', filters.drive_types.join(','));
    }
    if (filters.drive_models?.length) {
        params.append('drive_models', filters.drive_models.join(','));
    }
    if (filters.patterns?.length) {
        params.append('patterns', filters.patterns.join(','));
    }
    if (filters.block_sizes?.length) {
        params.append('block_sizes', filters.block_sizes.map(size => String(size)).join(','));
    }
    if (filters.syncs?.length) {
        params.append('syncs', filters.syncs.map(String).join(','));
    }
    if (filters.queue_depths?.length) {
        params.append('queue_depths', filters.queue_depths.map(String).join(','));
    }
    if (filters.directs?.length) {
        params.append('directs', filters.directs.map(String).join(','));
    }
    if (filters.num_jobs?.length) {
        params.append('num_jobs', filters.num_jobs.map(String).join(','));
    }
    if (filters.test_sizes?.length) {
        params.append('test_sizes', filters.test_sizes.join(','));
    }
    if (filters.durations?.length) {
        params.append('durations', filters.durations.map(String).join(','));
    }
    
    return params;
};

// API call for file uploads with AbortSignal support
export const apiUpload = async (
    endpoint: string,
    formData: FormData,
    signal?: AbortSignal,
): Promise<ApiResponse> => {
    try {
        const response = await sessionFetch(`${API_BASE_URL}${endpoint}`, {
            method: "POST",
            body: formData,
            signal, // Add AbortSignal support
        });

        if (response.status === 401) {
            handleUnauthorized();
        }

        if (!response.ok) {
            // FastAPI puts the reason into {"detail": "..."}; surface it instead of the bare status text
            const body = await response.json().catch(() => null);
            const detail = body && typeof body.detail === 'string' ? body.detail : null;
            return {
                status: response.status,
                error: detail ?? `Upload failed (${response.status} ${response.statusText})`,
            };
        }

        const data = await response.json();
        return {
            status: response.status,
            data,
        };
    } catch (error) {
        // Handle AbortError specifically
        if (error instanceof Error && error.name === 'AbortError') {
            return {
                status: 0,
                error: 'Upload cancelled',
            };
        }
        
        return {
            status: 500,
            error: getErrorMessage(error),
        };
    }
};