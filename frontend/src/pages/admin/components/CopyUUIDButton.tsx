import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface CopyUUIDButtonProps {
    readonly uuid: string;
    readonly compact?: boolean;
}

const COPIED_RESET_MS = 2000;

export const CopyUUIDButton: React.FC<CopyUUIDButtonProps> = ({ uuid, compact = false }) => {
    const [copied, setCopied] = useState(false);
    const timer = useRef<number | undefined>(undefined);

    useEffect(() => () => window.clearTimeout(timer.current), []);

    const copy = useCallback(() => {
        navigator.clipboard.writeText(uuid);
        setCopied(true);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setCopied(false), COPIED_RESET_MS);
    }, [uuid]);

    const iconSize = compact ? 'w-3.5 h-3.5' : 'w-4 h-4';
    const className = compact
        ? 'flex-shrink-0 p-0.5 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors'
        : 'p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors';

    return (
        <button type="button" onClick={copy} className={className} title="Copy UUID" aria-label="Copy UUID">
            {copied ? (
                <Check className={`${iconSize} text-green-600 dark:text-green-400`} />
            ) : (
                <Copy className={`${iconSize} ${compact ? '' : 'text-gray-500 dark:text-gray-400'}`} />
            )}
        </button>
    );
};
