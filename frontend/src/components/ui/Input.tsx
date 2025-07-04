// Reusable Input components
import React, { forwardRef } from 'react';
import { type LucideIcon } from 'lucide-react';
import { InlineError } from './ErrorDisplay';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
    label?: string;
    error?: string;
    helpText?: string;
    leftIcon?: LucideIcon;
    rightIcon?: LucideIcon;
    onRightIconClick?: () => void;
    size?: 'sm' | 'md' | 'lg';
    variant?: 'default' | 'filled';
    fullWidth?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(({
    label,
    error,
    helpText,
    leftIcon: LeftIcon,
    rightIcon: RightIcon,
    onRightIconClick,
    size = 'md',
    variant = 'default',
    fullWidth = true,
    className = '',
    ...props
}, ref) => {
    const sizeClasses = {
        sm: 'px-3 py-2 text-sm',
        md: 'px-3 py-2 text-sm',
        lg: 'px-4 py-3 text-base',
    };

    const variantClasses = {
        default: 'border theme-border-primary theme-bg-primary',
        filled: 'border-0 theme-bg-secondary',
    };

    const baseClasses = 'rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors theme-text-primary';
    const errorClasses = error ? 'border-red-500 focus:ring-red-500' : '';
    const iconPadding = LeftIcon ? 'pl-10' : RightIcon ? 'pr-10' : '';
    const widthClasses = fullWidth ? 'w-full' : '';

    const inputClasses = [
        baseClasses,
        sizeClasses[size],
        variantClasses[variant],
        errorClasses,
        iconPadding,
        widthClasses,
        className,
    ].filter(Boolean).join(' ');

    return (
        <div className={fullWidth ? 'w-full' : ''}>
            {label && (
                <label className="block text-sm font-medium mb-2 theme-text-primary">
                    {label}
                    {props.required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}
            
            <div className="relative">
                {LeftIcon && (
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <LeftIcon size={18} className="theme-text-tertiary" />
                    </div>
                )}
                
                <input
                    ref={ref}
                    className={inputClasses}
                    {...props}
                />
                
                {RightIcon && (
                    <div className={`absolute inset-y-0 right-0 pr-3 flex items-center ${onRightIconClick ? 'cursor-pointer' : 'pointer-events-none'}`}>
                        <RightIcon 
                            size={18} 
                            className="theme-text-tertiary" 
                            onClick={onRightIconClick}
                        />
                    </div>
                )}
            </div>
            
            {error && <InlineError error={error} />}
            {helpText && !error && (
                <p className="mt-1 text-sm theme-text-tertiary">
                    {helpText}
                </p>
            )}
        </div>
    );
});

Input.displayName = 'Input';

// Textarea component
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    error?: string;
    helpText?: string;
    resize?: 'none' | 'vertical' | 'horizontal' | 'both';
    fullWidth?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({
    label,
    error,
    helpText,
    resize = 'vertical',
    fullWidth = true,
    className = '',
    ...props
}, ref) => {
    const baseClasses = 'border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors theme-border-primary theme-bg-primary theme-text-primary';
    const errorClasses = error ? 'border-red-500 focus:ring-red-500' : '';
    const resizeClasses = `resize-${resize}`;
    const widthClasses = fullWidth ? 'w-full' : '';

    const textareaClasses = [
        baseClasses,
        errorClasses,
        resizeClasses,
        widthClasses,
        className,
    ].filter(Boolean).join(' ');

    return (
        <div className={fullWidth ? 'w-full' : ''}>
            {label && (
                <label className="block text-sm font-medium mb-2 theme-text-primary">
                    {label}
                    {props.required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}
            
            <textarea
                ref={ref}
                className={textareaClasses}
                {...props}
            />
            
            {error && <InlineError error={error} />}
            {helpText && !error && (
                <p className="mt-1 text-sm theme-text-tertiary">
                    {helpText}
                </p>
            )}
        </div>
    );
});

Textarea.displayName = 'Textarea';

// Select component
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    error?: string;
    helpText?: string;
    options: Array<{ value: string | number; label: string; disabled?: boolean }>;
    placeholder?: string;
    fullWidth?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({
    label,
    error,
    helpText,
    options,
    placeholder,
    fullWidth = true,
    className = '',
    ...props
}, ref) => {
    const baseClasses = 'border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors theme-border-primary theme-bg-primary theme-text-primary';
    const errorClasses = error ? 'border-red-500 focus:ring-red-500' : '';
    const widthClasses = fullWidth ? 'w-full' : '';

    const selectClasses = [
        baseClasses,
        errorClasses,
        widthClasses,
        className,
    ].filter(Boolean).join(' ');

    return (
        <div className={fullWidth ? 'w-full' : ''}>
            {label && (
                <label className="block text-sm font-medium mb-2 theme-text-primary">
                    {label}
                    {props.required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}
            
            <select
                ref={ref}
                className={selectClasses}
                {...props}
            >
                {placeholder && (
                    <option value="" disabled>
                        {placeholder}
                    </option>
                )}
                {options.map((option) => (
                    <option 
                        key={option.value} 
                        value={option.value}
                        disabled={option.disabled}
                    >
                        {option.label}
                    </option>
                ))}
            </select>
            
            {error && <InlineError error={error} />}
            {helpText && !error && (
                <p className="mt-1 text-sm theme-text-tertiary">
                    {helpText}
                </p>
            )}
        </div>
    );
});

Select.displayName = 'Select';

// Checkbox component
export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
    label?: string;
    error?: string;
    helpText?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(({
    label,
    error,
    helpText,
    className = '',
    ...props
}, ref) => {
    return (
        <div className="flex items-start">
            <div className="flex items-center h-5">
                <input
                    ref={ref}
                    type="checkbox"
                    className={`w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 theme-border-primary ${className}`}
                    {...props}
                />
            </div>
            {label && (
                <div className="ml-3 text-sm">
                    <label className="font-medium theme-text-primary">
                        {label}
                        {props.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    {helpText && !error && (
                        <p className="theme-text-tertiary">
                            {helpText}
                        </p>
                    )}
                    {error && <InlineError error={error} />}
                </div>
            )}
        </div>
    );
});

Checkbox.displayName = 'Checkbox';

// Radio component
export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
    label?: string;
    error?: string;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(({
    label,
    error,
    className = '',
    ...props
}, ref) => {
    return (
        <div className="flex items-center">
            <input
                ref={ref}
                type="radio"
                className={`w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 theme-border-primary ${className}`}
                {...props}
            />
            {label && (
                <label className="ml-3 text-sm font-medium theme-text-primary">
                    {label}
                    {props.required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}
            {error && <InlineError error={error} className="ml-7" />}
        </div>
    );
});

Radio.displayName = 'Radio';

export default Input;