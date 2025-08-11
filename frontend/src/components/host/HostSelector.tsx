import React from 'react';
import { useNavigate } from 'react-router-dom';
import Select from 'react-select';
import { ArrowLeft, RefreshCw } from 'lucide-react';
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

const HostSelector: React.FC<HostSelectorProps> = ({
    availableHosts,
    selectedHosts,
    loadingHosts,
    loading,
    onHostsChange,
    onRefresh
}) => {
    const navigate = useNavigate();

    return (
        <div className="mb-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
                <div className="flex items-center gap-4">
                    <Button
                        variant="outline"
                        onClick={() => navigate('/')}
                        className="flex items-center gap-2"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Home
                    </Button>
                    <Button
                        variant="outline"
                        onClick={onRefresh}
                        disabled={loading}
                        className="flex items-center gap-2"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>

                {/* Host Selector */}
                <div className="flex items-center gap-3 flex-1 max-w-md">
                    <span className="text-sm font-medium theme-text-secondary whitespace-nowrap">
                        Select Hosts:
                    </span>
                    <div className="flex-1">
                        <Select
                            isMulti
                            closeMenuOnSelect={false}
                            hideSelectedOptions={false}
                            blurInputOnSelect={false}
                            isClearable={false}
                            isDisabled={loadingHosts}
                            options={availableHosts.map(host => ({
                                value: host,
                                label: host
                            }))}
                            value={selectedHosts.map(host => ({
                                value: host,
                                label: host
                            }))}
                            onChange={(selected) => {
                                const hosts = selected ? selected.map(s => s.value) : [];
                                onHostsChange(hosts);
                            }}
                            placeholder="Select hosts to analyze..."
                            className="text-sm"
                            styles={getSelectStyles()}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HostSelector;