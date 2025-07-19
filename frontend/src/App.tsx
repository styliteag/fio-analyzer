import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { LoginForm } from "./components/LoginForm";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Dashboard from "./pages/Dashboard";
import Home from "./pages/Home";
import Performance from "./pages/Performance";
import History from "./pages/History";
import Upload from "./pages/Upload";
import Admin from "./pages/Admin";
import UserManager from "./pages/UserManager";
import Compare from "./pages/Compare";
import Compare2 from "./pages/Compare2";
import Host from "./pages/Host";

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
			<Route path="/" element={<Home />} />
			<Route path="/dashboard" element={<Dashboard />} />
			<Route path="/performance" element={<Performance />} />
			<Route path="/history" element={<History />} />
			<Route path="/compare" element={<Compare />} />
			<Route path="/compare2" element={<Compare2 />} />
			<Route path="/host/:hostname?" element={<Host />} />
			<Route path="/upload" element={<Upload />} />
			<Route path="/admin" element={<Admin />} />
			<Route path="/users" element={<UserManager />} />
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
