// Reusable Button component
import React from 'react';
import { type LucideIcon } from 'lucide-react';

export interface ButtonProps {
    children: React.ReactNode;
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
    loading?: boolean;
    icon?: LucideIcon;
    iconPosition?: 'left' | 'right';
    fullWidth?: boolean;
    type?: 'button' | 'submit' | 'reset';
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
    className?: string;
}

const Button: React.FC<ButtonProps> = ({
    children,
    variant = 'primary',
    size = 'md',
    disabled = false,
    loading = false,
    icon: Icon,
    iconPosition = 'left',
    fullWidth = false,
    type = 'button',
    onClick,
    className = '',
}) => {
    const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
    
    const variantClasses = {
        primary: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500',
        secondary: 'bg-gray-600 hover:bg-gray-700 text-white focus:ring-gray-500',
        outline: 'border border-gray-300 hover:bg-gray-50 text-gray-700 focus:ring-blue-500 theme-border-primary theme-text-primary hover:theme-bg-tertiary',
        ghost: 'hover:bg-gray-100 text-gray-700 focus:ring-blue-500 theme-text-primary hover:theme-bg-tertiary',
        danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500',
    };
    
    const sizeClasses = {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2 text-sm',
        lg: 'px-6 py-3 text-base',
    };
    
    const widthClasses = fullWidth ? 'w-full' : '';
    
    const classes = [
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        widthClasses,
        className,
    ].filter(Boolean).join(' ');

    const iconElement = Icon && (
        <Icon 
            size={size === 'sm' ? 16 : size === 'lg' ? 20 : 18} 
            className={`${iconPosition === 'left' ? 'mr-2' : 'ml-2'}`}
        />
    );

    const loadingSpinner = (
        <svg 
            className="animate-spin h-4 w-4 mr-2" 
            xmlns="http://www.w3.org/2000/svg" 
            fill="none" 
            viewBox="0 0 24 24"
        >
            <circle 
                className="opacity-25" 
                cx="12" 
                cy="12" 
                r="10" 
                stroke="currentColor" 
                strokeWidth="4"
            />
            <path 
                className="opacity-75" 
                fill="currentColor" 
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
        </svg>
    );

    return (
        <button
            type={type}
            className={classes}
            disabled={disabled || loading}
            onClick={onClick}
        >
            {loading && loadingSpinner}
            {!loading && iconPosition === 'left' && iconElement}
            <span>{children}</span>
            {!loading && iconPosition === 'right' && iconElement}
        </button>
    );
};

export default Button;