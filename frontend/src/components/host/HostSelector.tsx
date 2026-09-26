import React from 'react';
import Select from 'react-select';
import { RefreshCw } from 'lucide-react';
import { Button } from '../ui';
import { getSelectStyles } from '../../hooks/useThemeColors';

export interface HostSelectorProps {
    availableHosts: string[];
    selectedHosts: string[];
    loadingHosts: boolean;
    loading: boolean;
    onHostsChange: (hosts: string[]) => void;
    onRefresh: () => void;
}

const toOption = (host: string) => ({ value: host, label: host });

const HostSelector: React.FC<HostSelectorProps> = ({
    availableHosts,
    selectedHosts,
    loadingHosts,
    loading,
    onHostsChange,
    onRefresh
}) => {
    const allSelected = availableHosts.length > 0 && selectedHosts.length === availableHosts.length;

    return (
        <div className="mb-6 theme-card rounded-lg border p-4">
            <label htmlFor="host-select" className="block text-sm font-medium theme-text-primary mb-2">
                Hosts to analyze
            </label>
            <div className="flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1 min-w-0">
                    <Select
                        inputId="host-select"
                        isMulti
                        closeMenuOnSelect={false}
                        hideSelectedOptions={false}
                        blurInputOnSelect={false}
                        isDisabled={loadingHosts}
                        isLoading={loadingHosts}
                        options={availableHosts.map(toOption)}
                        value={selectedHosts.map(toOption)}
                        onChange={(selected) => onHostsChange(selected ? selected.map((s) => s.value) : [])}
                        placeholder="Search or pick one or more hosts…"
                        noOptionsMessage={() => 'No matching host'}
                        className="text-sm"
                        styles={getSelectStyles()}
                    />
                </div>
                <div className="flex gap-2 shrink-0">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onHostsChange(allSelected ? [] : availableHosts)}
                        disabled={loadingHosts || availableHosts.length === 0}
                    >
                        {allSelected ? 'Clear all' : 'Select all'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading || loadingHosts} title="Reload host list and data">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
                        Refresh
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default HostSelector;
