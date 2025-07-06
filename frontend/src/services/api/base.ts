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