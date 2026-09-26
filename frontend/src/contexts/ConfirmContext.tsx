// Promise-based confirmation dialog (replacement for window.confirm)
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';

export interface ConfirmOptions {
    readonly title: string;
    readonly message: ReactNode;
    readonly confirmLabel?: string;
    readonly cancelLabel?: string;
    readonly danger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | undefined>(undefined);

export const ConfirmProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [options, setOptions] = useState<ConfirmOptions | null>(null);
    const resolver = useRef<((value: boolean) => void) | null>(null);

    const confirm = useCallback<ConfirmFn>(
        (next) =>
            new Promise<boolean>((resolve) => {
                resolver.current = resolve;
                setOptions(next);
            }),
        [],
    );

    const settle = useCallback((value: boolean) => {
        resolver.current?.(value);
        resolver.current = null;
        setOptions(null);
    }, []);

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}
            <Modal
                isOpen={options !== null}
                onClose={() => settle(false)}
                title={options?.title}
                size="sm"
                footer={
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => settle(false)}>
                            {options?.cancelLabel ?? 'Cancel'}
                        </Button>
                        <Button variant={options?.danger ? 'danger' : 'primary'} onClick={() => settle(true)}>
                            {options?.confirmLabel ?? 'Confirm'}
                        </Button>
                    </div>
                }
            >
                <div className="text-sm theme-text-secondary">{options?.message}</div>
            </Modal>
        </ConfirmContext.Provider>
    );
};

export const useConfirm = (): ConfirmFn => {
    const context = useContext(ConfirmContext);
    if (!context) {
        throw new Error('useConfirm must be used within a ConfirmProvider');
    }
    return context;
};
