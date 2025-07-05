import { useState, useCallback } from 'react';
import type { TimeSeriesFilters } from '../components/timeSeries/TimeSeriesFilters';

export const useTimeSeriesFilters = () => {
    const [activeFilters, setActiveFilters] = useState<TimeSeriesFilters>({
        hostnames: [],
        protocols: [],
        drive_models: [],
        drive_types: [],
        block_sizes: [],
        patterns: [],
        start_date: '',
        end_date: '',
    });

    const handleFilterChange = useCallback((
        filterType: keyof TimeSeriesFilters, 
        values: string[] | string
    ) => {
        setActiveFilters(prev => ({
            ...prev,
            [filterType]: values,
        }));
    }, []);

    const resetFilters = useCallback(() => {
        setActiveFilters({
            hostnames: [],
            protocols: [],
            drive_models: [],
            drive_types: [],
            block_sizes: [],
            patterns: [],
            start_date: '',
            end_date: '',
        });
    }, []);

    const hasActiveFilters = Object.values(activeFilters).some(filter => 
        Array.isArray(filter) ? filter.length > 0 : filter !== ''
    );

    return {
        activeFilters,
        handleFilterChange,
        resetFilters,
        hasActiveFilters,
    };
};