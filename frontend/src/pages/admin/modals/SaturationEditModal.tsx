import Modal from '../../../components/ui/Modal';
import { EditFieldsForm, EditNotice } from '../components/EditFieldsForm';
import type { SaturationEdits } from '../hooks/useSaturationEdits';
import { SATURATION_FIELD_ORDER } from '../types';
import { plural } from '../utils';

export const SaturationEditModal: React.FC<{ readonly edits: SaturationEdits }> = ({ edits }) => {
    const { editState: state, setEditState, closeEdit, submitEdit } = edits;
    const steps = state.run?.step_count ?? 0;

    return (
        <Modal isOpen={state.isOpen} onClose={closeEdit} title="Edit Saturation Run">
            <EditFieldsForm
                notice={
                    <EditNotice detail={`UUID: ${state.run?.run_uuid}`}>
                        This will update all {state.run?.step_count} step{plural(steps)} in this saturation run.
                    </EditNotice>
                }
                fieldOrder={SATURATION_FIELD_ORDER}
                values={state.fields}
                enabled={state.enabledFields}
                onToggle={(field, enabled) =>
                    setEditState((prev) => ({ ...prev, enabledFields: { ...prev.enabledFields, [field]: enabled } }))
                }
                onChange={(field, value) => setEditState((prev) => ({ ...prev, fields: { ...prev.fields, [field]: value } }))}
                submitLabel={`Update ${state.run?.step_count} Steps`}
                onSubmit={submitEdit}
                onCancel={closeEdit}
            />
        </Modal>
    );
};
