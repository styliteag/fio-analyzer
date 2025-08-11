// Base API service with authentication and common functionality
import type { ApiFilters } from '../../types/api';
import { getErrorMessage } from '../../types/api';

const API_BASE_URL = import.meta.env.VITE_API_URL || "";

export interface ApiResponse<T = unknown> {
    data?: T;
    error?: string;
    status: number;
}

// Get stored authentication credentials
const getAuthHeaders = (): HeadersInit => {
    const storedAuth = localStorage.getItem("fio-auth");
    if (storedAuth) {
        try {
            const { credentials } = JSON.parse(storedAuth);
            return {
                Authorization: `Basic ${credentials}`,
                "Content-Type": "application/json",
                Accept: "application/json",
            };
        } catch {
            // If parsing fails, remove invalid auth data
            localStorage.removeItem("fio-auth");
        }
    }
    return {
        "Content-Type": "application/json",
        Accept: "application/json",
    };
};

// Authenticated fetch wrapper with AbortSignal support
export const authenticatedFetch = async (
    endpoint: string,
    options: RequestInit = {},
): Promise<Response> => {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
        ...getAuthHeaders(),
        ...options.headers,
    };

    const response = await fetch(url, {
        ...options,
        headers,
        // Pass through AbortSignal if provided
        signal: options.signal,
    });

    // If we get 401, the auth is invalid - clear it
    if (response.status === 401) {
        localStorage.removeItem("fio-auth");
        // Reload the page to trigger re-authentication
        window.location.reload();
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
        const storedAuth = localStorage.getItem("fio-auth");
        const headers: HeadersInit = {};
        
        if (storedAuth) {
            try {
                const { credentials } = JSON.parse(storedAuth);
                headers.Authorization = `Basic ${credentials}`;
            } catch {
                localStorage.removeItem("fio-auth");
            }
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: "POST",
            headers,
            body: formData,
            signal, // Add AbortSignal support
        });

        if (response.status === 401) {
            localStorage.removeItem("fio-auth");
            window.location.reload();
        }

        if (!response.ok) {
            return {
                status: response.status,
                error: `Upload Error: ${response.statusText}`,
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