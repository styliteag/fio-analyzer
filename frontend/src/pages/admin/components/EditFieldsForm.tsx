// Checkbox-gated text inputs: only enabled fields are sent in a bulk update
import type { ReactNode } from 'react';
import Button from '../../../components/ui/Button';

interface EditFieldsFormProps<K extends string> {
    readonly notice: ReactNode;
    readonly fieldOrder: readonly K[];
    readonly values: Partial<Record<K, string>>;
    readonly enabled: Record<K, boolean>;
    readonly onToggle: (field: K, enabled: boolean) => void;
    readonly onChange: (field: K, value: string) => void;
    readonly submitLabel: string;
    readonly onSubmit: () => void;
    readonly onCancel: () => void;
}

const INPUT_CLASS =
    'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500';

const labelOf = (field: string): string => field.replace('_', ' ');

export const EditNotice: React.FC<{ readonly children: ReactNode; readonly detail: ReactNode }> = ({ children, detail }) => (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Warning:</strong> {children}
        </p>
        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-mono">{detail}</p>
    </div>
);

export const EditFieldsForm = <K extends string>({
    notice,
    fieldOrder,
    values,
    enabled,
    onToggle,
    onChange,
    submitLabel,
    onSubmit,
    onCancel,
}: EditFieldsFormProps<K>): React.ReactElement => (
    <div className="space-y-4">
        {notice}
        {fieldOrder.map((field) => (
            <div key={field} className="border theme-border-primary rounded-lg p-3">
                <label className="flex items-center gap-2 mb-2">
                    <input
                        type="checkbox"
                        checked={enabled[field]}
                        onChange={(e) => onToggle(field, e.target.checked)}
                        className="rounded"
                    />
                    <span className="font-medium text-sm capitalize theme-text-primary">{labelOf(field)}</span>
                </label>
                <input
                    type="text"
                    aria-label={labelOf(field)}
                    disabled={!enabled[field]}
                    value={values[field] || ''}
                    onChange={(e) => onChange(field, e.target.value)}
                    placeholder={`Enter new ${labelOf(field)}`}
                    className={INPUT_CLASS}
                />
            </div>
        ))}
        <div className="flex gap-2 pt-4">
            <Button onClick={onSubmit} className="flex-1">
                {submitLabel}
            </Button>
            <Button variant="outline" onClick={onCancel}>
                Cancel
            </Button>
        </div>
    </div>
);
