import { Lock, User } from "lucide-react";
import type React from "react";
import { useState } from "react";

interface LoginFormProps {
	onLogin: (username: string, password: string) => Promise<void>;
	error?: string;
	loading?: boolean;
}

export const LoginForm: React.FC<LoginFormProps> = ({
	onLogin,
	error,
	loading,
}) => {
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (username.trim() && password.trim()) {
			await onLogin(username.trim(), password);
		}
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
			<div className="max-w-md w-full space-y-8">
				<div>
					<div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
						<Lock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
					</div>
					<h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
						Sign in to FIO Analyzer
					</h2>
					<p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
						Storage Performance Visualizer
					</p>
				</div>
				<form className="mt-8 space-y-6" onSubmit={handleSubmit}>
					<div className="rounded-md shadow-sm -space-y-px">
						<div>
							<label htmlFor="username" className="sr-only">
								Username
							</label>
							<div className="relative">
								<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
									<User className="h-5 w-5 text-gray-400" />
								</div>
								<input
									id="username"
									name="username"
									type="text"
									autoComplete="username"
									required
									className="appearance-none rounded-none relative block w-full px-3 py-2 pl-10 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-800 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
									placeholder="Username"
									value={username}
									onChange={(e) => setUsername(e.target.value)}
									disabled={loading}
								/>
							</div>
						</div>
						<div>
							<label htmlFor="password" className="sr-only">
								Password
							</label>
							<div className="relative">
								<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
									<Lock className="h-5 w-5 text-gray-400" />
								</div>
								<input
									id="password"
									name="password"
									type="password"
									autoComplete="current-password"
									required
									className="appearance-none rounded-none relative block w-full px-3 py-2 pl-10 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-800 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
									placeholder="Password"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									disabled={loading}
								/>
							</div>
						</div>
					</div>

					{error && (
						<div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
							<div className="text-sm text-red-700 dark:text-red-400">
								{error}
							</div>
						</div>
					)}

					<div>
						<button
							type="submit"
							disabled={loading || !username.trim() || !password.trim()}
							className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{loading ? (
								<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
							) : (
								"Sign in"
							)}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
};
