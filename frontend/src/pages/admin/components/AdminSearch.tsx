import { Search, X } from 'lucide-react';

interface AdminSearchProps {
    readonly value: string;
    readonly onChange: (value: string) => void;
}

export const AdminSearch: React.FC<AdminSearchProps> = ({ value, onChange }) => (
    <div className="mb-4">
        <div className="relative max-w-md">
            <Search
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 theme-text-secondary pointer-events-none"
                aria-hidden="true"
            />
            <input
                type="text"
                aria-label="Search test runs"
                placeholder="Search by hostname, protocol, drive, name, description, UUID..."
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full pl-10 pr-10 py-2 border theme-border-primary rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 theme-bg-card theme-text-primary placeholder-gray-400 dark:placeholder-gray-500"
            />
            {value && (
                <button
                    type="button"
                    onClick={() => onChange('')}
                    aria-label="Clear search"
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 theme-text-secondary hover:theme-text-primary"
                >
                    <X className="w-5 h-5" />
                </button>
            )}
        </div>
    </div>
);
