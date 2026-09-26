// Fallback page for unknown routes
import { Link, useLocation } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { EmptyState } from '../components/ui/ErrorDisplay';
import { useAuth } from '../contexts/AuthContext';
import { navItemsForRole } from '../components/layout/navItems';

const NotFound: React.FC = () => {
    const { pathname } = useLocation();
    const { userRole } = useAuth();
    const home = navItemsForRole(userRole)[0];

    return (
        <div className="max-w-2xl mx-auto px-4 py-16">
            <EmptyState
                icon={<Compass className="h-12 w-12" />}
                title="Page not found"
                description={`There is no page at ${pathname}.`}
                action={
                    home && (
                        <Link to={home.to} className="px-4 py-2 rounded-lg text-sm font-medium theme-btn-primary">
                            Go to {home.label}
                        </Link>
                    )
                }
            />
        </div>
    );
};

export default NotFound;
