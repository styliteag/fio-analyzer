import type { ReactNode } from 'react';
import Button from '../../../components/ui/Button';

interface DeleteWarningProps {
    readonly children: ReactNode;
    readonly details: ReactNode;
    readonly confirmLabel: string;
    readonly onConfirm: () => void;
    readonly onCancel: () => void;
}

/** Red warning box + Delete/Cancel buttons shared by the delete modals. */
export const DeleteWarning: React.FC<DeleteWarningProps> = ({ children, details, confirmLabel, onConfirm, onCancel }) => (
    <div className="space-y-4">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-sm text-red-800 dark:text-red-200">
                <strong>Warning:</strong> {children}
            </p>
            {details}
        </div>
        <div className="flex gap-2">
            <Button variant="danger" onClick={onConfirm} className="flex-1">
                {confirmLabel}
            </Button>
            <Button variant="outline" onClick={onCancel}>
                Cancel
            </Button>
        </div>
    </div>
);
