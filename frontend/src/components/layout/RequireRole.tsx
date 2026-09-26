// Route guard: renders children only for users with an allowed role
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { EmptyState } from '../ui/ErrorDisplay';
import { navItemsForRole, type NavRole } from './navItems';

interface RequireRoleProps {
    readonly roles: readonly NavRole[];
    readonly children: ReactNode;
}

export const RequireRole: React.FC<RequireRoleProps> = ({ roles, children }) => {
    const { userRole } = useAuth();

    if (userRole && roles.includes(userRole)) {
        return <>{children}</>;
    }

    const fallback = navItemsForRole(userRole)[0];

    return (
        <div className="max-w-2xl mx-auto px-4 py-16">
            <EmptyState
                icon={<ShieldAlert className="h-12 w-12" />}
                title="Access denied"
                description={`Your account (${userRole ?? 'unknown role'}) cannot open this page.`}
                action={
                    fallback && (
                        <Link to={fallback.to} className="px-4 py-2 rounded-lg text-sm font-medium theme-btn-primary">
                            Go to {fallback.label}
                        </Link>
                    )
                }
            />
        </div>
    );
};
