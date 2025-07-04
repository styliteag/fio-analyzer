// Reusable Modal component
import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import Button from './Button';

export interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    showCloseButton?: boolean;
    closeOnOverlayClick?: boolean;
    closeOnEscape?: boolean;
    footer?: React.ReactNode;
    className?: string;
}

const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    size = 'md',
    showCloseButton = true,
    closeOnOverlayClick = true,
    closeOnEscape = true,
    footer,
    className = '',
}) => {
    const modalRef = useRef<HTMLDivElement>(null);

    const sizeClasses = {
        sm: 'max-w-md',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl',
        full: 'max-w-full mx-4',
    };

    // Handle escape key
    useEffect(() => {
        if (!isOpen || !closeOnEscape) return;

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, closeOnEscape, onClose]);

    // Handle body scroll lock
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }

        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    // Focus management
    useEffect(() => {
        if (isOpen && modalRef.current) {
            modalRef.current.focus();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleOverlayClick = (event: React.MouseEvent) => {
        if (closeOnOverlayClick && event.target === event.currentTarget) {
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div 
                className="flex min-h-screen items-center justify-center p-4"
                onClick={handleOverlayClick}
            >
                {/* Backdrop */}
                <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" />
                
                {/* Modal */}
                <div
                    ref={modalRef}
                    className={`relative w-full ${sizeClasses[size]} transform rounded-lg bg-white shadow-xl transition-all theme-card ${className}`}
                    tabIndex={-1}
                >
                    {/* Header */}
                    {(title || showCloseButton) && (
                        <div className="flex items-center justify-between border-b px-6 py-4 theme-border-primary">
                            {title && (
                                <h2 className="text-lg font-semibold theme-text-primary">
                                    {title}
                                </h2>
                            )}
                            {showCloseButton && (
                                <button
                                    onClick={onClose}
                                    className="text-gray-400 hover:text-gray-600 transition-colors theme-text-secondary hover:theme-text-primary"
                                >
                                    <X size={20} />
                                </button>
                            )}
                        </div>
                    )}

                    {/* Body */}
                    <div className="px-6 py-4">
                        {children}
                    </div>

                    {/* Footer */}
                    {footer && (
                        <div className="border-t px-6 py-4 bg-gray-50 rounded-b-lg theme-bg-secondary theme-border-primary">
                            {footer}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Confirmation modal
export interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
    loading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'info',
    loading = false,
}) => {
    const confirmVariant = variant === 'danger' ? 'danger' : 'primary';

    const footer = (
        <div className="flex justify-end space-x-3">
            <Button
                variant="outline"
                onClick={onClose}
                disabled={loading}
            >
                {cancelText}
            </Button>
            <Button
                variant={confirmVariant}
                onClick={onConfirm}
                loading={loading}
            >
                {confirmText}
            </Button>
        </div>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            size="sm"
            footer={footer}
            closeOnOverlayClick={!loading}
            closeOnEscape={!loading}
        >
            <p className="theme-text-secondary">
                {message}
            </p>
        </Modal>
    );
};

// Modal hooks for imperative usage
export const useModal = () => {
    const [isOpen, setIsOpen] = React.useState(false);

    const open = React.useCallback(() => setIsOpen(true), []);
    const close = React.useCallback(() => setIsOpen(false), []);
    const toggle = React.useCallback(() => setIsOpen(prev => !prev), []);

    return {
        isOpen,
        open,
        close,
        toggle,
    };
};

// Modal context for nested modals
interface ModalContextValue {
    openModals: number;
    registerModal: () => void;
    unregisterModal: () => void;
}

const ModalContext = React.createContext<ModalContextValue>({
    openModals: 0,
    registerModal: () => {},
    unregisterModal: () => {},
});

export const ModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [openModals, setOpenModals] = React.useState(0);

    const registerModal = React.useCallback(() => {
        setOpenModals(prev => prev + 1);
    }, []);

    const unregisterModal = React.useCallback(() => {
        setOpenModals(prev => Math.max(0, prev - 1));
    }, []);

    return (
        <ModalContext.Provider value={{ openModals, registerModal, unregisterModal }}>
            {children}
        </ModalContext.Provider>
    );
};

export const useModalContext = () => React.useContext(ModalContext);

export default Modal;