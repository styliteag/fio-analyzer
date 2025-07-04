// Reusable Card component
import React from 'react';
import { type LucideIcon } from 'lucide-react';

export interface CardProps {
    children: React.ReactNode;
    title?: string;
    subtitle?: string;
    icon?: LucideIcon;
    variant?: 'default' | 'bordered' | 'elevated' | 'flat';
    padding?: 'none' | 'sm' | 'md' | 'lg';
    className?: string;
    headerActions?: React.ReactNode;
    footer?: React.ReactNode;
}

const Card: React.FC<CardProps> = ({
    children,
    title,
    subtitle,
    icon: Icon,
    variant = 'default',
    padding = 'md',
    className = '',
    headerActions,
    footer,
}) => {
    const baseClasses = 'theme-card rounded-lg';
    
    const variantClasses = {
        default: 'border theme-border-primary',
        bordered: 'border-2 theme-border-primary',
        elevated: 'shadow-lg border theme-border-primary',
        flat: 'border-0',
    };
    
    const paddingClasses = {
        none: '',
        sm: 'p-3',
        md: 'p-4',
        lg: 'p-6',
    };
    
    const classes = [
        baseClasses,
        variantClasses[variant],
        paddingClasses[padding],
        className,
    ].filter(Boolean).join(' ');

    const hasHeader = title || subtitle || Icon || headerActions;

    return (
        <div className={classes}>
            {hasHeader && (
                <div className={`flex items-start justify-between ${padding !== 'none' ? 'mb-4' : 'p-4 pb-0'}`}>
                    <div className="flex items-start">
                        {Icon && (
                            <div className="mr-3 mt-0.5">
                                <Icon size={20} className="theme-text-secondary" />
                            </div>
                        )}
                        <div>
                            {title && (
                                <h3 className="text-lg font-semibold theme-text-primary">
                                    {title}
                                </h3>
                            )}
                            {subtitle && (
                                <p className="text-sm theme-text-secondary mt-1">
                                    {subtitle}
                                </p>
                            )}
                        </div>
                    </div>
                    {headerActions && (
                        <div className="flex items-center space-x-2">
                            {headerActions}
                        </div>
                    )}
                </div>
            )}
            
            <div className={hasHeader && padding === 'none' ? 'p-4 pt-0' : ''}>
                {children}
            </div>
            
            {footer && (
                <div className={`border-t theme-border-primary mt-4 pt-4 ${padding === 'none' ? 'mx-4 pb-4' : ''}`}>
                    {footer}
                </div>
            )}
        </div>
    );
};

// Card section components for flexible layouts
export interface CardHeaderProps {
    children: React.ReactNode;
    className?: string;
}

export const CardHeader: React.FC<CardHeaderProps> = ({ children, className = '' }) => (
    <div className={`border-b theme-border-primary pb-4 mb-4 ${className}`}>
        {children}
    </div>
);

export interface CardBodyProps {
    children: React.ReactNode;
    className?: string;
}

export const CardBody: React.FC<CardBodyProps> = ({ children, className = '' }) => (
    <div className={className}>
        {children}
    </div>
);

export interface CardFooterProps {
    children: React.ReactNode;
    className?: string;
}

export const CardFooter: React.FC<CardFooterProps> = ({ children, className = '' }) => (
    <div className={`border-t theme-border-primary pt-4 mt-4 ${className}`}>
        {children}
    </div>
);

export default Card;