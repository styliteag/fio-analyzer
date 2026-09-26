// Bulk edit of all test runs below one level of the Host-Protocol-Type-Model hierarchy
import { useCallback, useState } from 'react';
import { bulkUpdateTestRuns } from '../../../services/api/testRuns';
import { useToast } from '../../../contexts/ToastContext';
import { EMPTY_ENABLED_FIELDS, type HierarchyEditState } from '../types';
import { collectEnabledUpdates, commonEditableFields, fetchRunsByIds, plural } from '../utils';

const CLOSED: HierarchyEditState = {
    isOpen: false,
    testRunIds: [],
    count: 0,
    level: '',
    fields: {},
    enabledFields: EMPTY_ENABLED_FIELDS,
};

export const useHierarchyEdit = (onSaved: () => void) => {
    const toast = useToast();
    const [editState, setEditState] = useState<HierarchyEditState>(CLOSED);

    const openEdit = useCallback(
        async (testRunIds: number[], level: string) => {
            setEditState({ ...CLOSED, isOpen: true, testRunIds, count: testRunIds.length, level });
            try {
                const runs = await fetchRunsByIds(testRunIds);
                setEditState((prev) => ({ ...prev, fields: commonEditableFields(runs) }));
            } catch {
                toast.info('Could not pre-fill current values; fields start empty');
            }
        },
        [toast],
    );

    const closeEdit = useCallback(() => setEditState((prev) => ({ ...prev, isOpen: false })), []);

    const submitEdit = useCallback(async () => {
        const { testRunIds, fields, enabledFields, count } = editState;
        if (testRunIds.length === 0) return;

        const updates = collectEnabledUpdates(fields, enabledFields);
        if (Object.keys(updates).length === 0) {
            toast.error('Please enable and fill at least one field to update');
            return;
        }
        try {
            const result = await bulkUpdateTestRuns(testRunIds, updates);
            if (result.error) {
                throw new Error(result.error);
            }
            closeEdit();
            toast.success(`Updated ${count} test run${plural(count)}`);
            onSaved();
        } catch {
            toast.error('Failed to update test runs');
        }
    }, [editState, closeEdit, onSaved, toast]);

    return { editState, setEditState, openEdit, closeEdit, submitEdit };
};

export type HierarchyEdit = ReturnType<typeof useHierarchyEdit>;
