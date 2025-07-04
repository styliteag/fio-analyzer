// Dashboard header component with navigation and user controls
import { Activity, Database, LogOut, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import ThemeToggle from '../ThemeToggle';

export const DashboardHeader: React.FC = () => {
    const navigate = useNavigate();
    const { username, logout } = useAuth();

    return (
        <header className="theme-header shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center">
                        <Activity className="h-8 w-8 theme-text-accent mr-3" />
                        <h1 className="text-2xl font-bold theme-text-primary">
                            Storage Performance Visualizer
                        </h1>
                    </div>
                    <div className="flex items-center space-x-4">
                        <ThemeToggle />
                        <button
                            type="button"
                            onClick={() => navigate("/upload")}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md theme-btn-primary transition-colors"
                        >
                            <Upload className="h-4 w-4 mr-2" />
                            Upload
                        </button>
                        <div className="flex items-center text-sm theme-text-secondary mr-4">
                            <Database className="h-4 w-4 mr-1" />
                            FIO Benchmark Analysis
                        </div>
                        <div className="flex items-center space-x-2">
                            <span className="text-sm theme-text-secondary">
                                Welcome, {username}
                            </span>
                            <button
                                type="button"
                                onClick={logout}
                                className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md theme-text-secondary hover:theme-text-primary transition-colors"
                                title="Logout"
                            >
                                <LogOut className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
};