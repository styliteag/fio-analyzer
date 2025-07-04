// Welcome guide component for new users
import { Activity, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const WelcomeGuide: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="theme-bg-accent border theme-border-accent rounded-lg p-6 text-center mt-8">
            <Activity className="h-12 w-12 theme-text-accent mx-auto mb-4" />
            <h3 className="text-lg font-medium theme-text-accent mb-2">
                Get Started with Performance Analysis
            </h3>
            <p className="theme-text-accent mb-4">
                Select test runs from the dropdown above to begin visualizing your
                storage performance data.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="theme-bg-card p-4 rounded border theme-border-accent">
                    <div className="font-medium theme-text-accent mb-1">
                        1. Select Test Runs
                    </div>
                    <div className="theme-text-accent">
                        Choose benchmark results to compare
                    </div>
                </div>
                <div className="theme-bg-card p-4 rounded border theme-border-accent">
                    <div className="font-medium theme-text-accent mb-1">
                        2. Pick a Template
                    </div>
                    <div className="theme-text-accent">
                        Select visualization type for your analysis
                    </div>
                </div>
                <div className="theme-bg-card p-4 rounded border theme-border-accent">
                    <div className="font-medium theme-text-accent mb-1">
                        3. Analyze Results
                    </div>
                    <div className="theme-text-accent">
                        Interactive charts with export options
                    </div>
                </div>
            </div>

            <div className="mt-6">
                <button
                    type="button"
                    onClick={() => navigate("/upload")}
                    className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md theme-btn-primary transition-colors"
                >
                    <Upload className="h-5 w-5 mr-2" />
                    Upload FIO Results
                </button>
            </div>
        </div>
    );
};