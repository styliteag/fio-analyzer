import type React from "react";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import {
	forgetLegacyCredentials,
	sessionFetch,
	setSignedIn,
} from "../services/api/base";
import type { UserRole } from "../services/api/users";

interface AuthContextType {
	isAuthenticated: boolean;
	username: string | null;
	userRole: UserRole | null;
	isAdmin: boolean;
	isUploader: boolean;
	/** Can open the analysis pages (admin or read-only viewer) */
	canRead: boolean;
	login: (username: string, password: string) => Promise<void>;
	logout: () => Promise<void>;
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
	const [userRole, setUserRole] = useState<UserRole | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const apiUrl = import.meta.env.VITE_API_URL || "";

	const signIn = useCallback((name: string, role: UserRole) => {
		setSignedIn(true);
		setIsAuthenticated(true);
		setUsername(name);
		setUserRole(role);
	}, []);

	const signOut = useCallback(() => {
		setSignedIn(false);
		setIsAuthenticated(false);
		setUsername(null);
		setUserRole(null);
	}, []);

	// On app load: an existing session cookie signs the user in (the cookie itself is HttpOnly)
	useEffect(() => {
		forgetLegacyCredentials();
		sessionFetch(`${apiUrl}/api/users/me`)
			.then(async (response) => {
				if (!response.ok) return;
				const me = await response.json();
				signIn(me.username, me.role);
			})
			.catch(() => {
				// backend unreachable: show the login page
			})
			.finally(() => setLoading(false));
	}, [apiUrl, signIn]);

	const login = async (name: string, password: string): Promise<void> => {
		setLoading(true);
		setError(null);
		try {
			const response = await sessionFetch(`${apiUrl}/api/auth/login`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ username: name, password }),
			});
			if (response.ok) {
				const session = await response.json();
				signIn(session.username, session.role);
			} else if (response.status === 401) {
				setError("Invalid username or password");
			} else {
				setError(`Login failed (HTTP ${response.status})`);
			}
		} catch {
			setError(
				"Cannot connect to server. Please check if the backend is running.",
			);
		} finally {
			setLoading(false);
		}
	};

	const logout = async (): Promise<void> => {
		// Wait for the server to delete the session before the UI forgets the user
		try {
			await sessionFetch(`${apiUrl}/api/auth/logout`, { method: "POST" });
		} catch {
			// offline: the session still expires on the server
		}
		signOut();
		setError(null);
	};

	const value: AuthContextType = {
		isAuthenticated,
		username,
		userRole,
		isAdmin: userRole === 'admin',
		isUploader: userRole === 'uploader' || userRole === 'admin',
		canRead: userRole === 'admin' || userRole === 'viewer',
		login,
		logout,
		loading,
		error,
	};

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
