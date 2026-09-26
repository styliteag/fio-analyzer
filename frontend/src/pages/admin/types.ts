// Shared types for the Admin page
import type { SaturationRun } from '../../services/api/testRuns';
import type { TestRun } from '../../types';

export const TAB_IDS = ['latest', 'by-config', 'by-run', 'history', 'hierarchy', 'saturation'] as const;
export type AdminTab = (typeof TAB_IDS)[number];
export const DEFAULT_TAB: AdminTab = 'latest';

export type UUIDType = 'config_uuid' | 'run_uuid';

export interface EditableFields {
    hostname?: string;
    protocol?: string;
    description?: string;
    test_name?: string;
    drive_type?: string;
    drive_model?: string;
}

export type EnabledFields<T> = Record<keyof T, boolean>;

export const EDITABLE_FIELD_ORDER: readonly (keyof EditableFields)[] = [
    'hostname',
    'protocol',
    'drive_type',
    'drive_model',
    'test_name',
    'description',
];

export const EMPTY_ENABLED_FIELDS: EnabledFields<EditableFields> = {
    hostname: false,
    protocol: false,
    description: false,
    test_name: false,
    drive_type: false,
    drive_model: false,
};

export interface UUIDEditState {
    isOpen: boolean;
    uuid: string | null;
    uuidType: UUIDType | null;
    count: number;
    fields: EditableFields;
    enabledFields: EnabledFields<EditableFields>;
}

export interface UUIDDeleteState {
    isOpen: boolean;
    uuid: string | null;
    uuidType: UUIDType | null;
    count: number;
}

export type CleanupMode = 'delete-old' | 'compact';
export type CompactFrequency = 'daily' | 'weekly' | 'monthly';

export interface DataCleanupState {
    isOpen: boolean;
    mode: CleanupMode | null;
    cutoffDate: string;
    compactFrequency: CompactFrequency;
    previewCount: number | null;
    isLoading: boolean;
    hostname: string | null;
}

export interface TestRunDetailsState {
    isOpen: boolean;
    testRun: TestRun | null;
    isLoading: boolean;
}

export interface HierarchyEditState {
    isOpen: boolean;
    testRunIds: number[];
    count: number;
    level: string; // e.g., "Host: server01", "Host-Protocol: server01-NFS", etc.
    fields: EditableFields;
    enabledFields: EnabledFields<EditableFields>;
}

export interface SaturationEditFields {
    description?: string;
    hostname?: string;
    protocol?: string;
    drive_type?: string;
    drive_model?: string;
}

export const SATURATION_FIELD_ORDER: readonly (keyof SaturationEditFields)[] = [
    'description',
    'hostname',
    'protocol',
    'drive_type',
    'drive_model',
];

export interface SaturationEditState {
    isOpen: boolean;
    run: SaturationRun | null;
    fields: SaturationEditFields;
    enabledFields: EnabledFields<SaturationEditFields>;
}

export interface SaturationDeleteState {
    isOpen: boolean;
    run: SaturationRun | null;
}

/** Row shape returned by /api/time-series/history (loosely typed backend payload). */
export interface HistoryRow {
    id?: number;
    test_run_id?: number;
    timestamp?: string;
    test_date?: string;
    hostname?: string;
    protocol?: string;
    drive_type?: string;
    drive_model?: string;
    test_name?: string;
    description?: string;
    read_write_pattern?: string;
    block_size?: string | number;
    iops?: number | null;
    config_uuid?: string;
    run_uuid?: string;
}

export interface LatestRunGroup {
    uuid: string;
    runs: TestRun[];
    count: number;
    avgIops: number;
    latestTimestamp: number;
    hostname: string;
}

/** Host → Host-Protocol → Host-Protocol-Type → Host-Protocol-Type-Model → runs */
export type HierarchyData = Record<string, Record<string, Record<string, Record<string, TestRun[]>>>>;
