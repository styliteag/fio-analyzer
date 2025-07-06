import React from 'react';
import Select from 'react-select';
import { HardDrive, Clock, Layers, Database, Zap, X } from 'lucide-react';
import { getSelectStyles } from '../../hooks/useThemeColors';
import { sortBlockSizes } from '../../utils/sorting';
import type { FilterOptions } from '../../types';
import type { ActiveFilters, DynamicFilterOptions } from '../../hooks/useTestRunFilters';

interface TestRunFiltersProps {
    filters: FilterOptions;
    activeFilters: ActiveFilters;
    onFilterChange: (filterType: keyof ActiveFilters, values: (string | number)[]) => void;
    dynamicFilterOptions?: DynamicFilterOptions;
    useDynamicFilters?: boolean;
    onClearAllFilters?: () => void;
}

const TestRunFilters: React.FC<TestRunFiltersProps> = ({
    filters,
    activeFilters,
    onFilterChange,
    dynamicFilterOptions,
    useDynamicFilters = false,
    onClearAllFilters,
}) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-3 mb-4">
            <div>
                <label className="block text-xs font-medium theme-text-secondary mb-1">
                    Hostnames
                </label>
                <Select
                    isMulti
                    options={
                        useDynamicFilters && dynamicFilterOptions
                            ? dynamicFilterOptions.hostnames.map((option) => ({
                                value: String(option.value),
                                label: `${option.label} (${option.count})`,
                            }))
                            : filters.hostnames.map((hostname) => ({
                                value: String(hostname),
                                label: String(hostname),
                            }))
                    }
                    value={activeFilters.hostnames.map((hostname) => ({
                        value: String(hostname),
                        label: useDynamicFilters && dynamicFilterOptions
                            ? `${hostname} (${dynamicFilterOptions.hostnames.find(opt => opt.value === hostname)?.count || 0})`
                            : String(hostname),
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
                    options={
                        useDynamicFilters && dynamicFilterOptions
                            ? dynamicFilterOptions.protocols.map((option) => ({
                                value: String(option.value),
                                label: `${option.label} (${option.count})`,
                            }))
                            : filters.protocols.map((protocol) => ({
                                value: String(protocol),
                                label: String(protocol),
                            }))
                    }
                    value={activeFilters.protocols.map((protocol) => ({
                        value: String(protocol),
                        label: useDynamicFilters && dynamicFilterOptions
                            ? `${protocol} (${dynamicFilterOptions.protocols.find(opt => opt.value === protocol)?.count || 0})`
                            : String(protocol),
                    }))}
                    onChange={(selected) =>
                        onFilterChange('protocols', selected ? selected.map((s) => s.value) : [])
                    }
                    placeholder="All protocols"
                    className="text-xs"
                    styles={getSelectStyles()}
                />
            </div>

            <div>
                <label className="block text-xs font-medium theme-text-secondary mb-1">
                    <HardDrive size={14} className="inline mr-1 theme-text-tertiary" />
                    Drive Types
                </label>
                <Select
                    isMulti
                    options={
                        useDynamicFilters && dynamicFilterOptions
                            ? dynamicFilterOptions.drive_types.map((option) => ({
                                value: String(option.value),
                                label: `${option.label} (${option.count})`,
                            }))
                            : filters.drive_types.map((type) => ({
                                value: String(type),
                                label: String(type),
                            }))
                    }
                    value={activeFilters.drive_types.map((type) => ({
                        value: String(type),
                        label: useDynamicFilters && dynamicFilterOptions
                            ? `${type} (${dynamicFilterOptions.drive_types.find(opt => opt.value === type)?.count || 0})`
                            : String(type),
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
                    options={
                        useDynamicFilters && dynamicFilterOptions
                            ? dynamicFilterOptions.drive_models.map((option) => ({
                                value: String(option.value),
                                label: `${option.label} (${option.count})`,
                            }))
                            : filters.drive_models.map((model) => ({
                                value: String(model),
                                label: String(model),
                            }))
                    }
                    value={activeFilters.drive_models.map((model) => ({
                        value: String(model),
                        label: useDynamicFilters && dynamicFilterOptions
                            ? `${model} (${dynamicFilterOptions.drive_models.find(opt => opt.value === model)?.count || 0})`
                            : String(model),
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
                    options={
                        useDynamicFilters && dynamicFilterOptions
                            ? dynamicFilterOptions.patterns.map((option) => ({
                                value: String(option.value),
                                label: `${option.label.replace(/_/g, " ").toUpperCase()} (${option.count})`,
                            }))
                            : filters.patterns.map((pattern) => ({
                                value: String(pattern),
                                label: pattern.replace(/_/g, " ").toUpperCase(),
                            }))
                    }
                    value={activeFilters.patterns.map((pattern) => ({
                        value: String(pattern),
                        label: useDynamicFilters && dynamicFilterOptions
                            ? `${pattern.replace(/_/g, " ").toUpperCase()} (${dynamicFilterOptions.patterns.find(opt => opt.value === pattern)?.count || 0})`
                            : pattern.replace(/_/g, " ").toUpperCase(),
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
                    options={
                        useDynamicFilters && dynamicFilterOptions
                            ? dynamicFilterOptions.block_sizes.map((option) => ({
                                value: String(option.value),
                                label: `${option.label} (${option.count})`,
                            }))
                            : sortBlockSizes(filters.block_sizes).map((size) => ({
                                value: String(size),
                                label: String(size),
                            }))
                    }
                    value={activeFilters.block_sizes.map((size) => ({
                        value: String(size),
                        label: useDynamicFilters && dynamicFilterOptions
                            ? `${size} (${dynamicFilterOptions.block_sizes.find(opt => opt.value === size)?.count || 0})`
                            : String(size),
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
                    <Zap size={14} className="inline mr-1 theme-text-tertiary" />
                    Sync
                </label>
                <Select
                    isMulti
                    options={
                        useDynamicFilters && dynamicFilterOptions
                            ? dynamicFilterOptions.syncs.map((option) => ({
                                value: String(option.value),
                                label: `${option.label} (${option.count})`,
                            }))
                            : filters.syncs.map((sync) => ({
                                value: String(sync),
                                label: sync.toString(),
                            }))
                    }
                    value={activeFilters.syncs.map((sync) => ({
                        value: String(sync),
                        label: useDynamicFilters && dynamicFilterOptions
                            ? `${sync} (${dynamicFilterOptions.syncs.find(opt => opt.value === sync)?.count || 0})`
                            : sync.toString(),
                    }))}
                    onChange={(selected) =>
                        onFilterChange('syncs', selected ? selected.map((s) => parseInt(s.value)) : [])
                    }
                    placeholder="All sync values"
                    className="text-xs"
                    styles={getSelectStyles()}
                />
            </div>

            <div>
                <label className="block text-xs font-medium theme-text-secondary mb-1">
                    Queue Depth
                </label>
                <Select
                    isMulti
                    options={
                        useDynamicFilters && dynamicFilterOptions
                            ? dynamicFilterOptions.queue_depths.map((option) => ({
                                value: String(option.value),
                                label: `${option.label} (${option.count})`,
                            }))
                            : filters.queue_depths.map((qd) => ({
                                value: String(qd),
                                label: qd.toString(),
                            }))
                    }
                    value={activeFilters.queue_depths.map((qd) => ({
                        value: String(qd),
                        label: useDynamicFilters && dynamicFilterOptions
                            ? `${qd} (${dynamicFilterOptions.queue_depths.find(opt => opt.value === qd)?.count || 0})`
                            : qd.toString(),
                    }))}
                    onChange={(selected) =>
                        onFilterChange('queue_depths', selected ? selected.map((s) => parseInt(s.value)) : [])
                    }
                    placeholder="All queue depths"
                    className="text-xs"
                    styles={getSelectStyles()}
                />
            </div>

            <div>
                <label className="block text-xs font-medium theme-text-secondary mb-1">
                    <Database size={14} className="inline mr-1 theme-text-tertiary" />
                    Direct
                </label>
                <Select
                    isMulti
                    options={
                        useDynamicFilters && dynamicFilterOptions
                            ? dynamicFilterOptions.directs.map((option) => ({
                                value: String(option.value),
                                label: `${option.label} (${option.count})`,
                            }))
                            : filters.directs.map((direct) => ({
                                value: String(direct),
                                label: direct.toString(),
                            }))
                    }
                    value={activeFilters.directs.map((direct) => ({
                        value: String(direct),
                        label: useDynamicFilters && dynamicFilterOptions
                            ? `${direct} (${dynamicFilterOptions.directs.find(opt => opt.value === direct)?.count || 0})`
                            : direct.toString(),
                    }))}
                    onChange={(selected) =>
                        onFilterChange('directs', selected ? selected.map((s) => parseInt(s.value)) : [])
                    }
                    placeholder="All direct values"
                    className="text-xs"
                    styles={getSelectStyles()}
                />
            </div>

            <div>
                <label className="block text-xs font-medium theme-text-secondary mb-1">
                    <Layers size={14} className="inline mr-1 theme-text-tertiary" />
                    Num Jobs
                </label>
                <Select
                    isMulti
                    options={
                        useDynamicFilters && dynamicFilterOptions
                            ? dynamicFilterOptions.num_jobs.map((option) => ({
                                value: String(option.value),
                                label: `${option.label} (${option.count})`,
                            }))
                            : filters.num_jobs.map((jobs) => ({
                                value: String(jobs),
                                label: jobs.toString(),
                            }))
                    }
                    value={activeFilters.num_jobs.map((jobs) => ({
                        value: String(jobs),
                        label: useDynamicFilters && dynamicFilterOptions
                            ? `${jobs} (${dynamicFilterOptions.num_jobs.find(opt => opt.value === jobs)?.count || 0})`
                            : jobs.toString(),
                    }))}
                    onChange={(selected) =>
                        onFilterChange('num_jobs', selected ? selected.map((s) => parseInt(s.value)) : [])
                    }
                    placeholder="All job counts"
                    className="text-xs"
                    styles={getSelectStyles()}
                />
            </div>

            <div>
                <label className="block text-xs font-medium theme-text-secondary mb-1">
                    <Database size={14} className="inline mr-1 theme-text-tertiary" />
                    Test Size
                </label>
                <Select
                    isMulti
                    options={
                        useDynamicFilters && dynamicFilterOptions
                            ? dynamicFilterOptions.test_sizes.map((option) => ({
                                value: String(option.value),
                                label: `${option.label} (${option.count})`,
                            }))
                            : filters.test_sizes.map((size) => ({
                                value: String(size),
                                label: String(size),
                            }))
                    }
                    value={activeFilters.test_sizes.map((size) => ({
                        value: String(size),
                        label: useDynamicFilters && dynamicFilterOptions
                            ? `${size} (${dynamicFilterOptions.test_sizes.find(opt => opt.value === size)?.count || 0})`
                            : String(size),
                    }))}
                    onChange={(selected) =>
                        onFilterChange('test_sizes', selected ? selected.map((s) => s.value) : [])
                    }
                    placeholder="All test sizes"
                    className="text-xs"
                    styles={getSelectStyles()}
                />
            </div>

            <div>
                <label className="block text-xs font-medium theme-text-secondary mb-1">
                    <Clock size={14} className="inline mr-1 theme-text-tertiary" />
                    Duration
                </label>
                <Select
                    isMulti
                    options={
                        useDynamicFilters && dynamicFilterOptions
                            ? dynamicFilterOptions.durations.map((option) => ({
                                value: String(option.value),
                                label: `${option.label} (${option.count})`,
                            }))
                            : filters.durations.map((duration) => ({
                                value: String(duration),
                                label: `${duration}s`,
                            }))
                    }
                    value={activeFilters.durations.map((duration) => ({
                        value: String(duration),
                        label: useDynamicFilters && dynamicFilterOptions
                            ? `${duration}s (${dynamicFilterOptions.durations.find(opt => opt.value === duration)?.count || 0})`
                            : `${duration}s`,
                    }))}
                    onChange={(selected) =>
                        onFilterChange('durations', selected ? selected.map((s) => parseInt(s.value)) : [])
                    }
                    placeholder="All durations"
                    className="text-xs"
                    styles={getSelectStyles()}
                />
            </div>
        </div>
    );
};

export default TestRunFilters;