// URL helpers for backend-served resources

const apiBaseUrl = (): string => import.meta.env.VITE_API_URL || '';

export const getApiDocsUrl = (): string => `${apiBaseUrl()}/api-docs`;

export const TESTING_SCRIPT_URL = '/fio-test.sh';
