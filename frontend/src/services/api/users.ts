/**
 * User management API service
 */
import { sessionFetch } from './base';

/** admin: full access, uploader: upload only, viewer: read-only */
export type UserRole = 'admin' | 'uploader' | 'viewer';

export interface User {
	username: string;
	role: UserRole;
}

export interface UserCreate {
	username: string;
	password: string;
	role: UserRole;
}

export interface UserUpdate {
	password?: string;
	role?: UserRole;
}

export interface CurrentUser {
	username: string;
	role: UserRole;
}

/** JSON headers; the session cookie and CSRF header come from sessionFetch */
function jsonHeaders(): HeadersInit {
	return { 'Content-Type': 'application/json' };
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
	const apiUrl = import.meta.env.VITE_API_URL || "";
	const response = await sessionFetch(`${apiUrl}/api/users/`, {
		headers: jsonHeaders(),
	});
	return handleResponse<User[]>(response);
}

/**
 * Get current user information
 */
export async function getCurrentUser(): Promise<CurrentUser> {
	const apiUrl = import.meta.env.VITE_API_URL || "";
	const response = await sessionFetch(`${apiUrl}/api/users/me`, {
		headers: jsonHeaders(),
	});
	return handleResponse<CurrentUser>(response);
}

/**
 * Get user by username
 */
export async function getUser(username: string): Promise<User> {
	const apiUrl = import.meta.env.VITE_API_URL || "";
	const response = await sessionFetch(`${apiUrl}/api/users/${encodeURIComponent(username)}`, {
		headers: jsonHeaders(),
	});
	return handleResponse<User>(response);
}

/**
 * Create a new user
 */
export async function createUser(userData: UserCreate): Promise<User> {
	const apiUrl = import.meta.env.VITE_API_URL || "";
	const response = await sessionFetch(`${apiUrl}/api/users/`, {
		method: 'POST',
		headers: jsonHeaders(),
		body: JSON.stringify(userData),
	});
	return handleResponse<User>(response);
}

/**
 * Update an existing user
 */
export async function updateUser(username: string, userData: UserUpdate): Promise<User> {
	const apiUrl = import.meta.env.VITE_API_URL || "";
	const response = await sessionFetch(`${apiUrl}/api/users/${encodeURIComponent(username)}`, {
		method: 'PUT',
		headers: jsonHeaders(),
		body: JSON.stringify(userData),
	});
	return handleResponse<User>(response);
}

/**
 * Delete a user
 */
export async function deleteUser(username: string): Promise<{ message: string }> {
	const apiUrl = import.meta.env.VITE_API_URL || "";
	const response = await sessionFetch(`${apiUrl}/api/users/${encodeURIComponent(username)}`, {
		method: 'DELETE',
		headers: jsonHeaders(),
	});
	return handleResponse<{ message: string }>(response);
}