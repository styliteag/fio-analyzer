// Download stored raw fio JSON files (needs the auth header, so no plain links)
import { authenticatedFetch } from './base';

export type RawSource = 'latest' | 'history' | 'saturation';

const filenameFrom = (response: Response, fallback: string): string => {
    const header = response.headers.get('content-disposition') ?? '';
    const match = /filename="?([^";]+)"?/.exec(header);
    return match?.[1] ?? fallback;
};

const saveBlob = (blob: Blob, filename: string): void => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
};

const download = async (endpoint: string, fallbackName: string): Promise<void> => {
    const response = await authenticatedFetch(endpoint);
    if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail ?? body?.error ?? `Download failed (${response.status})`);
    }
    saveBlob(await response.blob(), filenameFrom(response, fallbackName));
};

/** All raw JSON files of one script run (incl. saturation steps) as a ZIP */
export const downloadRunZip = (runUuid: string): Promise<void> =>
    download(`/api/raw/runs/${encodeURIComponent(runUuid)}`, `run_${runUuid}.zip`);

/** All raw fio client-mode JSON files of one multi-client ramp (every client-count step) as a ZIP */
export const downloadRampZip = (rampUuid: string): Promise<void> =>
    download(`/api/raw/ramps/${encodeURIComponent(rampUuid)}`, `ramp_${rampUuid}.zip`);

/** The raw JSON of a single test run */
export const downloadTestRunJson = (id: number, source: RawSource = 'latest'): Promise<void> =>
    download(`/api/raw/test-runs/${id}?source=${source}`, `test_run_${id}.json`);
