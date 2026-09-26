// Generic set of expanded keys with an immutable toggle
import { useCallback, useState } from 'react';

export interface KeyedExpansion {
    isExpanded: (key: string) => boolean;
    toggle: (key: string) => void;
}

export const useKeyedExpansion = (): KeyedExpansion => {
    const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

    const toggle = useCallback((key: string) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    }, []);

    const isExpanded = useCallback((key: string) => expanded.has(key), [expanded]);

    return { isExpanded, toggle };
};
