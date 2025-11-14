// HTTP client with error handling, authentication, and request cancellation
// Global auth state
let basicAuthCredentials = null;
export function setBasicAuth(username, password) {
    const credentials = btoa(`${username}:${password}`);
    basicAuthCredentials = `Basic ${credentials}`;
}
export function clearAuth() {
    basicAuthCredentials = null;
}
export function getAuthHeaders() {
    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };
    if (basicAuthCredentials) {
        headers.Authorization = basicAuthCredentials;
    }
    return headers;
}
// Enhanced error handling with user-friendly messages and console logging
export class ApiClientError extends Error {
    constructor(statusCode, message, details, requestId, isAborted = false) {
        super(message);
        Object.defineProperty(this, "statusCode", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: statusCode
        });
        Object.defineProperty(this, "details", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: details
        });
        Object.defineProperty(this, "requestId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: requestId
        });
        Object.defineProperty(this, "isAborted", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: isAborted
        });
        this.name = 'ApiClientError';
    }
    getUserFriendlyMessage() {
        if (this.isAborted) {
            return 'Request was cancelled';
        }
        switch (this.statusCode) {
            case 401:
                return 'Please check your username and password';
            case 403:
                return 'You do not have permission to perform this action';
            case 404:
                return 'The requested data was not found';
            case 429:
                return 'Too many requests. Please try again later';
            case 500:
                return 'Server error. Please try again later';
            default:
                return 'An unexpected error occurred';
        }
    }
}
export async function apiRequest(url, options = {}, abortController) {
    // For FormData, don't set Content-Type - let browser set it with boundary
    const isFormData = options.body instanceof FormData;
    const defaultHeaders = isFormData ?
        (basicAuthCredentials ? { Authorization: basicAuthCredentials } : {}) :
        getAuthHeaders();
    const config = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers,
        },
        signal: abortController?.signal,
    };
    try {
        console.log(`API Request: ${options.method || 'GET'} ${url}`, config);
        const response = await fetch(url, config);
        const requestId = response.headers.get('x-request-id') || undefined;
        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
            }
            catch {
                errorData = { error: response.statusText };
            }
            const error = new ApiClientError(response.status, errorData.error || `HTTP ${response.status}`, errorData.details, requestId);
            // Log detailed error information to browser console (per FR-022C)
            console.error('API Error Details:', {
                url,
                method: options.method || 'GET',
                status: response.status,
                statusText: response.statusText,
                requestId,
                error: errorData,
                requestHeaders: config.headers,
            });
            throw error;
        }
        const data = await response.json();
        console.log(`API Response: ${options.method || 'GET'} ${url}`, data);
        return data;
    }
    catch (error) {
        if (error instanceof ApiClientError) {
            throw error;
        }
        // Handle abort errors
        if (error instanceof Error && error.name === 'AbortError') {
            throw new ApiClientError(0, 'Request was cancelled', error, undefined, true);
        }
        // Network or other errors
        console.error('Network Error:', {
            url,
            method: options.method || 'GET',
            error: error instanceof Error ? error.message : error,
        });
        throw new ApiClientError(0, 'Network error occurred', error);
    }
}
// Convenience methods
export const apiClient = {
    get(url, abortController) {
        return apiRequest(url, { method: 'GET' }, abortController);
    },
    post(url, data, abortController) {
        return apiRequest(url, {
            method: 'POST',
            body: data ? JSON.stringify(data) : undefined,
        }, abortController);
    },
    put(url, data, abortController) {
        return apiRequest(url, {
            method: 'PUT',
            body: data ? JSON.stringify(data) : undefined,
        }, abortController);
    },
    delete(url, abortController) {
        return apiRequest(url, { method: 'DELETE' }, abortController);
    },
    upload(url, formData, abortController) {
        // apiRequest will handle FormData headers automatically
        return apiRequest(url, {
            method: 'POST',
            body: formData,
        }, abortController);
    },
};
// Helper function to create cancellable requests
export function createCancellableRequest(requestFn) {
    const abortController = new AbortController();
    let isAborted = false;
    const promise = requestFn(abortController).catch((error) => {
        if (error instanceof ApiClientError && error.isAborted) {
            isAborted = true;
        }
        throw error;
    });
    return {
        promise,
        abort: () => {
            abortController.abort();
            isAborted = true;
        },
        get isAborted() {
            return isAborted || abortController.signal.aborted;
        }
    };
}
