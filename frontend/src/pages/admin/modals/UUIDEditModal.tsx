import Modal from '../../../components/ui/Modal';
import { EditFieldsForm, EditNotice } from '../components/EditFieldsForm';
import type { UUIDEdits } from '../hooks/useUUIDEdits';
import { EDITABLE_FIELD_ORDER } from '../types';
import { plural } from '../utils';

export const UUIDEditModal: React.FC<{ readonly edits: UUIDEdits }> = ({ edits }) => {
    const { editState: state, setEditState, closeEdit, submitEdit } = edits;
    const scope = state.uuidType === 'config_uuid' ? 'Host Configuration' : 'Script Run';

    return (
        <Modal isOpen={state.isOpen} onClose={closeEdit} title={`Edit All Tests in ${scope}`}>
            <EditFieldsForm
                notice={
                    <EditNotice detail={`UUID: ${state.uuid}`}>
                        This will update {state.count} test run{plural(state.count)} with the same values.
                    </EditNotice>
                }
                fieldOrder={EDITABLE_FIELD_ORDER}
                values={state.fields}
                enabled={state.enabledFields}
                onToggle={(field, enabled) =>
                    setEditState((prev) => ({ ...prev, enabledFields: { ...prev.enabledFields, [field]: enabled } }))
                }
                onChange={(field, value) => setEditState((prev) => ({ ...prev, fields: { ...prev.fields, [field]: value } }))}
                submitLabel={`Update ${state.count} Test Runs`}
                onSubmit={submitEdit}
                onCancel={closeEdit}
            />
        </Modal>
    );
};
