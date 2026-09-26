// Bulk edit / delete of all test runs sharing a config_uuid or run_uuid
import { useCallback, useState } from 'react';
import type { UseUUIDGroupedRunsReturn } from '../../../hooks/api/useUUIDGroupedRuns';
import { bulkUpdateTestRunsByUUID, deleteTestRuns } from '../../../services/api/testRuns';
import { useToast } from '../../../contexts/ToastContext';
import { EMPTY_ENABLED_FIELDS, type UUIDDeleteState, type UUIDEditState, type UUIDType } from '../types';
import { collectEnabledUpdates, commonEditableFields, fetchRunsByIds, plural } from '../utils';
import type { GroupExpansion } from './useGroupExpansion';

const CLOSED_EDIT: UUIDEditState = {
    isOpen: false,
    uuid: null,
    uuidType: null,
    count: 0,
    fields: {},
    enabledFields: EMPTY_ENABLED_FIELDS,
};

const CLOSED_DELETE: UUIDDeleteState = { isOpen: false, uuid: null, uuidType: null, count: 0 };

interface Options {
    configGroups: UseUUIDGroupedRunsReturn;
    runGroups: UseUUIDGroupedRunsReturn;
    groups: GroupExpansion;
}

export const useUUIDEdits = ({ configGroups, runGroups, groups }: Options) => {
    const toast = useToast();
    const [editState, setEditState] = useState<UUIDEditState>(CLOSED_EDIT);
    const [deleteState, setDeleteState] = useState<UUIDDeleteState>(CLOSED_DELETE);

    const refreshGroups = useCallback(
        (uuidType: UUIDType) => (uuidType === 'config_uuid' ? configGroups.refresh() : runGroups.refresh()),
        [configGroups, runGroups],
    );

    const openEdit = useCallback(
        async (uuid: string, uuidType: UUIDType, count: number, testRunIds?: number[]) => {
            setEditState({ ...CLOSED_EDIT, isOpen: true, uuid, uuidType, count });
            if (!testRunIds || testRunIds.length === 0) return;

            // Pre-fill with the most common value of each field
            const cached = groups.runsByUuid.get(uuid);
            try {
                const runs = cached ?? (await fetchRunsByIds(testRunIds));
                if (!cached) groups.cacheRuns(uuid, runs);
                setEditState((prev) => ({ ...prev, fields: commonEditableFields(runs) }));
            } catch {
                toast.info('Could not pre-fill current values; fields start empty');
            }
        },
        [groups, toast],
    );

    const closeEdit = useCallback(() => setEditState((prev) => ({ ...prev, isOpen: false })), []);

    const submitEdit = useCallback(async () => {
        const { uuid, uuidType, fields, enabledFields, count } = editState;
        if (!uuid || !uuidType) return;

        const updates = collectEnabledUpdates(fields, enabledFields);
        if (Object.keys(updates).length === 0) {
            toast.error('Please enable and fill at least one field to update');
            return;
        }
        try {
            const result = await bulkUpdateTestRunsByUUID(uuid, uuidType, updates);
            if (result.error) {
                throw new Error(result.error);
            }
            closeEdit();
            toast.success(`Updated ${count} test run${plural(count)}`);
            // Clear cached expanded runs so they reload with new data
            groups.clearCache();
            refreshGroups(uuidType);
        } catch {
            toast.error('Failed to update test runs');
        }
    }, [editState, groups, refreshGroups, closeEdit, toast]);

    const openDelete = useCallback((uuid: string, uuidType: UUIDType, count: number) => {
        setDeleteState({ isOpen: true, uuid, uuidType, count });
    }, []);

    const closeDelete = useCallback(() => setDeleteState((prev) => ({ ...prev, isOpen: false })), []);

    const submitDelete = useCallback(async () => {
        const { uuid, uuidType } = deleteState;
        if (!uuid || !uuidType) return;

        const data = uuidType === 'config_uuid' ? configGroups.data : runGroups.data;
        const group = Array.isArray(data) ? data.find((g) => g.uuid === uuid) : undefined;
        if (!group) {
            toast.error(`Group not found for UUID ${uuid}`);
            return;
        }
        try {
            const result = await deleteTestRuns(group.test_run_ids);
            if (result.failed > 0) {
                throw new Error(`Failed to delete ${result.failed} of ${result.total} test runs`);
            }
            closeDelete();
            toast.success(`Deleted ${group.test_run_ids.length} test run${plural(group.test_run_ids.length)}`);
            groups.clearCache();
            refreshGroups(uuidType);
        } catch {
            toast.error('Failed to delete test runs');
        }
    }, [deleteState, configGroups.data, runGroups.data, groups, refreshGroups, closeDelete, toast]);

    return { editState, setEditState, openEdit, closeEdit, submitEdit, deleteState, openDelete, closeDelete, submitDelete };
};

export type UUIDEdits = ReturnType<typeof useUUIDEdits>;
