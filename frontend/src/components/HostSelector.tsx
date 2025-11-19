import { useState, useEffect } from 'react';
import Select from 'react-select';
import { fetchTestRuns, extractTestRuns } from '../services/api/testRuns';
import Loading from './ui/Loading';
import { Check, Server, HardDrive } from 'lucide-react';

interface HostOption {
  value: string;
  label: string;
  hostname: string;
  protocol: string;
  driveType: string;
  driveModel: string;
  testCount?: number;
}

interface HostSelectorProps {
  selectedHosts: string[];
  onHostsChange: (hosts: string[]) => void;
  className?: string;
}

// Helper function to extract hostname from unique value
function extractHostname(uniqueValue: string): string {
  return uniqueValue.split('|')[0];
}

export default function HostSelector({ selectedHosts, onHostsChange, className = '' }: HostSelectorProps) {
  const [hostOptions, setHostOptions] = useState<HostOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewData, setPreviewData] = useState<Record<string, { count: number; configs: number }>>({});

  // Load available hosts with hardware details
  useEffect(() => {
    const loadHosts = async () => {
      try {
        setLoading(true);
        
        // Fetch all test runs using pagination to ensure we get all hosts
        const allRuns: any[] = [];
        const chunkSize = 1000; // Backend max is 10000, but use smaller chunks for better UX
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
          const res = await fetchTestRuns({ 
            limit: chunkSize,
            offset: offset 
          });
          
          if (res.error) {
            throw new Error(res.error);
          }

          if (res.data) {
            const chunk = extractTestRuns(res.data);
            allRuns.push(...chunk);
            offset += chunk.length;
            hasMore = chunk.length === chunkSize; // If we got a full chunk, there might be more
          } else {
            hasMore = false;
          }
        }

        // Create a map to track unique hostname + hardware combinations
        const hostMap = new Map<string, HostOption>();
        
        for (const run of allRuns) {
          const hostname = run.hostname || 'unknown';
          const protocol = run.protocol || 'unknown';
          const driveType = run.drive_type || 'unknown';
          const driveModel = run.drive_model || 'unknown';
          
          // Create a unique key for this hostname + hardware combination
          const hostKey = `${hostname}|${protocol}|${driveType}|${driveModel}`;
          
          if (!hostMap.has(hostKey)) {
            hostMap.set(hostKey, {
              value: hostKey, // Use unique hostKey as value
              label: `${hostname} - ${protocol} - ${driveType} - ${driveModel}`,
              hostname,
              protocol,
              driveType,
              driveModel
            });
          }
        }
        
        const options = Array.from(hostMap.values()).sort((a, b) => a.label.localeCompare(b.label));
        setHostOptions(options);
      } catch (error) {
        console.error('Failed to load host options:', error);
      } finally {
        setLoading(false);
      }
    };

    loadHosts();
  }, []);

  // Load preview data for selected hosts
  useEffect(() => {
    const loadPreviewData = async () => {
      if (selectedHosts.length === 0) {
        setPreviewData({});
        return;
      }

      try {
        // Extract actual hostnames from unique values
        const actualHostnames = selectedHosts.map(extractHostname);
        const res = await fetchTestRuns({ 
          hostnames: actualHostnames,
          // Only latest per config
        });
        
        if (res.data) {
          const testRuns = extractTestRuns(res.data);
          const preview: Record<string, { count: number; configs: number }> = {};
          
          // Group preview data by unique host-hardware combinations
          for (const uniqueValue of selectedHosts) {
            const hostname = extractHostname(uniqueValue);
            const hostRuns = testRuns.filter(run => run.hostname === hostname);
            preview[uniqueValue] = {
              count: hostRuns.length,
              configs: new Set(hostRuns.map(run => 
                `${run.block_size}|${run.read_write_pattern}|${run.queue_depth}`
              )).size
            };
          }
          
          setPreviewData(preview);
        }
      } catch (error) {
        console.error('Failed to load preview data:', error);
        setPreviewData({});
      }
    };

    loadPreviewData();
  }, [selectedHosts]);

  const customSelectStyles = {
    control: (base: any, state: any) => ({
      ...base,
      backgroundColor: 'var(--tw-bg-opacity,1) #fff',
      borderColor: state.isFocused ? '#3b82f6' : '#e5e7eb',
      boxShadow: state.isFocused ? '0 0 0 1px #3b82f6' : 'none',
      minHeight: 44,
      '&:hover': {
        borderColor: '#3b82f6'
      }
    }),
    menu: (base: any) => ({
      ...base,
      zIndex: 50,
      border: '1px solid #e5e7eb',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
    }),
    multiValue: (base: any) => ({
      ...base,
      backgroundColor: '#dbeafe',
      borderRadius: 6
    }),
    multiValueLabel: (base: any) => ({
      ...base,
      color: '#1e40af',
      fontWeight: 500
    }),
    multiValueRemove: (base: any) => ({
      ...base,
      color: '#1e40af',
      '&:hover': {
        backgroundColor: '#bfdbfe',
        color: '#1e40af'
      }
    }),
    option: (base: any, state: any) => ({
      ...base,
      backgroundColor: state.isFocused ? '#f3f4f6' : undefined,
      color: '#111827',
      padding: '12px 16px',
      '&:hover': {
        backgroundColor: '#f3f4f6'
      }
    }),
    placeholder: (base: any) => ({
      ...base,
      color: '#6b7280'
    })
  };

  const formatOptionLabel = (option: HostOption) => (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center gap-2">
        <Server className="w-4 h-4 text-blue-600" />
        <div className="flex flex-col">
          <span className="font-medium text-sm">{option.hostname}</span>
          <span className="text-xs text-gray-500">{option.protocol} - {option.driveType} - {option.driveModel}</span>
        </div>
      </div>
      {selectedHosts.includes(option.value) && (
        <Check className="w-4 h-4 text-green-600" />
      )}
    </div>
  );

  if (loading) {
    return (
      <div className={`${className}`}>
        <label className="block text-sm font-medium theme-text-primary mb-2">
          Host Selection
        </label>
        <div className="flex items-center gap-2 p-3 border rounded-lg">
          <Loading size="sm" />
          <span className="text-sm theme-text-secondary">Loading hosts...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      <label className="block text-sm font-medium theme-text-primary mb-2">
        Host Selection
      </label>
      
      <Select
        isMulti
        options={hostOptions}
        value={hostOptions.filter(option => selectedHosts.includes(option.value))}
        onChange={(selectedOptions) => {
          const hosts = selectedOptions ? selectedOptions.map(option => option.value) : [];
          onHostsChange(hosts);
        }}
        formatOptionLabel={formatOptionLabel}
        styles={customSelectStyles}
        className="w-full text-sm"
        classNamePrefix="react-select"
        placeholder="Select hosts to compare..."
        closeMenuOnSelect={false}
        hideSelectedOptions={false}
        isClearable={false}
        isSearchable={true}
        noOptionsMessage={() => "No hosts available"}
      />

      {/* Preview section */}
      {selectedHosts.length > 0 && (
        <div className="mt-4 space-y-2">
          <h4 className="text-sm font-medium theme-text-primary">
            Selected Hosts ({selectedHosts.length})
          </h4>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {selectedHosts.map(uniqueValue => {
              const preview = previewData[uniqueValue];
              const hostOption = hostOptions.find(opt => opt.value === uniqueValue);
              const hostname = extractHostname(uniqueValue);
              return (
                <div
                  key={uniqueValue}
                  className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
                >
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-blue-600" />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium theme-text-primary">
                        {hostname}
                      </span>
                      {hostOption && (
                        <span className="text-xs theme-text-secondary">
                          {hostOption.protocol} - {hostOption.driveType} - {hostOption.driveModel}
                        </span>
                      )}
                    </div>
                  </div>
                  {preview && (
                    <div className="flex items-center gap-3 text-xs theme-text-secondary">
                      <div className="flex items-center gap-1">
                        <HardDrive className="w-3 h-3" />
                        <span>{preview.count} runs</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                        <span>{preview.configs} configs</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          {selectedHosts.length >= 2 && (
            <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-800 dark:text-green-200">
                  Ready to compare {selectedHosts.length} hosts
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {selectedHosts.length === 1 && (
        <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-amber-600" />
            <span className="text-sm text-amber-800 dark:text-amber-200">
              Select at least 2 hosts to enable comparison
            </span>
          </div>
        </div>
      )}
    </div>
  );
}