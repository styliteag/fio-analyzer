import React from 'react';
import Select from 'react-select';
import { HardDrive } from 'lucide-react';
import { getSelectStyles } from '../../hooks/useThemeColors';
import { sortBlockSizes } from '../../utils/sorting';
import type { FilterOptions } from '../../types';
import type { ActiveFilters } from '../../hooks/useTestRunFilters';

interface TestRunFiltersProps {
    filters: FilterOptions;
    activeFilters: ActiveFilters;
    onFilterChange: (filterType: keyof ActiveFilters, values: (string | number)[]) => void;
}

const TestRunFilters: React.FC<TestRunFiltersProps> = ({
    filters,
    activeFilters,
    onFilterChange,
}) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
            <div>
                <label className="block text-xs font-medium theme-text-secondary mb-1">
                    <HardDrive size={14} className="inline mr-1 theme-text-tertiary" />
                    Drive Types
                </label>
                <Select
                    isMulti
                    options={filters.drive_types.map((type) => ({
                        value: type,
                        label: type,
                    }))}
                    value={activeFilters.drive_types.map((type) => ({
                        value: type,
                        label: type,
                    }))}
                    onChange={(selected) =>
                        onFilterChange('drive_types', selected ? selected.map((s) => s.value) : [])
                    }
                    placeholder="All drive types"
                    className="text-xs"
                    styles={getSelectStyles()}
                />
            </div>

            <div>
                <label className="block text-xs font-medium theme-text-secondary mb-1">
                    Drive Models
                </label>
                <Select
                    isMulti
                    options={filters.drive_models.map((model) => ({
                        value: model,
                        label: model,
                    }))}
                    value={activeFilters.drive_models.map((model) => ({
                        value: model,
                        label: model,
                    }))}
                    onChange={(selected) =>
                        onFilterChange('drive_models', selected ? selected.map((s) => s.value) : [])
                    }
                    placeholder="All models"
                    className="text-xs"
                    styles={getSelectStyles()}
                />
            </div>

            <div>
                <label className="block text-xs font-medium theme-text-secondary mb-1">
                    Test Patterns
                </label>
                <Select
                    isMulti
                    options={filters.patterns.map((pattern) => ({
                        value: pattern,
                        label: pattern.replace(/_/g, " ").toUpperCase(),
                    }))}
                    value={activeFilters.patterns.map((pattern) => ({
                        value: pattern,
                        label: pattern.replace(/_/g, " ").toUpperCase(),
                    }))}
                    onChange={(selected) =>
                        onFilterChange('patterns', selected ? selected.map((s) => s.value) : [])
                    }
                    placeholder="All patterns"
                    className="text-xs"
                    styles={getSelectStyles()}
                />
            </div>

            <div>
                <label className="block text-xs font-medium theme-text-secondary mb-1">
                    Block Sizes
                </label>
                <Select
                    isMulti
                    options={sortBlockSizes(filters.block_sizes).map((size) => ({
                        value: size,
                        label: size,
                    }))}
                    value={activeFilters.block_sizes.map((size) => ({
                        value: size,
                        label: size,
                    }))}
                    onChange={(selected) =>
                        onFilterChange('block_sizes', selected ? selected.map((s) => s.value) : [])
                    }
                    placeholder="All sizes"
                    className="text-xs"
                    styles={getSelectStyles()}
                />
            </div>

            <div>
                <label className="block text-xs font-medium theme-text-secondary mb-1">
                    Hostnames
                </label>
                <Select
                    isMulti
                    options={filters.hostnames.map((hostname) => ({
                        value: hostname,
                        label: hostname,
                    }))}
                    value={activeFilters.hostnames.map((hostname) => ({
                        value: hostname,
                        label: hostname,
                    }))}
                    onChange={(selected) =>
                        onFilterChange('hostnames', selected ? selected.map((s) => s.value) : [])
                    }
                    placeholder="All hosts"
                    className="text-xs"
                    styles={getSelectStyles()}
                />
            </div>

            <div>
                <label className="block text-xs font-medium theme-text-secondary mb-1">
                    Protocols
                </label>
                <Select
                    isMulti
                    options={filters.protocols.map((protocol) => ({
                        value: protocol,
                        label: protocol,
                    }))}
                    value={activeFilters.protocols.map((protocol) => ({
                        value: protocol,
                        label: protocol,
                    }))}
                    onChange={(selected) =>
                        onFilterChange('protocols', selected ? selected.map((s) => s.value) : [])
                    }
                    placeholder="All protocols"
                    className="text-xs"
                    styles={getSelectStyles()}
                />
            </div>
        </div>
    );
};

export default TestRunFilters;