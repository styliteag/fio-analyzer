import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { LoginForm } from "./components/LoginForm";
import { AppShell, RequireRole } from "./components/layout";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ConfirmProvider } from "./contexts/ConfirmContext";
import { ToastProvider } from "./contexts/ToastContext";
import Admin from "./pages/Admin";
import History from "./pages/History";
import Home from "./pages/Home";
import Host from "./pages/Host";
import NotFound from "./pages/NotFound";
import Saturation from "./pages/Saturation";
import Upload from "./pages/Upload";
import UserManager from "./pages/UserManager";

const ADMIN = ["admin"] as const;
const ANY_ROLE = ["admin", "uploader"] as const;

const adminOnly = (page: React.ReactNode) => <RequireRole roles={ADMIN}>{page}</RequireRole>;

const ProtectedApp = () => {
	const { isAuthenticated, isAdmin, login, loading, error } = useAuth();

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
			</div>
		);
	}

	if (!isAuthenticated) {
		return (
			<LoginForm onLogin={login} error={error || undefined} loading={loading} />
		);
	}

	return (
		<Routes>
			<Route element={<AppShell />}>
				<Route path="/" element={isAdmin ? <Home /> : <Navigate to="/upload" replace />} />
				<Route path="/host" element={adminOnly(<Host />)} />
				<Route path="/history" element={adminOnly(<History />)} />
				<Route path="/saturation" element={adminOnly(<Saturation />)} />
				<Route path="/upload" element={<RequireRole roles={ANY_ROLE}><Upload /></RequireRole>} />
				<Route path="/admin" element={adminOnly(<Admin />)} />
				<Route path="/users" element={adminOnly(<UserManager />)} />
				<Route path="*" element={<NotFound />} />
			</Route>
		</Routes>
	);
};

function App() {
	return (
		<AuthProvider>
			<ToastProvider>
				<ConfirmProvider>
					<Router>
						<ProtectedApp />
					</Router>
				</ConfirmProvider>
			</ToastProvider>
		</AuthProvider>
	);
}

export default App;
