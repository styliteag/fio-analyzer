// Reusable Loading component
import React from 'react';
import { Loader2 } from 'lucide-react';

export interface LoadingProps {
    size?: 'sm' | 'md' | 'lg' | 'xl';
    variant?: 'spinner' | 'dots' | 'pulse' | 'skeleton';
    message?: string;
    overlay?: boolean;
    className?: string;
}

const Loading: React.FC<LoadingProps> = ({
    size = 'md',
    variant = 'spinner',
    message,
    overlay = false,
    className = '',
}) => {
    const sizeClasses = {
        sm: 'w-4 h-4',
        md: 'w-6 h-6',
        lg: 'w-8 h-8',
        xl: 'w-12 h-12',
    };

    const spinnerSizes = {
        sm: 16,
        md: 24,
        lg: 32,
        xl: 48,
    };

    const renderSpinner = () => (
        <div className={`flex items-center justify-center ${className}`}>
            <Loader2 
                size={spinnerSizes[size]} 
                className="animate-spin theme-text-secondary" 
            />
            {message && (
                <span className="ml-3 theme-text-secondary">{message}</span>
            )}
        </div>
    );

    const renderDots = () => (
        <div className={`flex items-center justify-center space-x-2 ${className}`}>
            <div className={`${sizeClasses[size]} bg-blue-600 rounded-full animate-pulse`} />
            <div className={`${sizeClasses[size]} bg-blue-600 rounded-full animate-pulse delay-75`} />
            <div className={`${sizeClasses[size]} bg-blue-600 rounded-full animate-pulse delay-150`} />
            {message && (
                <span className="ml-3 theme-text-secondary">{message}</span>
            )}
        </div>
    );

    const renderPulse = () => (
        <div className={`flex items-center justify-center ${className}`}>
            <div className={`${sizeClasses[size]} bg-blue-600 rounded-full animate-pulse`} />
            {message && (
                <span className="ml-3 theme-text-secondary">{message}</span>
            )}
        </div>
    );

    const renderSkeleton = () => (
        <div className={`animate-pulse ${className}`}>
            <div className="space-y-3">
                <div className="h-4 bg-gray-300 rounded theme-bg-tertiary" />
                <div className="space-y-2">
                    <div className="h-4 bg-gray-300 rounded theme-bg-tertiary" />
                    <div className="h-4 bg-gray-300 rounded w-5/6 theme-bg-tertiary" />
                </div>
            </div>
            {message && (
                <div className="mt-3 text-center theme-text-secondary text-sm">
                    {message}
                </div>
            )}
        </div>
    );

    const renderContent = () => {
        switch (variant) {
            case 'dots':
                return renderDots();
            case 'pulse':
                return renderPulse();
            case 'skeleton':
                return renderSkeleton();
            default:
                return renderSpinner();
        }
    };

    if (overlay) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 shadow-lg theme-card">
                    {renderContent()}
                </div>
            </div>
        );
    }

    return renderContent();
};


export default Loading;