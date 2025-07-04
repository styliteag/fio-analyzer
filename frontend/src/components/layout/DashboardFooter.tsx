// Dashboard footer component with links and information
import { Download, Book } from 'lucide-react';

interface DashboardFooterProps {
    getApiDocsUrl: () => string;
}

export const DashboardFooter: React.FC<DashboardFooterProps> = ({ getApiDocsUrl }) => {
    return (
        <footer className="theme-header mt-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="text-center">
                    <div className="text-sm theme-text-secondary mb-4">
                        <p>
                            Storage Performance Visualizer - Analyze FIO benchmark results
                            with interactive charts
                        </p>
                        <p className="mt-1">
                            Features: Multi-drive comparison, latency analysis, throughput
                            trends, and more
                        </p>
                    </div>

                    {/* Download Links */}
                    <div className="flex justify-center items-center space-x-6 text-sm">
                        <a
                            href="/script.sh"
                            className="inline-flex items-center px-3 py-2 theme-text-secondary hover:theme-text-primary transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
                            title="Download FIO testing script"
                        >
                            <Download className="h-4 w-4 mr-2" />
                            Testing Script
                        </a>
                        <span className="theme-text-secondary">•</span>
                        <a
                            href="/env.example"
                            download
                            className="inline-flex items-center px-3 py-2 theme-text-secondary hover:theme-text-primary transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
                            title="Download configuration template"
                        >
                            <Download className="h-4 w-4 mr-2" />
                            Config Template
                        </a>
                        <span className="theme-text-secondary">•</span>
                        <a
                            href={getApiDocsUrl()}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-3 py-2 theme-text-secondary hover:theme-text-primary transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
                            title="View interactive API documentation"
                        >
                            <Book className="h-4 w-4 mr-2" />
                            API Docs
                        </a>
                    </div>

                    <div className="mt-2 text-xs theme-text-secondary">
                        Download scripts to run automated FIO tests • View API documentation for integration
                    </div>
                </div>
            </div>
        </footer>
    );
};