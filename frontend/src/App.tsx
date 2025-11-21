import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { LoginForm } from "./components/LoginForm";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Home from "./pages/Home";

import History from "./pages/History";
import Upload from "./pages/Upload";
import Admin from "./pages/Admin";
import UserManager from "./pages/UserManager";

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

			<Route path="/history" element={<History />} />

			<Route path="/host" element={<Host />} />
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
