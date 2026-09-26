import Modal from '../../../components/ui/Modal';
import { EditFieldsForm, EditNotice } from '../components/EditFieldsForm';
import type { HierarchyEdit } from '../hooks/useHierarchyEdit';
import { EDITABLE_FIELD_ORDER } from '../types';
import { plural } from '../utils';

export const HierarchyEditModal: React.FC<{ readonly edit: HierarchyEdit }> = ({ edit }) => {
    const { editState: state, setEditState, closeEdit, submitEdit } = edit;

    return (
        <Modal isOpen={state.isOpen} onClose={closeEdit} title={`Edit All Tests in ${state.level}`}>
            <EditFieldsForm
                notice={
                    <EditNotice detail={`Level: ${state.level}`}>
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
