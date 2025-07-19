/**
 * User management API service
 */

export interface User {
	username: string;
	role: 'admin' | 'uploader';
}

export interface UserCreate {
	username: string;
	password: string;
	role: 'admin' | 'uploader';
}

export interface UserUpdate {
	password?: string;
	role?: 'admin' | 'uploader';
}

export interface CurrentUser {
	username: string;
	role: 'admin' | 'uploader';
}

/**
 * Get authentication headers for API requests
 */
function getAuthHeaders(): Headers {
	const storedAuth = localStorage.getItem('fio-auth');
	if (!storedAuth) {
		throw new Error('Not authenticated');
	}

	const { credentials } = JSON.parse(storedAuth);
	const headers = new Headers();
	headers.append('Authorization', `Basic ${credentials}`);
	headers.append('Content-Type', 'application/json');
	return headers;
}

/**
 * Handle API responses and errors
 */
async function handleResponse<T>(response: Response): Promise<T> {
	if (!response.ok) {
		const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
		throw new Error(errorData.error || `HTTP ${response.status}`);
	}
	return response.json();
}

/**
 * Get all users
 */
export async function getUsers(): Promise<User[]> {
	const apiUrl = import.meta.env.VITE_API_URL || '.';
	const response = await fetch(`${apiUrl}/api/users/`, {
		headers: getAuthHeaders(),
	});
	return handleResponse<User[]>(response);
}

/**
 * Get current user information
 */
export async function getCurrentUser(): Promise<CurrentUser> {
	const apiUrl = import.meta.env.VITE_API_URL || '.';
	const response = await fetch(`${apiUrl}/api/users/me`, {
		headers: getAuthHeaders(),
	});
	return handleResponse<CurrentUser>(response);
}

/**
 * Get user by username
 */
export async function getUser(username: string): Promise<User> {
	const apiUrl = import.meta.env.VITE_API_URL || '.';
	const response = await fetch(`${apiUrl}/api/users/${encodeURIComponent(username)}`, {
		headers: getAuthHeaders(),
	});
	return handleResponse<User>(response);
}

/**
 * Create a new user
 */
export async function createUser(userData: UserCreate): Promise<User> {
	const apiUrl = import.meta.env.VITE_API_URL || '.';
	const response = await fetch(`${apiUrl}/api/users/`, {
		method: 'POST',
		headers: getAuthHeaders(),
		body: JSON.stringify(userData),
	});
	return handleResponse<User>(response);
}

/**
 * Update an existing user
 */
export async function updateUser(username: string, userData: UserUpdate): Promise<User> {
	const apiUrl = import.meta.env.VITE_API_URL || '.';
	const response = await fetch(`${apiUrl}/api/users/${encodeURIComponent(username)}`, {
		method: 'PUT',
		headers: getAuthHeaders(),
		body: JSON.stringify(userData),
	});
	return handleResponse<User>(response);
}

/**
 * Delete a user
 */
export async function deleteUser(username: string): Promise<{ message: string }> {
	const apiUrl = import.meta.env.VITE_API_URL || '.';
	const response = await fetch(`${apiUrl}/api/users/${encodeURIComponent(username)}`, {
		method: 'DELETE',
		headers: getAuthHeaders(),
	});
	return handleResponse<{ message: string }>(response);
}