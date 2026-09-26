// Page state stored in the URL query string, so reloads and shared links keep it.
// Lists use repeated keys (?bs=4k&bs=64k) to stay safe for values containing commas.
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

const SEPARATOR = '\u0000';

type ParamsMutator = (params: URLSearchParams) => void;

/** Apply several param changes in one navigation (separate setSearchParams calls in one tick overwrite each other). */
export const useUpdateUrlParams = () => {
    const [, setSearchParams] = useSearchParams();
    return useCallback(
        (mutate: ParamsMutator) => {
            // react-router hands the updater the params of the last *render*; navigations run as transitions,
            // so rapid updates (typing, click then type) would drop each other. The live URL is always current.
            const next = new URLSearchParams(window.location.search);
            mutate(next);
            setSearchParams(next, { replace: true });
        },
        [setSearchParams],
    );
};

export const writeList = (params: URLSearchParams, key: string, values: readonly (string | number)[]): void => {
    params.delete(key);
    values.forEach((value) => params.append(key, String(value)));
};

export const writeValue = (params: URLSearchParams, key: string, value: string | number | null, fallback?: string | number): void => {
    if (value === null || value === '' || value === fallback) {
        params.delete(key);
    } else {
        params.set(key, String(value));
    }
};

export const useUrlList = (key: string): [string[], (values: readonly string[]) => void] => {
    const [searchParams] = useSearchParams();
    const update = useUpdateUrlParams();
    const joined = searchParams.getAll(key).join(SEPARATOR);
    const values = useMemo(() => (joined ? joined.split(SEPARATOR) : []), [joined]);
    const setValues = useCallback((next: readonly string[]) => update((params) => writeList(params, key, next)), [update, key]);
    return [values, setValues];
};

export const useUrlNumberList = (key: string): [number[], (values: readonly number[]) => void] => {
    const [raw, setRaw] = useUrlList(key);
    const values = useMemo(() => raw.map(Number).filter((value) => !Number.isNaN(value)), [raw]);
    const setValues = useCallback((next: readonly number[]) => setRaw(next.map(String)), [setRaw]);
    return [values, setValues];
};

export const useUrlValue = <T extends string>(
    key: string,
    fallback: T,
    allowed?: readonly T[],
): [T, (value: T) => void] => {
    const [searchParams] = useSearchParams();
    const update = useUpdateUrlParams();
    const raw = searchParams.get(key);
    const value = raw !== null && (!allowed || (allowed as readonly string[]).includes(raw)) ? (raw as T) : fallback;
    const setValue = useCallback((next: T) => update((params) => writeValue(params, key, next, fallback)), [update, key, fallback]);
    return [value, setValue];
};

export const useUrlNumber = (
    key: string,
    fallback: number,
    allowed?: readonly number[],
): [number, (value: number) => void] => {
    const [searchParams] = useSearchParams();
    const update = useUpdateUrlParams();
    const parsed = Number(searchParams.get(key));
    const valid = searchParams.has(key) && Number.isFinite(parsed) && (!allowed || allowed.includes(parsed));
    const value = valid ? parsed : fallback;
    const setValue = useCallback((next: number) => update((params) => writeValue(params, key, next, fallback)), [update, key, fallback]);
    return [value, setValue];
};
