/**
 * User Manager page - Admin interface for managing users
 */

import React, { useState, useEffect } from 'react';
import { User, getUsers, createUser, updateUser, deleteUser, UserCreate, UserUpdate, type UserRole } from '../services/api/users';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader } from '../components/layout';
import { ErrorDisplay, Loading } from '../components/ui';
import { useConfirm } from '../contexts/ConfirmContext';
import { useToast } from '../contexts/ToastContext';

interface UserFormData {
	username: string;
	password: string;
	confirmPassword: string;
	role: UserRole;
}

const UserManager: React.FC = () => {
	const { username: currentUsername } = useAuth();
	const confirm = useConfirm();
	const toast = useToast();
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

	// Load users on component mount (route is admin-only via RequireRole)
	useEffect(() => {
		loadUsers();
	}, []);

	const loadUsers = async () => {
		try {
			setLoading(true);
			setError(null);
			const usersData = await getUsers();
			setUsers(usersData);
		} catch (err) {
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
			toast.success(`User "${userData.username}" created`);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to create user');
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
			toast.success(`User "${editingUser.username}" updated`);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to update user');
		} finally {
			setOperationLoading(prev => ({ ...prev, [operationKey]: false }));
		}
	};

	const handleDeleteUser = async (username: string) => {
		const confirmed = await confirm({
			title: 'Delete user',
			message: `Delete user "${username}"? They will no longer be able to log in or upload.`,
			confirmLabel: 'Delete',
			danger: true,
		});
		if (!confirmed) return;

		const operationKey = `delete-${username}`;
		setOperationLoading(prev => ({ ...prev, [operationKey]: true }));

		try {
			await deleteUser(username);
			await loadUsers();
			toast.success(`User "${username}" deleted`);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to delete user');
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
			<div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<Loading />
			</div>
		);
	}

	return (
		<div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
					<PageHeader
						title="User Management"
						description="Admins can view and manage all data. Viewers can see all data but change nothing. Uploaders can only upload FIO results (for example from fio-test.sh)."
					/>

					{error && (
						<div className="mb-6">
							<ErrorDisplay error={error} onRetry={loadUsers} showRetry />
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
										onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as UserRole }))}
										className="mt-1 block w-full border theme-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 theme-bg-card theme-text-primary"
										disabled={editingUser?.username === currentUsername} // Can't change your own role
									>
										<option value="viewer">Viewer (read-only)</option>
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
	);
};

export default UserManager;