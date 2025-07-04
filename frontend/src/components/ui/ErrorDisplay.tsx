// Reusable Error Display component
import React from 'react';
import { AlertTriangle, RefreshCw, X, Info, AlertCircle, CheckCircle } from 'lucide-react';
import Button from './Button';

export interface ErrorDisplayProps {
    error: string | Error | null;
    variant?: 'error' | 'warning' | 'info' | 'success';
    size?: 'sm' | 'md' | 'lg';
    showIcon?: boolean;
    showRetry?: boolean;
    onRetry?: () => void;
    onDismiss?: () => void;
    className?: string;
    title?: string;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
    error,
    variant = 'error',
    size = 'md',
    showIcon = true,
    showRetry = false,
    onRetry,
    onDismiss,
    className = '',
    title,
}) => {
    if (!error) return null;

    const errorMessage = typeof error === 'string' ? error : error.message;

    const variantClasses = {
        error: 'bg-red-50 border-red-200 text-red-800',
        warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
        info: 'bg-blue-50 border-blue-200 text-blue-800',
        success: 'bg-green-50 border-green-200 text-green-800',
    };

    const iconClasses = {
        error: 'text-red-500',
        warning: 'text-yellow-500',
        info: 'text-blue-500',
        success: 'text-green-500',
    };

    const sizeClasses = {
        sm: 'p-3 text-sm',
        md: 'p-4 text-sm',
        lg: 'p-6 text-base',
    };

    const getIcon = () => {
        switch (variant) {
            case 'error':
                return <AlertTriangle size={20} />;
            case 'warning':
                return <AlertCircle size={20} />;
            case 'info':
                return <Info size={20} />;
            case 'success':
                return <CheckCircle size={20} />;
            default:
                return <AlertTriangle size={20} />;
        }
    };

    const classes = [
        'border rounded-lg',
        variantClasses[variant],
        sizeClasses[size],
        className,
    ].filter(Boolean).join(' ');

    return (
        <div className={classes}>
            <div className="flex items-start">
                {showIcon && (
                    <div className={`flex-shrink-0 mr-3 ${iconClasses[variant]}`}>
                        {getIcon()}
                    </div>
                )}
                
                <div className="flex-1 min-w-0">
                    {title && (
                        <h3 className="font-medium mb-1">
                            {title}
                        </h3>
                    )}
                    <p className="leading-relaxed">
                        {errorMessage}
                    </p>
                </div>

                <div className="flex items-center ml-3 space-x-2">
                    {showRetry && onRetry && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onRetry}
                            icon={RefreshCw}
                            className="text-current hover:bg-black hover:bg-opacity-10"
                        >
                            Retry
                        </Button>
                    )}
                    
                    {onDismiss && (
                        <button
                            onClick={onDismiss}
                            className="text-current hover:bg-black hover:bg-opacity-10 rounded p-1 transition-colors"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// Inline error component for form fields
export interface InlineErrorProps {
    error?: string;
    className?: string;
}

export const InlineError: React.FC<InlineErrorProps> = ({ 
    error, 
    className = '' 
}) => {
    if (!error) return null;

    return (
        <div className={`flex items-center mt-1 text-sm text-red-600 ${className}`}>
            <AlertTriangle size={14} className="mr-1 flex-shrink-0" />
            <span>{error}</span>
        </div>
    );
};

// Error boundary component
interface ErrorBoundaryState {
    hasError: boolean;
    error?: Error;
}

export interface ErrorBoundaryProps {
    children: React.ReactNode;
    fallback?: React.ComponentType<{ error: Error; retry: () => void }>;
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        this.props.onError?.(error, errorInfo);
    }

    retry = () => {
        this.setState({ hasError: false, error: undefined });
    };

    render() {
        if (this.state.hasError && this.state.error) {
            const FallbackComponent = this.props.fallback;
            
            if (FallbackComponent) {
                return <FallbackComponent error={this.state.error} retry={this.retry} />;
            }

            return (
                <ErrorDisplay
                    error={this.state.error}
                    title="Something went wrong"
                    showRetry
                    onRetry={this.retry}
                    variant="error"
                    className="m-4"
                />
            );
        }

        return this.props.children;
    }
}

// Empty state component for when there's no data
export interface EmptyStateProps {
    title: string;
    description?: string;
    action?: React.ReactNode;
    icon?: React.ReactNode;
    className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    title,
    description,
    action,
    icon,
    className = '',
}) => (
    <div className={`text-center py-12 ${className}`}>
        {icon && (
            <div className="flex justify-center mb-4 theme-text-tertiary">
                {icon}
            </div>
        )}
        <h3 className="text-lg font-medium theme-text-primary mb-2">
            {title}
        </h3>
        {description && (
            <p className="theme-text-secondary mb-6 max-w-sm mx-auto">
                {description}
            </p>
        )}
        {action && (
            <div className="flex justify-center">
                {action}
            </div>
        )}
    </div>
);

export default ErrorDisplay;