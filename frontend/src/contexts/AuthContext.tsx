import type React from "react";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";

interface AuthContextType {
	isAuthenticated: boolean;
	username: string | null;
	userRole: 'admin' | 'uploader' | null;
	isAdmin: boolean;
	isUploader: boolean;
	login: (username: string, password: string) => Promise<void>;
	logout: () => void;
	loading: boolean;
	error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
	const context = useContext(AuthContext);
	if (context === undefined) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
};

interface AuthProviderProps {
	children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
	const [isAuthenticated, setIsAuthenticated] = useState(false);
	const [username, setUsername] = useState<string | null>(null);
	const [userRole, setUserRole] = useState<'admin' | 'uploader' | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const verifyCredentials = useCallback(async (credentials: string): Promise<{valid: boolean, role?: 'admin' | 'uploader'}> => {
		try {
			const response = await fetch(
				`${import.meta.env.VITE_API_URL || "."}/api/users/me`,
				{
					headers: {
						Authorization: `Basic ${credentials}`,
					},
				},
			);
			if (response.ok) {
				const userData = await response.json();
				return { valid: true, role: userData.role };
			}
			return { valid: false };
		} catch (error) {
			console.warn("Network error during credential verification:", error);
			return { valid: false };
		}
	}, []);

	// Check if user is already authenticated on app load
	useEffect(() => {
		const storedAuth = localStorage.getItem("fio-auth");
		if (storedAuth) {
			try {
				const { username: storedUsername, credentials } =
					JSON.parse(storedAuth);
				// Verify credentials are still valid by making a test API call
				verifyCredentials(credentials)
					.then(({ valid, role }) => {
						if (valid && role) {
							setIsAuthenticated(true);
							setUsername(storedUsername);
							setUserRole(role);
						} else {
							localStorage.removeItem("fio-auth");
						}
					})
					.finally(() => setLoading(false));
			} catch {
				localStorage.removeItem("fio-auth");
				setLoading(false);
			}
		} else {
			setLoading(false);
		}
	}, [verifyCredentials]);

	const login = async (username: string, password: string): Promise<void> => {
		setLoading(true);
		setError(null);

		try {
			// Create base64 encoded credentials
			const credentials = btoa(`${username}:${password}`);

			// Test the credentials and get user info
			const { valid, role } = await verifyCredentials(credentials);

			if (valid && role) {
				// Store credentials in localStorage
				localStorage.setItem(
					"fio-auth",
					JSON.stringify({
						username,
						credentials,
					}),
				);

				setIsAuthenticated(true);
				setUsername(username);
				setUserRole(role);
				setLoading(false);
			} else {
				setError("Invalid username or password");
				setLoading(false);
			}
		} catch (err) {
			console.error("Login network error:", err);
			setError(
				"Cannot connect to server. Please check if the backend is running.",
			);
			setLoading(false);
		}
	};

	const logout = () => {
		localStorage.removeItem("fio-auth");
		setIsAuthenticated(false);
		setUsername(null);
		setUserRole(null);
		setError(null);
	};

	const value: AuthContextType = {
		isAuthenticated,
		username,
		userRole,
		isAdmin: userRole === 'admin',
		isUploader: userRole === 'uploader' || userRole === 'admin',
		login,
		logout,
		loading,
		error,
	};

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
