import Modal from '../../../components/ui/Modal';
import type { UUIDEdits } from '../hooks/useUUIDEdits';
import { plural } from '../utils';
import { DeleteWarning } from './DeleteWarning';

export const UUIDDeleteModal: React.FC<{ readonly edits: UUIDEdits }> = ({ edits }) => {
    const { deleteState: state, closeDelete, submitDelete } = edits;

    return (
        <Modal isOpen={state.isOpen} onClose={closeDelete} title="Confirm Deletion">
            <DeleteWarning
                details={<p className="text-xs text-red-600 dark:text-red-400 mt-1 font-mono">UUID: {state.uuid}</p>}
                confirmLabel={`Delete ${state.count} Test Runs`}
                onConfirm={submitDelete}
                onCancel={closeDelete}
            >
                You are about to delete {state.count} test run{plural(state.count)}. This action cannot be undone.
            </DeleteWarning>
        </Modal>
    );
};
