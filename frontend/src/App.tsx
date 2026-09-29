import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { LoginForm } from "./components/LoginForm";
import { AppShell, RequireRole } from "./components/layout";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ConfirmProvider } from "./contexts/ConfirmContext";
import { ToastProvider } from "./contexts/ToastContext";
import Admin from "./pages/Admin";
import Compare from "./pages/Compare";
import History from "./pages/History";
import Home from "./pages/Home";
import Host from "./pages/Host";
import NotFound from "./pages/NotFound";
import Ramps from "./pages/Ramps";
import Saturation from "./pages/Saturation";
import Upload from "./pages/Upload";
import UserManager from "./pages/UserManager";

const ADMIN = ["admin"] as const;
const READERS = ["admin", "viewer"] as const;
const UPLOADERS = ["admin", "uploader"] as const;

const adminOnly = (page: React.ReactNode) => <RequireRole roles={ADMIN}>{page}</RequireRole>;
const readersOnly = (page: React.ReactNode) => <RequireRole roles={READERS}>{page}</RequireRole>;

const ProtectedApp = () => {
	const { isAuthenticated, canRead, login, loading, error } = useAuth();

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
				<Route path="/" element={canRead ? <Home /> : <Navigate to="/upload" replace />} />
				<Route path="/host" element={readersOnly(<Host />)} />
				<Route path="/history" element={readersOnly(<History />)} />
				<Route path="/saturation" element={readersOnly(<Saturation />)} />
				<Route path="/ramps" element={readersOnly(<Ramps />)} />
				<Route path="/compare" element={readersOnly(<Compare />)} />
				<Route path="/upload" element={<RequireRole roles={UPLOADERS}><Upload /></RequireRole>} />
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
