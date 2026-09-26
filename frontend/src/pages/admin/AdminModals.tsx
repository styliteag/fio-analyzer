// All Admin page modals in one place
import type { Cleanup } from './hooks/useCleanup';
import type { HierarchyEdit } from './hooks/useHierarchyEdit';
import type { SaturationEdits } from './hooks/useSaturationEdits';
import type { useTestRunDetails } from './hooks/useTestRunDetails';
import type { UUIDEdits } from './hooks/useUUIDEdits';
import { DataCleanupModal } from './modals/DataCleanupModal';
import { HierarchyEditModal } from './modals/HierarchyEditModal';
import { SaturationDeleteModal } from './modals/SaturationDeleteModal';
import { SaturationEditModal } from './modals/SaturationEditModal';
import { TestRunDetailsModal } from './modals/TestRunDetailsModal';
import { UUIDDeleteModal } from './modals/UUIDDeleteModal';
import { UUIDEditModal } from './modals/UUIDEditModal';

interface AdminModalsProps {
    readonly uuidEdits: UUIDEdits;
    readonly hierarchyEdit: HierarchyEdit;
    readonly saturationEdits: SaturationEdits;
    readonly cleanup: Cleanup;
    readonly details: ReturnType<typeof useTestRunDetails>;
}

export const AdminModals: React.FC<AdminModalsProps> = ({ uuidEdits, hierarchyEdit, saturationEdits, cleanup, details }) => (
    <>
        <UUIDEditModal edits={uuidEdits} />
        <HierarchyEditModal edit={hierarchyEdit} />
        <UUIDDeleteModal edits={uuidEdits} />
        <SaturationEditModal edits={saturationEdits} />
        <SaturationDeleteModal edits={saturationEdits} />
        <DataCleanupModal cleanup={cleanup} />
        <TestRunDetailsModal state={details.state} onClose={details.close} />
    </>
);
