// Non-blocking toast notifications (replacement for window.alert)
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface Toast {
    readonly id: number;
    readonly type: ToastType;
    readonly message: string;
}

interface ToastApi {
    readonly success: (message: string) => void;
    readonly error: (message: string) => void;
    readonly info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | undefined>(undefined);

const DISMISS_MS: Record<ToastType, number> = { success: 4000, info: 5000, error: 8000 };

const STYLES: Record<ToastType, { className: string; Icon: typeof Info }> = {
    success: { className: 'border-green-500 text-green-800 dark:text-green-200', Icon: CheckCircle2 },
    error: { className: 'border-red-500 text-red-800 dark:text-red-200', Icon: AlertCircle },
    info: { className: 'border-blue-500 text-blue-800 dark:text-blue-200', Icon: Info },
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<readonly Toast[]>([]);
    const nextId = useRef(0);

    const dismiss = useCallback((id: number) => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
    }, []);

    const push = useCallback(
        (type: ToastType, message: string) => {
            nextId.current += 1;
            const id = nextId.current;
            setToasts((current) => [...current, { id, type, message }]);
            window.setTimeout(() => dismiss(id), DISMISS_MS[type]);
        },
        [dismiss],
    );

    const api = useMemo<ToastApi>(
        () => ({
            success: (message) => push('success', message),
            error: (message) => push('error', message),
            info: (message) => push('info', message),
        }),
        [push],
    );

    return (
        <ToastContext.Provider value={api}>
            {children}
            <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm" aria-live="polite">
                {toasts.map(({ id, type, message }) => {
                    const { className, Icon } = STYLES[type];
                    return (
                        <div
                            key={id}
                            role={type === 'error' ? 'alert' : 'status'}
                            className={`flex items-start gap-3 rounded-lg border-l-4 p-3 shadow-lg theme-card ${className}`}
                        >
                            <Icon className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
                            <p className="flex-1 text-sm whitespace-pre-line theme-text-primary">{message}</p>
                            <button
                                type="button"
                                onClick={() => dismiss(id)}
                                className="theme-text-secondary hover:theme-text-primary"
                                aria-label="Dismiss notification"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
};

export const useToast = (): ToastApi => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};
