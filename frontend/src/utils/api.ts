// API utility functions with authentication
const API_BASE_URL = import.meta.env.VITE_API_URL || "";

// Get stored authentication credentials
const getAuthHeaders = (): HeadersInit => {
	const storedAuth = localStorage.getItem("fio-auth");
	if (storedAuth) {
		try {
			const { credentials } = JSON.parse(storedAuth);
			return {
				Authorization: `Basic ${credentials}`,
				"Content-Type": "application/json",
			};
		} catch {
			// If parsing fails, remove invalid auth data
			localStorage.removeItem("fio-auth");
		}
	}
	return {
		"Content-Type": "application/json",
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

// Note: All API functions have been moved to services/api/
// Please use the appropriate service modules instead:
// - testRuns.ts for test run operations
// - performance.ts for performance data
// - timeSeries.ts for time series data
// - upload.ts for file uploads
// - base.ts for common API utilities
