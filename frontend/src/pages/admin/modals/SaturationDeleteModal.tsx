import Modal from '../../../components/ui/Modal';
import type { SaturationEdits } from '../hooks/useSaturationEdits';
import { plural } from '../utils';
import { DeleteWarning } from './DeleteWarning';

export const SaturationDeleteModal: React.FC<{ readonly edits: SaturationEdits }> = ({ edits }) => {
    const { deleteState: state, closeDelete, submitDelete } = edits;
    const run = state.run;

    const details = (
        <>
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                <span className="font-semibold">{run?.hostname}</span>
                {' • '}
                {run?.protocol}
                {' • '}
                {run?.drive_type}
                {' • '}
                {run?.drive_model}
            </p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-1 font-mono">UUID: {run?.run_uuid}</p>
        </>
    );

    return (
        <Modal isOpen={state.isOpen} onClose={closeDelete} title="Confirm Saturation Run Deletion">
            <DeleteWarning
                details={details}
                confirmLabel={`Delete ${run?.step_count} Steps`}
                onConfirm={submitDelete}
                onCancel={closeDelete}
            >
                You are about to delete a saturation run with {run?.step_count} step{plural(run?.step_count ?? 0)}. This action
                cannot be undone.
            </DeleteWarning>
        </Modal>
    );
};
