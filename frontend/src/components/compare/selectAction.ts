// Multi-select changes as actions on the live list (the URL may be newer than the rendered value)
import type { ActionMeta } from 'react-select';

/** Apply one select action to the current list, so quick consecutive picks never overwrite each other */
export const applySelectAction = (current: readonly string[], meta: ActionMeta<{ readonly value: string }>): readonly string[] => {
    switch (meta.action) {
        case 'select-option':
        case 'create-option':
            return meta.option && !current.includes(meta.option.value) ? [...current, meta.option.value] : current;
        case 'deselect-option':
            return current.filter((item) => item !== meta.option?.value);
        case 'remove-value':
        case 'pop-value':
            return current.filter((item) => item !== meta.removedValue?.value);
        case 'clear':
            return [];
        default:
            return current;
    }
};
