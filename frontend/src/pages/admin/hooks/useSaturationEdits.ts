// Edit / delete of a whole saturation run (all its steps)
import { useCallback, useState } from 'react';
import { deleteSaturationRunByUUID, updateSaturationRunByUUID } from '../../../services/api/testRuns';
import type { SaturationRun } from '../../../services/api/testRuns';
import { useToast } from '../../../contexts/ToastContext';
import type { SaturationDeleteState, SaturationEditState } from '../types';
import { collectEnabledUpdates } from '../utils';

const CLOSED_EDIT: SaturationEditState = {
    isOpen: false,
    run: null,
    fields: {},
    enabledFields: { description: false, hostname: false, protocol: false, drive_type: false, drive_model: false },
};

const CLOSED_DELETE: SaturationDeleteState = { isOpen: false, run: null };

export const useSaturationEdits = (onChanged: () => void) => {
    const toast = useToast();
    const [editState, setEditState] = useState<SaturationEditState>(CLOSED_EDIT);
    const [deleteState, setDeleteState] = useState<SaturationDeleteState>(CLOSED_DELETE);

    const openEdit = useCallback((run: SaturationRun) => {
        setEditState({
            ...CLOSED_EDIT,
            isOpen: true,
            run,
            fields: {
                description: run.description || '',
                hostname: run.hostname || '',
                protocol: run.protocol || '',
                drive_type: run.drive_type || '',
                drive_model: run.drive_model || '',
            },
        });
    }, []);

    const closeEdit = useCallback(() => setEditState((prev) => ({ ...prev, isOpen: false })), []);

    const submitEdit = useCallback(async () => {
        const { run, fields, enabledFields } = editState;
        if (!run) return;

        const updates = collectEnabledUpdates(fields, enabledFields);
        if (Object.keys(updates).length === 0) {
            toast.error('Please enable and fill at least one field to update');
            return;
        }
        try {
            const result = await updateSaturationRunByUUID(run.run_uuid, updates);
            if (result.error) {
                throw new Error(result.error);
            }
            closeEdit();
            toast.success('Saturation run updated');
            onChanged();
        } catch {
            toast.error('Failed to update saturation run');
        }
    }, [editState, closeEdit, onChanged, toast]);

    const openDelete = useCallback((run: SaturationRun) => setDeleteState({ isOpen: true, run }), []);
    const closeDelete = useCallback(() => setDeleteState(CLOSED_DELETE), []);

    const submitDelete = useCallback(async () => {
        if (!deleteState.run) return;
        try {
            const result = await deleteSaturationRunByUUID(deleteState.run.run_uuid);
            if (result.error) {
                throw new Error(result.error);
            }
            closeDelete();
            toast.success('Saturation run deleted');
            onChanged();
        } catch {
            toast.error('Failed to delete saturation run');
        }
    }, [deleteState, closeDelete, onChanged, toast]);

    return { editState, setEditState, openEdit, closeEdit, submitEdit, deleteState, openDelete, closeDelete, submitDelete };
};

export type SaturationEdits = ReturnType<typeof useSaturationEdits>;
