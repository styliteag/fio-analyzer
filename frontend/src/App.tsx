import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { LoginForm } from "./components/LoginForm";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Dashboard from "./pages/Dashboard";
import Upload from "./pages/Upload";
import Admin from "./pages/Admin";

const ProtectedApp = () => {
	const { isAuthenticated, login, loading, error } = useAuth();

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
			<Route path="/" element={<Dashboard />} />
			<Route path="/upload" element={<Upload />} />
			<Route path="/admin" element={<Admin />} />
		</Routes>
	);
};

function App() {
	return (
		<AuthProvider>
			<Router>
				<ProtectedApp />
			</Router>
		</AuthProvider>
	);
}

export default App;
