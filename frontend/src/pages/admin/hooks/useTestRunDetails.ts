// Load a single test run for the details modal
import { useCallback, useState } from 'react';
import { fetchTestRun } from '../../../services/api/testRuns';
import { useToast } from '../../../contexts/ToastContext';
import type { TestRunDetailsState } from '../types';

const CLOSED: TestRunDetailsState = { isOpen: false, testRun: null, isLoading: false };

export const useTestRunDetails = () => {
    const toast = useToast();
    const [state, setState] = useState<TestRunDetailsState>(CLOSED);

    const open = useCallback(
        async (testRunId: number) => {
            setState({ isOpen: true, testRun: null, isLoading: true });
            try {
                const result = await fetchTestRun(testRunId);
                if (result.error) {
                    throw new Error(result.error);
                }
                setState({ isOpen: true, testRun: result.data || null, isLoading: false });
            } catch {
                toast.error('Failed to load test run details');
                setState(CLOSED);
            }
        },
        [toast],
    );

    const close = useCallback(() => setState(CLOSED), []);

    return { state, open, close };
};
