// Client Ramps API: multi-client ramps (fio client mode with a growing client count), one per ramp_uuid
import type { StorageInfo } from '../../types';
import { getErrorMessage } from '../../types/api';
import { authenticatedFetch, type ApiResponse } from './base';

/** Test configuration shared by every step of a ramp */
export interface RampConfig {
    readonly hostname: string;
    readonly protocol: string | null;
    readonly drive_type: string | null;
    readonly drive_model: string | null;
    readonly block_size: string | null;
    readonly read_write_pattern: string | null;
    readonly iodepth: number | null;
    readonly num_jobs: number | null;
    readonly direct: number | null;
    readonly sync: string | null;
    readonly test_size: string | null;
    readonly duration: number | null;
}

/** One entry of GET /api/ramp/runs */
export interface RampListItem extends RampConfig {
    readonly ramp_uuid: string;
    readonly run_uuid: string | null;
    readonly steps: number;
    readonly min_clients: number | null;
    readonly max_clients: number | null;
    readonly client_counts: readonly number[];
    readonly first_timestamp: string | null;
    readonly last_timestamp: string | null;
}

/** Result of one client within a ramp step */
export interface RampClientResult {
    readonly client_index: number;
    readonly client_host: string | null;
    readonly client_port: number | null;
    readonly client_name: string | null;
    readonly iops: number | null;
    readonly read_iops: number | null;
    readonly write_iops: number | null;
    readonly bandwidth: number | null;
    readonly avg_latency: number | null;
    readonly p95_latency: number | null;
    readonly p99_latency: number | null;
    readonly error: number | string | null;
    readonly storage_info: StorageInfo | null;
}

/** One uploaded step (aggregate over all clients) of GET /api/ramp/runs/{ramp_uuid} */
export interface RampStep {
    readonly id: number;
    readonly run_uuid: string | null;
    readonly timestamp: string | null;
    readonly clients: number | null;
    readonly client_hosts: readonly string[] | null;
    readonly description: string | null;
    readonly iops: number | null;
    readonly bandwidth: number | null;
    readonly avg_latency: number | null;
    readonly p95_latency: number | null;
    readonly p99_latency: number | null;
    /** Slowest / fastest client IOPS; null below two clients */
    readonly fairness: number | null;
    readonly clients_detail: readonly RampClientResult[];
}

export interface RampDetail extends RampConfig {
    readonly ramp_uuid: string;
    readonly run_uuid: string | null;
    readonly steps: readonly RampStep[];
}

/** Summary step: the newest upload per client count */
export interface RampSummaryStep {
    readonly id: number;
    readonly clients: number;
    readonly timestamp: string | null;
    readonly iops: number | null;
    readonly per_client_iops: number;
    readonly bandwidth: number | null;
    readonly avg_latency: number | null;
    readonly p95_latency: number | null;
    readonly p99_latency: number | null;
    /** Slowest / fastest client IOPS (1 = perfectly fair); null with fewer than two clients */
    readonly fairness: number | null;
    readonly complete: boolean;
}

export interface RampSummary extends RampConfig {
    readonly ramp_uuid: string;
    readonly threshold_ms: number;
    readonly status: 'saturated' | 'not_reached';
    readonly best_within: RampSummaryStep | null;
    readonly crossed_at: RampSummaryStep | null;
    readonly max_iops: RampSummaryStep | null;
    readonly per_client_iops_drop_pct: number | null;
    readonly incomplete_steps: number;
    readonly steps: readonly RampSummaryStep[];
}

export const DEFAULT_RAMP_THRESHOLD_MS = 100;

/** GET returning JSON; on failure the backend's {"detail"} message instead of the bare status text */
const getJson = async <T>(endpoint: string, signal?: AbortSignal): Promise<ApiResponse<T>> => {
    try {
        const response = await authenticatedFetch(endpoint, { signal });
        const body = await response.json().catch(() => null);
        if (!response.ok) {
            const message = body && (typeof body.detail === 'string' ? body.detail : typeof body.error === 'string' ? body.error : null);
            return { status: response.status, error: message ?? `API Error: ${response.status} ${response.statusText}` };
        }
        return { status: response.status, data: body as T };
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return { status: 0, error: 'Request cancelled' };
        return { status: 500, error: getErrorMessage(error) };
    }
};

export const fetchRamps = (signal?: AbortSignal) => getJson<RampListItem[]>('/api/ramp/runs?limit=1000', signal);

export const fetchRamp = (rampUuid: string, signal?: AbortSignal) =>
    getJson<RampDetail>(`/api/ramp/runs/${encodeURIComponent(rampUuid)}`, signal);

export const fetchRampSummary = (rampUuid: string, thresholdMs: number, signal?: AbortSignal) =>
    getJson<RampSummary>(`/api/ramp/runs/${encodeURIComponent(rampUuid)}/summary?threshold_ms=${thresholdMs}`, signal);

const INCOMPLETE_TAG = 'incomplete:1';

/** Same rule as the backend summary: tagged incomplete, a client reported an error, or client rows are missing */
export const isRampStepComplete = (step: RampStep): boolean => {
    const tags = (step.description ?? '').split(',').map((tag) => tag.trim());
    if (tags.includes(INCOMPLETE_TAG)) return false;
    if (step.clients_detail.some((client) => Boolean(client.error))) return false;
    return step.clients_detail.length === 0 || step.clients_detail.length === (step.clients || 1);
};

/** Display name of a client: its hostname.txt name (as in client_hosts), else its fio address */
export const rampClientLabel = (client: RampClientResult): string => {
    if (client.client_name) return client.client_name;
    if (client.client_host) return client.client_port ? `${client.client_host}:${client.client_port}` : client.client_host;
    return `client ${client.client_index + 1}`;
};

/** Level-4 hierarchy key: hostname-protocol-drive_type-drive_model */
export const rampHierarchy = (config: RampConfig): string[] =>
    [config.hostname, config.protocol, config.drive_type, config.drive_model].filter((part): part is string => Boolean(part));

/** e.g. "randread 4k · QD 32 × 4 jobs" */
export const rampConfigLabel = (config: RampConfig): string => {
    const parts = [config.read_write_pattern, config.block_size].filter(Boolean).join(' ');
    const qd = config.iodepth != null ? `QD ${config.iodepth}` : null;
    const jobs = config.num_jobs != null ? `${config.num_jobs} job${config.num_jobs === 1 ? '' : 's'}` : null;
    return [parts || null, [qd, jobs].filter(Boolean).join(' × ') || null].filter(Boolean).join(' · ');
};
