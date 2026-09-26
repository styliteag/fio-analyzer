// Application footer with version and resource links
import { Download, Book } from 'lucide-react';
import { useApiInfo } from '../../hooks/api/useApiInfo';
import { getApiDocsUrl, TESTING_SCRIPT_URL } from '../../utils/apiDocs';

const footerLinkClass =
    'inline-flex items-center gap-2 px-3 py-2 rounded-md theme-nav-link';

export const DashboardFooter: React.FC = () => {
    const { version } = useApiInfo();

    return (
        <footer className="theme-header border-t">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm theme-text-secondary">
                <p>
                    FIO Analyzer
                    {version && <span className="ml-2 text-xs opacity-75">v{version}</span>}
                </p>
                <div className="flex items-center gap-2">
                    <a
                        href={TESTING_SCRIPT_URL}
                        className={footerLinkClass}
                        title="Download fio-test.sh, then run ./fio-test.sh --generate-env to create a configuration"
                    >
                        <Download className="h-4 w-4" aria-hidden="true" />
                        Testing Script
                    </a>
                    <a
                        href={getApiDocsUrl()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={footerLinkClass}
                        title="Interactive API documentation"
                    >
                        <Book className="h-4 w-4" aria-hidden="true" />
                        API Docs
                    </a>
                </div>
            </div>
        </footer>
    );
};
