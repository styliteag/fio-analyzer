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

// API functions
export const fetchTestRuns = async () => {
	const response = await authenticatedFetch(`/api/test-runs`);
	if (!response.ok) {
		throw new Error("Failed to fetch test runs");
	}
	return response.json();
};

export const fetchPerformanceData = async (
	testRunIds: number[],
	metricTypes?: string[],
) => {
	const params = new URLSearchParams({
		test_run_ids: testRunIds.join(","),
	});

	if (metricTypes && metricTypes.length > 0) {
		params.append("metric_types", metricTypes.join(","));
	}

	const response = await authenticatedFetch(`/api/test-runs/performance-data?${params}`);
	if (!response.ok) {
		throw new Error("Failed to fetch performance data");
	}
	return response.json();
};

export const fetchSinglePerformanceData = async (
	testRunId: number,
	metricTypes?: string[],
) => {
	const params = new URLSearchParams();
	if (metricTypes && metricTypes.length > 0) {
		params.append("metric_types", metricTypes.join(","));
	}

	const queryString = params.toString();
	const url = `/api/test-runs/${testRunId}/performance-data${queryString ? `?${queryString}` : ''}`;
	const response = await authenticatedFetch(url);
	if (!response.ok) {
		throw new Error("Failed to fetch performance data");
	}
	return response.json();
};


export const fetchFilters = async () => {
	const response = await authenticatedFetch("/api/filters");
	if (!response.ok) {
		throw new Error("Failed to fetch filters");
	}
	return response.json();
};

export const updateTestRun = async (
	id: number,
	data: {
		drive_model?: string;
		drive_type?: string;
		hostname?: string;
		protocol?: string;
	},
) => {
	const response = await authenticatedFetch(`/api/test-runs/${id}`, {
		method: "PUT",
		body: JSON.stringify(data),
	});
	if (!response.ok) {
		throw new Error("Failed to update test run");
	}
	return response.json();
};

export const deleteTestRun = async (id: number) => {
	const response = await authenticatedFetch(`/api/test-runs/${id}`, {
		method: "DELETE",
	});
	if (!response.ok) {
		throw new Error("Failed to delete test run");
	}
	return response.json();
};

export const importFioData = async (
	file: File,
	metadata: {
		drive_model: string;
		drive_type: string;
		hostname: string;
		protocol: string;
		description: string;
		date?: string;
	},
) => {
	const formData = new FormData();
	formData.append("file", file);
	formData.append("drive_model", metadata.drive_model);
	formData.append("drive_type", metadata.drive_type);
	formData.append("hostname", metadata.hostname);
	formData.append("protocol", metadata.protocol);
	formData.append("description", metadata.description);
	if (metadata.date) {
		formData.append("date", metadata.date);
	}

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

	const response = await fetch(`${API_BASE_URL}/api/import`, {
		method: "POST",
		headers,
		body: formData,
	});

	if (response.status === 401) {
		localStorage.removeItem("fio-auth");
		window.location.reload();
	}

	if (!response.ok) {
		throw new Error("Failed to import FIO data");
	}
	return response.json();
};

// Time-series API functions
export const fetchTimeSeriesServers = async () => {
	const response = await authenticatedFetch("/api/time-series/servers");
	if (!response.ok) {
		throw new Error("Failed to fetch servers");
	}
	return response.json();
};

export const fetchTimeSeriesLatest = async () => {
	const response = await authenticatedFetch("/api/time-series/latest");
	if (!response.ok) {
		throw new Error("Failed to fetch latest time-series data");
	}
	return response.json();
};

export const fetchTimeSeriesHistory = async (
	hostname?: string,
	protocol?: string,
	days?: number,
	hours?: number,
) => {
	const params = new URLSearchParams();
	if (hostname) params.append("hostname", hostname);
	if (protocol) params.append("protocol", protocol);
	if (days) params.append("days", days.toString());
	if (hours) params.append("hours", hours.toString());

	const response = await authenticatedFetch(`/api/time-series/history?${params}`);
	if (!response.ok) {
		throw new Error("Failed to fetch time-series history");
	}
	return response.json();
};

export const fetchTimeSeriesTrends = async (
	hostname?: string,
	protocol?: string,
	metricType?: string,
	days?: number,
	hours?: number,
) => {
	const params = new URLSearchParams();
	if (hostname) params.append("hostname", hostname);
	if (protocol) params.append("protocol", protocol);
	if (metricType) params.append("metric_type", metricType);
	if (days) params.append("days", days.toString());
	if (hours) params.append("hours", hours.toString());

	const response = await authenticatedFetch(`/api/time-series/trends?${params}`);
	if (!response.ok) {
		throw new Error("Failed to fetch time-series trends");
	}
	return response.json();
};

export const fetchTimeSeriesAll = async (filters?: {
	hostnames?: string[];
	protocols?: string[];
	drive_types?: string[];
	drive_models?: string[];
	patterns?: string[];
	block_sizes?: (string|number)[];
	syncs?: number[];
	queue_depths?: number[];
	directs?: number[];
	num_jobs?: number[];
	test_sizes?: string[];
	durations?: number[];
}) => {
	const params = new URLSearchParams();
	
	if (filters?.hostnames && filters.hostnames.length > 0) {
		params.append("hostnames", filters.hostnames.join(","));
	}
	if (filters?.protocols && filters.protocols.length > 0) {
		params.append("protocols", filters.protocols.join(","));
	}
	if (filters?.drive_types && filters.drive_types.length > 0) {
		params.append("drive_types", filters.drive_types.join(","));
	}
	if (filters?.drive_models && filters.drive_models.length > 0) {
		params.append("drive_models", filters.drive_models.join(","));
	}
	if (filters?.patterns && filters.patterns.length > 0) {
		params.append("patterns", filters.patterns.join(","));
	}
	if (filters?.block_sizes && filters.block_sizes.length > 0) {
		params.append("block_sizes", filters.block_sizes.map(b => String(b)).join(","));
	}
	if (filters?.syncs && filters.syncs.length > 0) {
		params.append("syncs", filters.syncs.join(","));
	}
	if (filters?.queue_depths && filters.queue_depths.length > 0) {
		params.append("queue_depths", filters.queue_depths.join(","));
	}
	if (filters?.directs && filters.directs.length > 0) {
		params.append("directs", filters.directs.join(","));
	}
	if (filters?.num_jobs && filters.num_jobs.length > 0) {
		params.append("num_jobs", filters.num_jobs.join(","));
	}
	if (filters?.test_sizes && filters.test_sizes.length > 0) {
		params.append("test_sizes", filters.test_sizes.join(","));
	}
	if (filters?.durations && filters.durations.length > 0) {
		params.append("durations", filters.durations.join(","));
	}

	const queryString = params.toString();
	const url = `/api/time-series/all${queryString ? `?${queryString}` : ''}`;
	const response = await authenticatedFetch(url);
	if (!response.ok) {
		throw new Error("Failed to fetch all time-series data");
	}
	return response.json();
};
