import { useState, useEffect } from 'react';
import type { ApiInfoResponse } from '../../types/api';
import { fetchApiInfo } from '../../services/api/dashboard';

export const useApiInfo = () => {
    const [apiInfo, setApiInfo] = useState<ApiInfoResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadApiInfo = async () => {
            try {
                setLoading(true);
                setError(null);
                const info = await fetchApiInfo();
                setApiInfo(info);
            } catch (err) {
                console.error('Failed to load API info:', err);
                setError('Failed to load version information');
            } finally {
                setLoading(false);
            }
        };

        loadApiInfo();
    }, []);

    return { apiInfo, loading, error, version: apiInfo?.version };
};