/**
 * User Manager page - Admin interface for managing users
 */

import React, { useState, useEffect } from 'react';
import { User, getUsers, createUser, updateUser, deleteUser, UserCreate, UserUpdate } from '../services/api/users';
import { useAuth } from '../contexts/AuthContext';
import { DashboardHeader } from '../components/layout';

interface UserFormData {
	username: string;
	password: string;
	confirmPassword: string;
	role: 'admin' | 'uploader';
}

const UserManager: React.FC = () => {
	const { username: currentUsername, isAdmin } = useAuth();
	const [users, setUsers] = useState<User[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [showCreateForm, setShowCreateForm] = useState(false);
	const [editingUser, setEditingUser] = useState<User | null>(null);
	const [formData, setFormData] = useState<UserFormData>({
		username: '',
		password: '',
		confirmPassword: '',
		role: 'uploader'
	});
	const [formErrors, setFormErrors] = useState<Record<string, string>>({});
	const [operationLoading, setOperationLoading] = useState<Record<string, boolean>>({});

	// Load users on component mount
	useEffect(() => {
		if (isAdmin) {
			loadUsers();
		}
	}, [isAdmin]);

	// Redirect non-admin users
	if (!isAdmin) {
		return (
			<div className="min-h-screen theme-bg-secondary flex items-center justify-center">
				<div className="text-center">
					<h1 className="text-2xl font-bold theme-text-primary mb-4">Access Denied</h1>
					<p className="theme-text-secondary">You need admin privileges to access user management.</p>
				</div>
			</div>
		);
	}

	const loadUsers = async () => {
		try {
			setLoading(true);
			setError(null);
			const usersData = await getUsers();
			setUsers(usersData);
		} catch (err) {
			console.error('Failed to load users:', err);
			setError(err instanceof Error ? err.message : 'Failed to load users');
		} finally {
			setLoading(false);
		}
	};

	const resetForm = () => {
		setFormData({
			username: '',
			password: '',
			confirmPassword: '',
			role: 'uploader'
		});
		setFormErrors({});
		setShowCreateForm(false);
		setEditingUser(null);
	};

	const validateForm = (isEdit = false): boolean => {
		const errors: Record<string, string> = {};

		if (!isEdit && !formData.username.trim()) {
			errors.username = 'Username is required';
		} else if (!isEdit && !/^[a-zA-Z0-9_-]+$/.test(formData.username)) {
			errors.username = 'Username can only contain letters, numbers, hyphens, and underscores';
		}

		if (!isEdit || formData.password) {
			if (formData.password.length < 4) {
				errors.password = 'Password must be at least 4 characters';
			}
			if (formData.password !== formData.confirmPassword) {
				errors.confirmPassword = 'Passwords do not match';
			}
		}

		setFormErrors(errors);
		return Object.keys(errors).length === 0;
	};

	const handleCreateUser = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!validateForm()) return;

		const operationKey = 'create';
		setOperationLoading(prev => ({ ...prev, [operationKey]: true }));

		try {
			const userData: UserCreate = {
				username: formData.username.trim(),
				password: formData.password,
				role: formData.role
			};

			await createUser(userData);
			await loadUsers();
			resetForm();
		} catch (err) {
			console.error('Failed to create user:', err);
			setError(err instanceof Error ? err.message : 'Failed to create user');
		} finally {
			setOperationLoading(prev => ({ ...prev, [operationKey]: false }));
		}
	};

	const handleUpdateUser = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!editingUser || !validateForm(true)) return;

		const operationKey = `edit-${editingUser.username}`;
		setOperationLoading(prev => ({ ...prev, [operationKey]: true }));

		try {
			const userData: UserUpdate = {
				role: formData.role
			};

			if (formData.password) {
				userData.password = formData.password;
			}

			await updateUser(editingUser.username, userData);
			await loadUsers();
			resetForm();
		} catch (err) {
			console.error('Failed to update user:', err);
			setError(err instanceof Error ? err.message : 'Failed to update user');
		} finally {
			setOperationLoading(prev => ({ ...prev, [operationKey]: false }));
		}
	};

	const handleDeleteUser = async (username: string) => {
		if (!confirm(`Are you sure you want to delete user "${username}"?`)) return;

		const operationKey = `delete-${username}`;
		setOperationLoading(prev => ({ ...prev, [operationKey]: true }));

		try {
			await deleteUser(username);
			await loadUsers();
		} catch (err) {
			console.error('Failed to delete user:', err);
			setError(err instanceof Error ? err.message : 'Failed to delete user');
		} finally {
			setOperationLoading(prev => ({ ...prev, [operationKey]: false }));
		}
	};

	const startEditUser = (user: User) => {
		setEditingUser(user);
		setFormData({
			username: user.username,
			password: '',
			confirmPassword: '',
			role: user.role
		});
		setFormErrors({});
		setShowCreateForm(false);
	};

	if (loading) {
		return (
			<div className="min-h-screen theme-bg-secondary flex items-center justify-center">
				<div className="text-center">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
					<p className="theme-text-secondary">Loading users...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen theme-bg-secondary">
			<DashboardHeader />
			<div className="py-8">
				<div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
					{/* Header */}
					<div className="mb-8">
						<h1 className="text-3xl font-bold theme-text-primary">User Management</h1>
						<p className="mt-2 text-sm theme-text-secondary">
							Manage admin and uploader users for the FIO Analyzer system.
						</p>
					</div>

					{/* Error Message */}
					{error && (
						<div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
							<div className="flex">
								<div className="flex-shrink-0">
									<svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
										<path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
									</svg>
								</div>
								<div className="ml-3">
									<h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error</h3>
									<div className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</div>
								</div>
								<div className="ml-auto pl-3">
									<button
										onClick={() => setError(null)}
										className="inline-flex text-red-400 hover:text-red-600 dark:hover:text-red-300"
									>
										<svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
											<path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
										</svg>
									</button>
								</div>
							</div>
						</div>
					)}

					{/* Actions */}
					<div className="mb-6 flex justify-between items-center">
						<div className="flex space-x-4">
							<button
								onClick={() => setShowCreateForm(true)}
								className="theme-btn-primary px-4 py-2 rounded-md transition-colors"
							>
								Add User
							</button>
							<button
								onClick={loadUsers}
								className="theme-btn-secondary px-4 py-2 rounded-md transition-colors"
							>
								Refresh
							</button>
						</div>
					</div>

					{/* Create/Edit User Form */}
					{(showCreateForm || editingUser) && (
						<div className="mb-8 theme-card shadow rounded-lg p-6">
						<h2 className="text-lg font-medium theme-text-primary mb-4">
							{editingUser ? `Edit User: ${editingUser.username}` : 'Create New User'}
						</h2>
						<form onSubmit={editingUser ? handleUpdateUser : handleCreateUser}>
							<div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
								{/* Username (only for create) */}
								{!editingUser && (
									<div>
										<label htmlFor="username" className="block text-sm font-medium theme-text-primary">
											Username
										</label>
										<input
											type="text"
											id="username"
											value={formData.username}
											onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
											className={`mt-1 block w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 theme-bg-card theme-text-primary ${
												formErrors.username ? 'border-red-300' : 'theme-border'
											}`}
											placeholder="Enter username"
										/>
										{formErrors.username && (
											<p className="mt-1 text-sm text-red-600">{formErrors.username}</p>
										)}
									</div>
								)}

								{/* Role */}
								<div>
									<label htmlFor="role" className="block text-sm font-medium theme-text-primary">
										Role
									</label>
									<select
										id="role"
										value={formData.role}
										onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as 'admin' | 'uploader' }))}
										className="mt-1 block w-full border theme-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 theme-bg-card theme-text-primary"
										disabled={editingUser?.username === currentUsername} // Can't change your own role
									>
										<option value="uploader">Uploader</option>
										<option value="admin">Admin</option>
									</select>
									{editingUser?.username === currentUsername && (
										<p className="mt-1 text-sm theme-text-secondary">You cannot change your own role</p>
									)}
								</div>

								{/* Password */}
								<div>
									<label htmlFor="password" className="block text-sm font-medium theme-text-primary">
										{editingUser ? 'New Password (leave blank to keep current)' : 'Password'}
									</label>
									<input
										type="password"
										id="password"
										value={formData.password}
										onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
										className={`mt-1 block w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 theme-bg-card theme-text-primary ${
											formErrors.password ? 'border-red-300' : 'theme-border'
										}`}
										placeholder={editingUser ? "Enter new password" : "Enter password"}
									/>
									{formErrors.password && (
										<p className="mt-1 text-sm text-red-600">{formErrors.password}</p>
									)}
								</div>

								{/* Confirm Password */}
								<div>
									<label htmlFor="confirmPassword" className="block text-sm font-medium theme-text-primary">
										Confirm Password
									</label>
									<input
										type="password"
										id="confirmPassword"
										value={formData.confirmPassword}
										onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
										className={`mt-1 block w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 theme-bg-card theme-text-primary ${
											formErrors.confirmPassword ? 'border-red-300' : 'theme-border'
										}`}
										placeholder="Confirm password"
									/>
									{formErrors.confirmPassword && (
										<p className="mt-1 text-sm text-red-600">{formErrors.confirmPassword}</p>
									)}
								</div>
							</div>

							{/* Form Actions */}
							<div className="mt-6 flex justify-end space-x-3">
								<button
									type="button"
									onClick={resetForm}
									className="theme-btn-secondary px-4 py-2 rounded-md transition-colors"
								>
									Cancel
								</button>
								<button
									type="submit"
									disabled={operationLoading[editingUser ? `edit-${editingUser.username}` : 'create']}
									className="theme-btn-primary px-4 py-2 rounded-md transition-colors disabled:opacity-50"
								>
									{operationLoading[editingUser ? `edit-${editingUser.username}` : 'create'] && (
										<span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
									)}
									{editingUser ? 'Update User' : 'Create User'}
								</button>
							</div>
						</form>
						</div>
					)}

					{/* Users List */}
					<div className="theme-card shadow rounded-lg overflow-hidden">
						<div className="px-6 py-4 border-b theme-border">
							<h2 className="text-lg font-medium theme-text-primary">Users ({users.length})</h2>
						</div>
						<div className="divide-y theme-border">
							{users.length === 0 ? (
								<div className="px-6 py-8 text-center theme-text-secondary">
									No users found.
								</div>
							) : (
								users.map((user) => (
									<div key={user.username} className="px-6 py-4 flex items-center justify-between theme-bg-card">
									<div className="flex items-center">
										<div>
											<div className="flex items-center">
												<h3 className="text-sm font-medium theme-text-primary">{user.username}</h3>
												{user.username === currentUsername && (
													<span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
														You
													</span>
												)}
											</div>
											<p className="text-sm theme-text-secondary">
												Role: <span className={`font-medium ${
													user.role === 'admin' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
												}`}>
													{user.role}
												</span>
											</p>
										</div>
									</div>
									<div className="flex items-center space-x-2">
										<button
											onClick={() => startEditUser(user)}
											className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium transition-colors"
										>
											Edit
										</button>
										<button
											onClick={() => handleDeleteUser(user.username)}
											disabled={user.username === currentUsername || operationLoading[`delete-${user.username}`]}
											className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
										>
											{operationLoading[`delete-${user.username}`] && (
												<span className="inline-block animate-spin rounded-full h-3 w-3 border-b border-red-600 mr-1"></span>
											)}
											Delete
										</button>
									</div>
								</div>
								))
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default UserManager;