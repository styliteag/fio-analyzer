// Base API service with authentication and common functionality
const API_BASE_URL = import.meta.env.VITE_API_URL || "";

export interface ApiResponse<T = any> {
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

// Authenticated fetch wrapper
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
    });

    // If we get 401, the auth is invalid - clear it
    if (response.status === 401) {
        localStorage.removeItem("fio-auth");
        // Reload the page to trigger re-authentication
        window.location.reload();
    }

    return response;
};

// Generic API call handler with error handling
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
        return {
            status: 500,
            error: error instanceof Error ? error.message : "Unknown error occurred",
        };
    }
};

// Shared filter interface for API parameters
export interface ApiFilters {
    hostnames?: string[];
    protocols?: string[];
    drive_types?: string[];
    drive_models?: string[];
    patterns?: string[];
    block_sizes?: (string | number)[];
    syncs?: (string | number)[];
    queue_depths?: (string | number)[];
    directs?: (string | number)[];
    num_jobs?: (string | number)[];
    test_sizes?: string[];
    durations?: (string | number)[];
}

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

// API call for file uploads
export const apiUpload = async (
    endpoint: string,
    formData: FormData,
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
        return {
            status: 500,
            error: error instanceof Error ? error.message : "Upload failed",
        };
    }
};