import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
	Settings,
	Database,
	History,
	ChevronUp,
	ChevronDown,
	Edit2,
	Trash2,
	ArrowLeft,
	Copy,
	Check,
	Server,
	PlayCircle,
	Search,
	X,
	Calendar,
	PackageMinus,
} from 'lucide-react';
import Button from '../components/ui/Button';
import Loading from '../components/ui/Loading';
import ErrorDisplay from '../components/ui/ErrorDisplay';
import Modal from '../components/ui/Modal';
import { useServerSideTestRuns } from '../hooks/useServerSideTestRuns';
import { useUUIDGroupedRuns } from '../hooks/api/useUUIDGroupedRuns';
import {
	deleteTestRuns,
	bulkUpdateTestRunsByUUID,
	fetchTestRun,
} from '../services/api/testRuns';
import {
	fetchTimeSeriesHistory,
	previewTimeSeriesCleanup,
	executeTimeSeriesCleanup,
} from '../services/api/timeSeries';
import { useNavigate } from 'react-router-dom';
import type { TestRun, UUIDGroup } from '../types';

// Tab types
type AdminTab = 'by-config' | 'by-run' | 'latest' | 'history';

interface EditableFields {
	hostname?: string;
	protocol?: string;
	description?: string;
	test_name?: string;
	drive_type?: string;
	drive_model?: string;
}

interface UUIDEditState {
	isOpen: boolean;
	uuid: string | null;
	uuidType: 'config_uuid' | 'run_uuid' | null;
	count: number;
	fields: EditableFields;
	enabledFields: Record<keyof EditableFields, boolean>;
}

interface UUIDDeleteState {
	isOpen: boolean;
	uuid: string | null;
	uuidType: 'config_uuid' | 'run_uuid' | null;
	count: number;
}

interface DataCleanupState {
	isOpen: boolean;
	mode: 'delete-old' | 'compact' | null;
	cutoffDate: string;
	compactFrequency: 'daily' | 'weekly' | 'monthly';
	previewCount: number | null;
	isLoading: boolean;
}

interface TestRunDetailsState {
	isOpen: boolean;
	testRun: TestRun | null;
	isLoading: boolean;
}

const Admin: React.FC = () => {
	const navigate = useNavigate();
	const [activeTab, setActiveTab] = useState<AdminTab>('by-config');
	const [copiedUUID, setCopiedUUID] = useState<string | null>(null);
	const [searchTerm, setSearchTerm] = useState<string>('');

	// UUID Grouping States
	const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
	const [uuidEditState, setUuidEditState] = useState<UUIDEditState>({
		isOpen: false,
		uuid: null,
		uuidType: null,
		count: 0,
		fields: {},
		enabledFields: {
			hostname: false,
			protocol: false,
			description: false,
			test_name: false,
			drive_type: false,
			drive_model: false,
		},
	});
	const [uuidDeleteState, setUuidDeleteState] = useState<UUIDDeleteState>({
		isOpen: false,
		uuid: null,
		uuidType: null,
		count: 0,
	});

	// Data cleanup state
	const [dataCleanupState, setDataCleanupState] = useState<DataCleanupState>({
		isOpen: false,
		mode: null,
		cutoffDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 90 days ago
		compactFrequency: 'daily',
		previewCount: null,
		isLoading: false,
	});

	// Test run details state
	const [testRunDetailsState, setTestRunDetailsState] = useState<TestRunDetailsState>({
		isOpen: false,
		testRun: null,
		isLoading: false,
	});

	// UUID group runs state - stores fetched runs for each UUID
	const [uuidGroupRuns, setUuidGroupRuns] = useState<Map<string, TestRun[]>>(new Map());
	const [uuidGroupRunsLoading, setUuidGroupRunsLoading] = useState<Map<string, boolean>>(new Map());

	// History state
	const [timeSeriesData, setTimeSeriesData] = useState<any[]>([]);
	const [timeSeriesLoading, setTimeSeriesLoading] = useState(false);

	// Fetch UUID-grouped data
	const configGroups = useUUIDGroupedRuns({
		groupBy: 'config_uuid',
		enabled: activeTab === 'by-config',
	});

	const runGroups = useUUIDGroupedRuns({
		groupBy: 'run_uuid',
		enabled: activeTab === 'by-run',
	});

	// Fetch latest runs
	const {
		testRuns: latestRuns,
		loading: latestLoading,
		error: latestError,
	} = useServerSideTestRuns({
		autoFetch: activeTab === 'latest',
	});

	// Fetch history data
	useEffect(() => {
		if (activeTab === 'history') {
			setTimeSeriesLoading(true);
			fetchTimeSeriesHistory()
				.then((result) => {
					// Extract data from ApiResponse wrapper with pagination
					if (result.error) {
						console.error('Error fetching history:', result.error);
						setTimeSeriesData([]);
					} else {
						// Backend returns { data: { data: [...], pagination: {...} } }
						const historyData = Array.isArray(result.data?.data) ? result.data.data : [];
						setTimeSeriesData(historyData);
					}
				})
				.catch((err) => {
					console.error('Error fetching history:', err);
					setTimeSeriesData([]);
				})
				.finally(() => setTimeSeriesLoading(false));
		}
	}, [activeTab]);

	// Filter UUID groups based on search term
	const filteredConfigGroups = useMemo(() => {
		if (!searchTerm || !Array.isArray(configGroups.data)) return configGroups.data;

		const lowerSearch = searchTerm.toLowerCase();
		return configGroups.data.filter((group) => {
			const metadata = group.sample_metadata;
			return (
				metadata.hostname?.toLowerCase().includes(lowerSearch) ||
				metadata.protocol?.toLowerCase().includes(lowerSearch) ||
				metadata.drive_model?.toLowerCase().includes(lowerSearch) ||
				metadata.drive_type?.toLowerCase().includes(lowerSearch) ||
				group.uuid.toLowerCase().includes(lowerSearch)
			);
		});
	}, [configGroups.data, searchTerm]);

	const filteredRunGroups = useMemo(() => {
		if (!searchTerm || !Array.isArray(runGroups.data)) return runGroups.data;

		const lowerSearch = searchTerm.toLowerCase();
		return runGroups.data.filter((group) => {
			const metadata = group.sample_metadata;
			return (
				metadata.hostname?.toLowerCase().includes(lowerSearch) ||
				metadata.protocol?.toLowerCase().includes(lowerSearch) ||
				metadata.drive_model?.toLowerCase().includes(lowerSearch) ||
				metadata.drive_type?.toLowerCase().includes(lowerSearch) ||
				group.uuid.toLowerCase().includes(lowerSearch)
			);
		});
	}, [runGroups.data, searchTerm]);

	// Filter latest runs based on search term
	const filteredLatestRuns = useMemo(() => {
		if (!searchTerm) return latestRuns;

		const lowerSearch = searchTerm.toLowerCase();
		return latestRuns.filter((run) => {
			const blockSizeStr = typeof run.block_size === 'string' ? run.block_size : String(run.block_size);
			return (
				run.hostname?.toLowerCase().includes(lowerSearch) ||
				run.protocol?.toLowerCase().includes(lowerSearch) ||
				run.drive_model?.toLowerCase().includes(lowerSearch) ||
				run.drive_type?.toLowerCase().includes(lowerSearch) ||
				run.test_name?.toLowerCase().includes(lowerSearch) ||
				run.description?.toLowerCase().includes(lowerSearch) ||
				run.read_write_pattern?.toLowerCase().includes(lowerSearch) ||
				blockSizeStr.toLowerCase().includes(lowerSearch) ||
				run.config_uuid?.toLowerCase().includes(lowerSearch) ||
				run.run_uuid?.toLowerCase().includes(lowerSearch)
			);
		});
	}, [latestRuns, searchTerm]);

	// Filter history data based on search term
	const filteredHistoryData = useMemo(() => {
		if (!searchTerm || !Array.isArray(timeSeriesData)) return timeSeriesData;

		const lowerSearch = searchTerm.toLowerCase();
		return timeSeriesData.filter((run: any) => {
			const blockSizeStr = typeof run.block_size === 'string' ? run.block_size : String(run.block_size || '');
			return (
				run.hostname?.toLowerCase().includes(lowerSearch) ||
				run.protocol?.toLowerCase().includes(lowerSearch) ||
				run.drive_model?.toLowerCase().includes(lowerSearch) ||
				run.drive_type?.toLowerCase().includes(lowerSearch) ||
				run.test_name?.toLowerCase().includes(lowerSearch) ||
				run.description?.toLowerCase().includes(lowerSearch) ||
				run.read_write_pattern?.toLowerCase().includes(lowerSearch) ||
				blockSizeStr.toLowerCase().includes(lowerSearch) ||
				run.config_uuid?.toLowerCase().includes(lowerSearch) ||
				run.run_uuid?.toLowerCase().includes(lowerSearch)
			);
		});
	}, [timeSeriesData, searchTerm]);

	// Group latest runs by run_uuid
	const groupedLatestRuns = useMemo(() => {
		const groups = new Map<string, TestRun[]>();

		filteredLatestRuns.forEach((run) => {
			const uuid = run.run_uuid || 'no-uuid';
			if (!groups.has(uuid)) {
				groups.set(uuid, []);
			}
			groups.get(uuid)!.push(run);
		});

		// Convert to array and sort by most recent timestamp
		return Array.from(groups.entries())
			.map(([uuid, runs]) => ({
				uuid,
				runs,
				count: runs.length,
				avgIops: runs.reduce((sum, r) => sum + (r.iops || 0), 0) / runs.length,
				latestTimestamp: Math.max(...runs.map(r => new Date(r.timestamp).getTime())),
				hostname: runs[0]?.hostname || 'N/A',
			}))
			.sort((a, b) => b.latestTimestamp - a.latestTimestamp);
	}, [filteredLatestRuns]);

	// Copy UUID to clipboard
	const copyUUID = useCallback((uuid: string) => {
		navigator.clipboard.writeText(uuid);
		setCopiedUUID(uuid);
		setTimeout(() => setCopiedUUID(null), 2000);
	}, []);

	// Fetch runs for a UUID group
	const fetchUUIDGroupRuns = useCallback(async (uuid: string, testRunIds: number[]) => {
		// Skip if already loading or loaded
		if (uuidGroupRunsLoading.get(uuid) || uuidGroupRuns.has(uuid)) {
			return;
		}

		// Mark as loading
		setUuidGroupRunsLoading(new Map(uuidGroupRunsLoading.set(uuid, true)));

		try {
			// Fetch each test run individually using the service API
			const fetchPromises = testRunIds.map(async (id) => {
				const result = await fetchTestRun(id);
				if (result.error) {
					throw new Error(result.error);
				}
				return result.data;
			});

			const runs = await Promise.all(fetchPromises);

			// Store the runs (filter out any null/undefined results)
			const validRuns = runs.filter((run): run is TestRun => run !== null && run !== undefined);
			setUuidGroupRuns(new Map(uuidGroupRuns.set(uuid, validRuns)));
		} catch (err) {
			console.error('Error fetching UUID group runs:', err);
		} finally {
			setUuidGroupRunsLoading(new Map(uuidGroupRunsLoading.set(uuid, false)));
		}
	}, [uuidGroupRuns, uuidGroupRunsLoading]);

	// Toggle group expansion
	const toggleGroup = useCallback((uuid: string, testRunIds?: number[]) => {
		setExpandedGroups((prev) => {
			const next = new Set(prev);
			if (next.has(uuid)) {
				next.delete(uuid);
			} else {
				next.add(uuid);
				// Fetch runs when expanding if not already loaded
				if (testRunIds && testRunIds.length > 0) {
					fetchUUIDGroupRuns(uuid, testRunIds);
				}
			}
			return next;
		});
	}, [fetchUUIDGroupRuns]);

	// Open UUID edit modal
	const openUUIDEdit = useCallback(
		(uuid: string, uuidType: 'config_uuid' | 'run_uuid', count: number) => {
			setUuidEditState({
				isOpen: true,
				uuid,
				uuidType,
				count,
				fields: {},
				enabledFields: {
					hostname: false,
					protocol: false,
					description: false,
					test_name: false,
					drive_type: false,
					drive_model: false,
				},
			});
		},
		[]
	);

	// Submit UUID bulk edit
	const handleUUIDEdit = useCallback(async () => {
		if (!uuidEditState.uuid || !uuidEditState.uuidType) return;

		const updates: EditableFields = {};
		for (const [key, enabled] of Object.entries(uuidEditState.enabledFields)) {
			if (enabled) {
				updates[key as keyof EditableFields] =
					uuidEditState.fields[key as keyof EditableFields];
			}
		}

		if (Object.keys(updates).length === 0) {
			alert('Please enable and fill at least one field to update');
			return;
		}

		try {
			await bulkUpdateTestRunsByUUID(
				uuidEditState.uuid,
				uuidEditState.uuidType,
				updates
			);
			alert(`Successfully updated ${uuidEditState.count} test runs`);
			setUuidEditState({ ...uuidEditState, isOpen: false });

			// Refresh data
			if (uuidEditState.uuidType === 'config_uuid') {
				configGroups.refresh();
			} else {
				runGroups.refresh();
			}
		} catch (err) {
			console.error('Error updating by UUID:', err);
			alert('Failed to update test runs');
		}
	}, [uuidEditState, configGroups, runGroups]);

	// Open UUID delete modal
	const openUUIDDelete = useCallback(
		(uuid: string, uuidType: 'config_uuid' | 'run_uuid', count: number) => {
			setUuidDeleteState({
				isOpen: true,
				uuid,
				uuidType,
				count,
			});
		},
		[]
	);

	// Submit UUID delete
	const handleUUIDDelete = useCallback(async () => {
		if (!uuidDeleteState.uuid || !uuidDeleteState.uuidType) return;

		// Get all test run IDs for this UUID
		const groups =
			uuidDeleteState.uuidType === 'config_uuid' ? configGroups.data : runGroups.data;

		// Safety check: ensure groups is an array
		if (!Array.isArray(groups)) {
			console.error('Groups data is not an array');
			return;
		}

		const group = groups.find((g) => g.uuid === uuidDeleteState.uuid);

		if (!group) {
			console.error('Group not found for UUID:', uuidDeleteState.uuid);
			return;
		}

		try {
			await deleteTestRuns(group.test_run_ids);
			alert(`Successfully deleted ${uuidDeleteState.count} test runs`);
			setUuidDeleteState({ ...uuidDeleteState, isOpen: false });

			// Refresh data
			if (uuidDeleteState.uuidType === 'config_uuid') {
				configGroups.refresh();
			} else {
				runGroups.refresh();
			}
		} catch (err) {
			console.error('Error deleting by UUID:', err);
			alert('Failed to delete test runs');
		}
	}, [uuidDeleteState, configGroups, runGroups]);

	// Format date range
	const formatDateRange = (firstTest: string, lastTest: string) => {
		const first = new Date(firstTest).toLocaleDateString();
		const last = new Date(lastTest).toLocaleDateString();
		return first === last ? first : `${first} - ${last}`;
	};

	// Open data cleanup modal
	const openDataCleanup = useCallback((mode: 'delete-old' | 'compact') => {
		setDataCleanupState({
			...dataCleanupState,
			isOpen: true,
			mode,
			previewCount: null,
		});
	}, [dataCleanupState]);

	// Preview data cleanup
	const previewDataCleanup = useCallback(async () => {
		setDataCleanupState({ ...dataCleanupState, isLoading: true });

		try {
			const result = await previewTimeSeriesCleanup(
				dataCleanupState.cutoffDate,
				dataCleanupState.mode || 'delete-old',
				dataCleanupState.mode === 'compact' ? dataCleanupState.compactFrequency : undefined
			);

			if (result.error) {
				throw new Error(result.error);
			}

			setDataCleanupState({
				...dataCleanupState,
				previewCount: result.data?.affected_count || 0,
				isLoading: false,
			});
		} catch (err) {
			console.error('Error previewing cleanup:', err);
			alert('Failed to preview cleanup');
			setDataCleanupState({ ...dataCleanupState, isLoading: false });
		}
	}, [dataCleanupState]);

	// Execute data cleanup
	const executeDataCleanup = useCallback(async () => {
		setDataCleanupState({ ...dataCleanupState, isLoading: true });

		try {
			const result = await executeTimeSeriesCleanup(
				dataCleanupState.cutoffDate,
				dataCleanupState.mode || 'delete-old',
				dataCleanupState.mode === 'compact' ? dataCleanupState.compactFrequency : undefined
			);

			if (result.error) {
				throw new Error(result.error);
			}

			alert(`Successfully ${dataCleanupState.mode === 'delete-old' ? 'deleted' : 'compacted'} ${result.data?.deleted_count || 0} test runs`);

			setDataCleanupState({
				...dataCleanupState,
				isOpen: false,
				isLoading: false,
			});

			// Refresh history data
			if (activeTab === 'history') {
				setTimeSeriesLoading(true);
				fetchTimeSeriesHistory()
					.then((result) => {
						if (result.error) {
							console.error('Error fetching history:', result.error);
							setTimeSeriesData([]);
						} else {
							const historyData = Array.isArray(result.data?.data) ? result.data.data : [];
							setTimeSeriesData(historyData);
						}
					})
					.catch((err) => {
						console.error('Error fetching history:', err);
						setTimeSeriesData([]);
					})
					.finally(() => setTimeSeriesLoading(false));
			}
		} catch (err) {
			console.error('Error executing cleanup:', err);
			alert('Failed to execute cleanup');
			setDataCleanupState({ ...dataCleanupState, isLoading: false });
		}
	}, [dataCleanupState, activeTab]);

	// Open test run details
	const openTestRunDetails = useCallback(async (testRunId: number) => {
		setTestRunDetailsState({ isOpen: true, testRun: null, isLoading: true });

		try {
			const result = await fetchTestRun(testRunId);

			if (result.error) {
				throw new Error(result.error);
			}

			setTestRunDetailsState({
				isOpen: true,
				testRun: result.data || null,
				isLoading: false,
			});
		} catch (err) {
			console.error('Error fetching test run details:', err);
			alert('Failed to load test run details');
			setTestRunDetailsState({ isOpen: false, testRun: null, isLoading: false });
		}
	}, []);

	// Render UUID Group Card
	const renderUUIDGroup = (group: UUIDGroup, uuidType: 'config_uuid' | 'run_uuid') => {
		const isExpanded = expandedGroups.has(group.uuid);

		return (
			<div key={group.uuid} className="border border-gray-200 dark:border-gray-700 rounded-lg mb-4 bg-white dark:bg-gray-800">
				{/* Group Header */}
				<div className="p-4 bg-gray-50 dark:bg-gray-750 border-b border-gray-200 dark:border-gray-700">
					<div className="flex items-start justify-between">
						<div className="flex-1">
							<div className="flex items-center gap-3 mb-3">
								<div className="flex items-center gap-2">
									<span className="text-gray-500 dark:text-gray-400 text-sm">Host:</span>
									<h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
										{group.sample_metadata.hostname || 'N/A'}
									</h3>
								</div>
								<div className="flex items-center gap-2">
									<span className="text-gray-500 dark:text-gray-400 text-sm">
										{uuidType === 'config_uuid' ? 'Config UUID:' : 'Run UUID:'}
									</span>
									<span className="font-mono text-sm text-gray-600 dark:text-gray-400">{group.uuid}</span>
									<button
										onClick={() => copyUUID(group.uuid)}
										className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
										title="Copy UUID"
									>
										{copiedUUID === group.uuid ? (
											<Check className="w-4 h-4 text-green-600 dark:text-green-400" />
										) : (
											<Copy className="w-4 h-4 text-gray-500 dark:text-gray-400" />
										)}
									</button>
								</div>
							</div>

							<div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
								<div>
									<span className="text-gray-500 dark:text-gray-400">Tests:</span>
									<span className="ml-2 font-semibold text-gray-900 dark:text-gray-100">{group.count}</span>
								</div>
								<div>
									<span className="text-gray-500 dark:text-gray-400">Avg IOPS:</span>
									<span className="ml-2 font-semibold text-gray-900 dark:text-gray-100">
										{group.avg_iops
											? Math.round(group.avg_iops).toLocaleString()
											: 'N/A'}
									</span>
								</div>
								<div>
									<span className="text-gray-500 dark:text-gray-400">Date Range:</span>
									<span className="ml-2 font-semibold text-gray-900 dark:text-gray-100">
										{formatDateRange(group.first_test, group.last_test)}
									</span>
								</div>
							</div>

							<div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
								{group.sample_metadata.protocol && (
									<span className="mr-3">
										Protocol: {group.sample_metadata.protocol}
									</span>
								)}
								{group.sample_metadata.drive_type && (
									<span className="mr-3">
										Type: {group.sample_metadata.drive_type}
									</span>
								)}
								{group.sample_metadata.drive_model && (
									<span>Model: {group.sample_metadata.drive_model}</span>
								)}
							</div>
						</div>

						<div className="flex items-center gap-2 ml-4">
							<Button
								variant="outline"
								size="sm"
								onClick={() => openUUIDEdit(group.uuid, uuidType, group.count)}
							>
								<Edit2 className="w-4 h-4 mr-1" />
								Edit All
							</Button>
							<Button
								variant="danger"
								size="sm"
								onClick={() =>
									openUUIDDelete(group.uuid, uuidType, group.count)
								}
							>
								<Trash2 className="w-4 h-4 mr-1" />
								Delete
							</Button>
							<button
								onClick={() => toggleGroup(group.uuid, group.test_run_ids)}
								className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
							>
								{isExpanded ? (
									<ChevronUp className="w-5 h-5 text-gray-900 dark:text-gray-100" />
								) : (
									<ChevronDown className="w-5 h-5 text-gray-900 dark:text-gray-100" />
								)}
							</button>
						</div>
					</div>
				</div>

				{/* Expanded Test Table */}
				{isExpanded && (
					<div className="overflow-x-auto">
						{uuidGroupRunsLoading.get(group.uuid) ? (
							<div className="p-8 text-center">
								<Loading message="Loading test runs..." />
							</div>
						) : uuidGroupRuns.get(group.uuid) ? (
							<table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
								<thead className="bg-gray-100 dark:bg-gray-700">
									<tr>
										<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Test Run</th>
										<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Configuration</th>
										<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Performance</th>
										<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">UUIDs</th>
									</tr>
								</thead>
								<tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
									{uuidGroupRuns.get(group.uuid)!.map((run) => (
										<tr
											key={run.id}
											onClick={() => openTestRunDetails(run.id)}
											className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
										>
											<td className="px-4 py-3">
												<div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
													Test Run #{run.id}
												</div>
												<div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
													{new Date(run.timestamp).toLocaleString()}
												</div>
												<div className="text-xs text-gray-600 dark:text-gray-400 mt-1" title={run.test_name || 'Unnamed Test'}>
													{run.test_name && run.test_name.length > 40
														? `${run.test_name.substring(0, 40)}...`
														: run.test_name || 'Unnamed Test'}
												</div>
											</td>
											<td className="px-4 py-3">
												<div className="text-sm text-gray-900 dark:text-gray-100">
													<span className="font-medium">{run.protocol}</span> • {run.read_write_pattern}
												</div>
												<div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
													{run.drive_type} - {run.drive_model}
												</div>
												<div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
													Block: {run.block_size} • QD: {run.queue_depth} • Jobs: {run.num_jobs || 1}
												</div>
											</td>
											<td className="px-4 py-3">
												<div className="text-sm font-bold text-gray-900 dark:text-gray-100">
													{run.iops ? Math.round(run.iops).toLocaleString() : 'N/A'} IOPS
												</div>
												{run.bandwidth && (
													<div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
														BW: {run.bandwidth.toFixed(2)} MB/s
													</div>
												)}
												{run.avg_latency && (
													<div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
														Latency: {run.avg_latency.toFixed(3)} ms
													</div>
												)}
											</td>
											<td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
												{run.config_uuid && (
													<div title={run.config_uuid} className="mb-1">
														C: {run.config_uuid.slice(0, 8)}...
													</div>
												)}
												{run.run_uuid && (
													<div title={run.run_uuid}>
														R: {run.run_uuid.slice(0, 8)}...
													</div>
												)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						) : (
							<div className="p-4 text-center text-gray-500 dark:text-gray-400">
								No test runs available
							</div>
						)}
					</div>
				)}
			</div>
		);
	};

	// Render UUID Groups Tab
	const renderUUIDGroupsTab = (
		groups: typeof configGroups | typeof runGroups,
		filteredData: UUIDGroup[] | undefined,
		uuidType: 'config_uuid' | 'run_uuid',
		title: string,
		icon: React.ReactNode
	) => {
		if (groups.loading) {
			return <Loading message={`Loading ${title.toLowerCase()}...`} />;
		}

		if (groups.error) {
			return <ErrorDisplay error={groups.error} />;
		}

		// Use filtered data
		const groupsData = Array.isArray(filteredData) ? filteredData : [];
		const totalGroups = Array.isArray(groups.data) ? groups.data.length : 0;

		return (
			<div>
				<div className="mb-6 flex items-center justify-between">
					<div className="flex items-center gap-2">
						{icon}
						<h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{title}</h2>
					</div>
					<div className="text-sm text-gray-600 dark:text-gray-400">
						{groupsData.length} {searchTerm && `/ ${totalGroups}`} group{groupsData.length !== 1 ? 's' : ''}
					</div>
				</div>

				{groupsData.length === 0 ? (
					<div className="text-center py-12 text-gray-500 dark:text-gray-400">
						{searchTerm
							? `No test runs found matching "${searchTerm}"`
							: `No test runs found with ${uuidType === 'config_uuid' ? 'configuration' : 'run'} UUIDs`
						}
					</div>
				) : (
					<div>
						{groupsData.map((group) => renderUUIDGroup(group, uuidType))}
					</div>
				)}
			</div>
		);
	};

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-900">
			{/* Header */}
			<div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex items-center justify-between h-16">
						<div className="flex items-center gap-4">
							<button
								onClick={() => navigate('/')}
								className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
							>
								<ArrowLeft className="w-5 h-5" />
								<span className="font-medium">Back to Dashboard</span>
							</button>
							<div className="h-6 w-px bg-gray-300 dark:bg-gray-600"></div>
							<div className="flex items-center gap-2">
								<Settings className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
								<h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
									Admin Panel
								</h1>
							</div>
						</div>
					</div>

					{/* Search Bar */}
					<div className="mt-4 mb-2">
						<div className="relative max-w-md">
							<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
							<input
								type="text"
								placeholder="Search by hostname, protocol, drive, name, description, UUID..."
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
							/>
							{searchTerm && (
								<button
									onClick={() => setSearchTerm('')}
									className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
								>
									<X className="w-5 h-5" />
								</button>
							)}
						</div>
					</div>

					{/* Tab Navigation */}
					<div className="flex gap-1 -mb-px">
						<button
							onClick={() => setActiveTab('by-config')}
							className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${
								activeTab === 'by-config'
									? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400'
									: 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
							}`}
						>
							<Server className="w-4 h-4" />
							By Host Config
						</button>
						<button
							onClick={() => setActiveTab('by-run')}
							className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${
								activeTab === 'by-run'
									? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400'
									: 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
							}`}
						>
							<PlayCircle className="w-4 h-4" />
							By Script Run
						</button>
						<button
							onClick={() => setActiveTab('latest')}
							className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${
								activeTab === 'latest'
									? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400'
									: 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
							}`}
						>
							<Database className="w-4 h-4" />
							Latest Runs
						</button>
						<button
							onClick={() => setActiveTab('history')}
							className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${
								activeTab === 'history'
									? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400'
									: 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
							}`}
						>
							<History className="w-4 h-4" />
							History
						</button>
					</div>
				</div>
			</div>

			{/* Main Content */}
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				{activeTab === 'by-config' &&
					renderUUIDGroupsTab(
						configGroups,
						filteredConfigGroups,
						'config_uuid',
						'By Host Configuration',
						<Server className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
					)}

				{activeTab === 'by-run' &&
					renderUUIDGroupsTab(
						runGroups,
						filteredRunGroups,
						'run_uuid',
						'By Script Run',
						<PlayCircle className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
					)}

				{activeTab === 'latest' && (
					<div>
						<div className="mb-6 flex items-center justify-between">
							<div className="flex items-center gap-2">
								<Database className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
								<h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Latest Test Runs (Grouped by Run)</h2>
							</div>
							<div className="text-sm text-gray-600 dark:text-gray-400">
								{groupedLatestRuns.length} {searchTerm && `/ ${new Set(latestRuns.map(r => r.run_uuid)).size}`} run{groupedLatestRuns.length !== 1 ? 's' : ''}
							</div>
						</div>

						{latestLoading ? (
							<Loading message="Loading latest runs..." />
						) : latestError ? (
							<ErrorDisplay error={latestError} />
						) : groupedLatestRuns.length === 0 ? (
							<div className="text-center py-12 text-gray-500 dark:text-gray-400">
								{searchTerm ? `No test runs found matching "${searchTerm}"` : 'No test runs found'}
							</div>
						) : (
							<div>
								{groupedLatestRuns.map((group) => {
									const isExpanded = expandedGroups.has(group.uuid);
									return (
										<div key={group.uuid} className="border border-gray-200 dark:border-gray-700 rounded-lg mb-4 bg-white dark:bg-gray-800">
											{/* Group Header */}
											<div className="p-4 bg-gray-50 dark:bg-gray-750 border-b border-gray-200 dark:border-gray-700">
												<div className="flex items-start justify-between">
													<div className="flex-1">
														<div className="flex items-center gap-3 mb-3">
															<div className="flex items-center gap-2">
																<span className="text-gray-500 dark:text-gray-400 text-sm">Host:</span>
																<h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
																	{group.hostname}
																</h3>
															</div>
															{group.uuid !== 'no-uuid' && (
																<div className="flex items-center gap-2">
																	<span className="text-gray-500 dark:text-gray-400 text-sm">Run UUID:</span>
																	<span className="font-mono text-sm text-gray-600 dark:text-gray-400">{group.uuid}</span>
																	<button
																		onClick={() => copyUUID(group.uuid)}
																		className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
																		title="Copy UUID"
																	>
																		{copiedUUID === group.uuid ? (
																			<Check className="w-4 h-4 text-green-600 dark:text-green-400" />
																		) : (
																			<Copy className="w-4 h-4 text-gray-500 dark:text-gray-400" />
																		)}
																	</button>
																</div>
															)}
														</div>

														<div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
															<div>
																<span className="text-gray-500 dark:text-gray-400">Tests:</span>
																<span className="ml-2 font-semibold text-gray-900 dark:text-gray-100">{group.count}</span>
															</div>
															<div>
																<span className="text-gray-500 dark:text-gray-400">Avg IOPS:</span>
																<span className="ml-2 font-semibold text-gray-900 dark:text-gray-100">
																	{Math.round(group.avgIops).toLocaleString()}
																</span>
															</div>
															<div>
																<span className="text-gray-500 dark:text-gray-400">Latest:</span>
																<span className="ml-2 font-semibold text-gray-900 dark:text-gray-100">
																	{new Date(group.latestTimestamp).toLocaleDateString()}
																</span>
															</div>
														</div>
													</div>

													<button
														onClick={() => toggleGroup(group.uuid)}
														className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors ml-4"
													>
														{isExpanded ? (
															<ChevronUp className="w-5 h-5 text-gray-900 dark:text-gray-100" />
														) : (
															<ChevronDown className="w-5 h-5 text-gray-900 dark:text-gray-100" />
														)}
													</button>
												</div>
											</div>

											{/* Expanded Test Table */}
											{isExpanded && (
												<div className="overflow-x-auto">
													<table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
														<thead className="bg-gray-100 dark:bg-gray-700">
															<tr>
																<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Test Run</th>
																<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Configuration</th>
																<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Performance</th>
																<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">UUIDs</th>
															</tr>
														</thead>
														<tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
															{group.runs.map((run) => (
																<tr
																	key={run.id}
																	onClick={() => openTestRunDetails(run.id)}
																	className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
																>
																	<td className="px-4 py-3">
																		<div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
																			Test Run #{run.id}
																		</div>
																		<div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
																			{new Date(run.timestamp).toLocaleString()}
																		</div>
																		<div className="text-xs text-gray-600 dark:text-gray-400 mt-1" title={run.test_name || 'Unnamed Test'}>
																			{run.test_name && run.test_name.length > 40
																				? `${run.test_name.substring(0, 40)}...`
																				: run.test_name || 'Unnamed Test'}
																		</div>
																	</td>
																	<td className="px-4 py-3">
																		<div className="text-sm text-gray-900 dark:text-gray-100">
																			<span className="font-medium">{run.protocol}</span> • {run.read_write_pattern}
																		</div>
																		<div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
																			{run.drive_type} - {run.drive_model}
																		</div>
																		<div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
																			Block: {run.block_size} • QD: {run.queue_depth} • Jobs: {run.num_jobs || 1}
																		</div>
																	</td>
																	<td className="px-4 py-3">
																		<div className="text-sm font-bold text-gray-900 dark:text-gray-100">
																			{run.iops ? Math.round(run.iops).toLocaleString() : 'N/A'} IOPS
																		</div>
																		{run.bandwidth && (
																			<div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
																				BW: {run.bandwidth.toFixed(2)} MB/s
																			</div>
																		)}
																		{run.avg_latency && (
																			<div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
																				Latency: {run.avg_latency.toFixed(3)} ms
																			</div>
																		)}
																	</td>
																	<td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
																		{run.config_uuid && (
																			<div title={run.config_uuid} className="mb-1">
																				C: {run.config_uuid.slice(0, 8)}...
																			</div>
																		)}
																		{run.run_uuid && (
																			<div title={run.run_uuid}>
																				R: {run.run_uuid.slice(0, 8)}...
																			</div>
																		)}
																	</td>
																</tr>
															))}
														</tbody>
													</table>
												</div>
											)}
										</div>
									);
								})}
							</div>
						)}
					</div>
				)}

				{activeTab === 'history' && (
					<div>
						<div className="mb-6 flex items-center justify-between">
							<div>
								<h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Historical Test Runs</h2>
								<p className="text-gray-600 dark:text-gray-400 mt-2">
									Showing {filteredHistoryData.length} {searchTerm && `/ ${timeSeriesData.length}`} historical test run{filteredHistoryData.length !== 1 ? 's' : ''}
								</p>
							</div>
							<div className="flex items-center gap-2">
								<Button
									variant="outline"
									size="sm"
									onClick={() => openDataCleanup('delete-old')}
								>
									<Trash2 className="w-4 h-4 mr-1" />
									Delete Old Data
								</Button>
								<Button
									variant="outline"
									size="sm"
									onClick={() => openDataCleanup('compact')}
								>
									<PackageMinus className="w-4 h-4 mr-1" />
									Compact History
								</Button>
							</div>
						</div>
						{timeSeriesLoading ? (
							<Loading message="Loading history..." />
						) : filteredHistoryData.length === 0 ? (
							<div className="text-center py-12 text-gray-500 dark:text-gray-400">
								{searchTerm ? `No historical test runs found matching "${searchTerm}"` : 'No historical test runs found'}
							</div>
						) : (
							<div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
								<div className="overflow-x-auto">
									<table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
										<thead className="bg-gray-50 dark:bg-gray-750">
											<tr>
												<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">ID</th>
												<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Timestamp</th>
												<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Hostname</th>
												<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Protocol</th>
												<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Drive</th>
												<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Pattern</th>
												<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Block Size</th>
												<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">IOPS</th>
												<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">UUIDs</th>
											</tr>
										</thead>
										<tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
											{filteredHistoryData.map((run: any) => (
												<tr key={run.test_run_id || run.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
													<td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{run.test_run_id || run.id}</td>
													<td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
														{new Date(run.timestamp || run.test_date).toLocaleDateString()}
													</td>
													<td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{run.hostname}</td>
													<td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{run.protocol}</td>
													<td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
														{run.drive_type && (
															<>
																{run.drive_type}
																<br />
															</>
														)}
														<span className="text-xs text-gray-500 dark:text-gray-400">{run.drive_model}</span>
													</td>
													<td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{run.read_write_pattern}</td>
													<td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{run.block_size}</td>
													<td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
														{run.iops ? Math.round(run.iops).toLocaleString() : 'N/A'}
													</td>
													<td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
														<div className="space-y-1">
															{run.config_uuid && (
																<div title={run.config_uuid}>
																	C: {run.config_uuid.slice(0, 8)}...
																</div>
															)}
															{run.run_uuid && (
																<div title={run.run_uuid}>
																	R: {run.run_uuid.slice(0, 8)}...
																</div>
															)}
														</div>
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</div>
						)}
					</div>
				)}
			</div>

			{/* UUID Edit Modal */}
			<Modal
				isOpen={uuidEditState.isOpen}
				onClose={() => setUuidEditState({ ...uuidEditState, isOpen: false })}
				title={`Edit All Tests in ${
					uuidEditState.uuidType === 'config_uuid'
						? 'Host Configuration'
						: 'Script Run'
				}`}
			>
				<div className="space-y-4">
					<div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
						<p className="text-sm text-blue-800 dark:text-blue-200">
							<strong>Warning:</strong> This will update {uuidEditState.count} test
							run{uuidEditState.count !== 1 ? 's' : ''} with the same values.
						</p>
						<p className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-mono">
							UUID: {uuidEditState.uuid}
						</p>
					</div>

					{/* Field toggles and inputs */}
					{(
						['hostname', 'protocol', 'drive_type', 'drive_model', 'test_name', 'description'] as Array<
							keyof EditableFields
						>
					).map((field) => (
						<div key={field} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
							<label className="flex items-center gap-2 mb-2">
								<input
									type="checkbox"
									checked={uuidEditState.enabledFields[field]}
									onChange={(e) =>
										setUuidEditState({
											...uuidEditState,
											enabledFields: {
												...uuidEditState.enabledFields,
												[field]: e.target.checked,
											},
						})
									}
									className="rounded"
								/>
								<span className="font-medium text-sm capitalize text-gray-900 dark:text-gray-100">
									{field.replace('_', ' ')}
								</span>
							</label>
							<input
								type="text"
								disabled={!uuidEditState.enabledFields[field]}
								value={uuidEditState.fields[field] || ''}
								onChange={(e) =>
									setUuidEditState({
										...uuidEditState,
										fields: {
											...uuidEditState.fields,
											[field]: e.target.value,
										},
									})
								}
								placeholder={`Enter new ${field.replace('_', ' ')}`}
								className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
							/>
						</div>
					))}

					<div className="flex gap-2 pt-4">
						<Button onClick={handleUUIDEdit} className="flex-1">
							Update {uuidEditState.count} Test Runs
						</Button>
						<Button
							variant="outline"
							onClick={() => setUuidEditState({ ...uuidEditState, isOpen: false })}
						>
							Cancel
						</Button>
					</div>
				</div>
			</Modal>

			{/* UUID Delete Modal */}
			<Modal
				isOpen={uuidDeleteState.isOpen}
				onClose={() => setUuidDeleteState({ ...uuidDeleteState, isOpen: false })}
				title="Confirm Deletion"
			>
				<div className="space-y-4">
					<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
						<p className="text-sm text-red-800 dark:text-red-200">
							<strong>Warning:</strong> You are about to delete{' '}
							{uuidDeleteState.count} test run
							{uuidDeleteState.count !== 1 ? 's' : ''}. This action cannot be
							undone.
						</p>
						<p className="text-xs text-red-600 dark:text-red-400 mt-1 font-mono">
							UUID: {uuidDeleteState.uuid}
						</p>
					</div>

					<div className="flex gap-2">
						<Button variant="danger" onClick={handleUUIDDelete} className="flex-1">
							Delete {uuidDeleteState.count} Test Runs
						</Button>
						<Button
							variant="outline"
							onClick={() =>
								setUuidDeleteState({ ...uuidDeleteState, isOpen: false })
							}
						>
							Cancel
						</Button>
					</div>
				</div>
			</Modal>

			{/* Data Cleanup Modal */}
			<Modal
				isOpen={dataCleanupState.isOpen}
				onClose={() => setDataCleanupState({ ...dataCleanupState, isOpen: false })}
				title={dataCleanupState.mode === 'delete-old' ? 'Delete Old Historical Data' : 'Compact Historical Data'}
			>
				<div className="space-y-4">
					{dataCleanupState.mode === 'delete-old' ? (
						<div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
							<p className="text-sm text-yellow-800 dark:text-yellow-200">
								<strong>Warning:</strong> This will permanently delete all test runs older than the specified date.
							</p>
						</div>
					) : (
						<div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
							<p className="text-sm text-blue-800 dark:text-blue-200">
								<strong>Compact Mode:</strong> This will keep only {dataCleanupState.compactFrequency} samples before the cutoff date,
								removing hourly tests while preserving representative data.
							</p>
						</div>
					)}

					<div>
						<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
							<Calendar className="w-4 h-4 inline mr-1" />
							Cutoff Date (keep data after this date)
						</label>
						<input
							type="date"
							value={dataCleanupState.cutoffDate}
							onChange={(e) => setDataCleanupState({
								...dataCleanupState,
								cutoffDate: e.target.value,
								previewCount: null,
							})}
							className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
						/>
						<p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
							Data before {new Date(dataCleanupState.cutoffDate).toLocaleDateString()} will be {dataCleanupState.mode === 'delete-old' ? 'deleted' : 'compacted'}
						</p>
					</div>

					{dataCleanupState.mode === 'compact' && (
						<div>
							<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
								Keep Frequency (for data before cutoff date)
							</label>
							<select
								value={dataCleanupState.compactFrequency}
								onChange={(e) => setDataCleanupState({
									...dataCleanupState,
									compactFrequency: e.target.value as 'daily' | 'weekly' | 'monthly',
									previewCount: null,
								})}
								className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
							>
								<option value="daily">Daily (one test per day)</option>
								<option value="weekly">Weekly (one test per week)</option>
								<option value="monthly">Monthly (one test per month)</option>
							</select>
							<p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
								Only the most recent test per {dataCleanupState.compactFrequency === 'daily' ? 'day' : dataCleanupState.compactFrequency === 'weekly' ? 'week' : 'month'} will be kept
							</p>
						</div>
					)}

					<div className="flex gap-2 pt-2">
						<Button
							variant="outline"
							onClick={previewDataCleanup}
							disabled={dataCleanupState.isLoading}
							className="flex-1"
						>
							{dataCleanupState.isLoading ? 'Calculating...' : 'Preview Changes'}
						</Button>
					</div>

					{dataCleanupState.previewCount !== null && (
						<div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
							<p className="text-sm text-gray-800 dark:text-gray-200">
								<strong>Preview:</strong> This operation will affect <strong>{dataCleanupState.previewCount}</strong> test run{dataCleanupState.previewCount !== 1 ? 's' : ''}.
							</p>
						</div>
					)}

					<div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
						<Button
							variant="danger"
							onClick={executeDataCleanup}
							disabled={dataCleanupState.isLoading || dataCleanupState.previewCount === null}
							className="flex-1"
						>
							{dataCleanupState.isLoading ? 'Processing...' : `Execute ${dataCleanupState.mode === 'delete-old' ? 'Deletion' : 'Compaction'}`}
						</Button>
						<Button
							variant="outline"
							onClick={() => setDataCleanupState({ ...dataCleanupState, isOpen: false })}
							disabled={dataCleanupState.isLoading}
						>
							Cancel
						</Button>
					</div>
				</div>
			</Modal>

			{/* Test Run Details Modal */}
			<Modal
				isOpen={testRunDetailsState.isOpen}
				onClose={() => setTestRunDetailsState({ isOpen: false, testRun: null, isLoading: false })}
				title="Test Run Details"
			>
				{testRunDetailsState.isLoading ? (
					<Loading message="Loading test details..." />
				) : testRunDetailsState.testRun ? (
					<div className="space-y-4">
						{/* Basic Info */}
						<div>
							<h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 border-b border-gray-200 dark:border-gray-700 pb-2">Test Information</h3>
							<div className="space-y-2 text-sm">
								<div className="flex justify-between">
									<span className="text-gray-500 dark:text-gray-400">Test Run ID:</span>
									<span className="font-semibold text-gray-900 dark:text-gray-100">#{testRunDetailsState.testRun.id}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-gray-500 dark:text-gray-400">Test Name:</span>
									<span className="font-semibold text-gray-900 dark:text-gray-100 text-right">{testRunDetailsState.testRun.test_name || 'N/A'}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-gray-500 dark:text-gray-400">Timestamp:</span>
									<span className="font-semibold text-gray-900 dark:text-gray-100">
										{new Date(testRunDetailsState.testRun.timestamp).toLocaleString()}
									</span>
								</div>
								<div className="flex justify-between">
									<span className="text-gray-500 dark:text-gray-400">Hostname:</span>
									<span className="font-semibold text-gray-900 dark:text-gray-100">{testRunDetailsState.testRun.hostname}</span>
								</div>
							</div>
						</div>

						{/* Storage Configuration */}
						<div>
							<h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 border-b border-gray-200 dark:border-gray-700 pb-2">Storage Configuration</h3>
							<div className="space-y-2 text-sm">
								<div className="flex justify-between">
									<span className="text-gray-500 dark:text-gray-400">Protocol:</span>
									<span className="font-semibold text-gray-900 dark:text-gray-100">{testRunDetailsState.testRun.protocol}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-gray-500 dark:text-gray-400">Drive Type:</span>
									<span className="font-semibold text-gray-900 dark:text-gray-100">{testRunDetailsState.testRun.drive_type}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-gray-500 dark:text-gray-400">Drive Model:</span>
									<span className="font-semibold text-gray-900 dark:text-gray-100">{testRunDetailsState.testRun.drive_model}</span>
								</div>
							</div>
						</div>

						{/* Test Parameters */}
						<div>
							<h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 border-b border-gray-200 dark:border-gray-700 pb-2">Test Parameters</h3>
							<div className="space-y-2 text-sm">
								<div className="flex justify-between">
									<span className="text-gray-500 dark:text-gray-400">I/O Pattern:</span>
									<span className="font-semibold text-gray-900 dark:text-gray-100">{testRunDetailsState.testRun.read_write_pattern}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-gray-500 dark:text-gray-400">Block Size:</span>
									<span className="font-semibold text-gray-900 dark:text-gray-100">{testRunDetailsState.testRun.block_size}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-gray-500 dark:text-gray-400">Queue Depth (iodepth):</span>
									<span className="font-semibold text-gray-900 dark:text-gray-100">{testRunDetailsState.testRun.queue_depth}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-gray-500 dark:text-gray-400">Number of Jobs:</span>
									<span className="font-semibold text-gray-900 dark:text-gray-100">{testRunDetailsState.testRun.num_jobs || 1}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-gray-500 dark:text-gray-400">Test Size:</span>
									<span className="font-semibold text-gray-900 dark:text-gray-100">{testRunDetailsState.testRun.test_size || 'N/A'}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-gray-500 dark:text-gray-400">Duration:</span>
									<span className="font-semibold text-gray-900 dark:text-gray-100">{testRunDetailsState.testRun.duration ? `${testRunDetailsState.testRun.duration}s` : 'N/A'}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-gray-500 dark:text-gray-400">Direct I/O:</span>
									<span className="font-semibold text-gray-900 dark:text-gray-100">{testRunDetailsState.testRun.direct ? 'Yes' : 'No'}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-gray-500 dark:text-gray-400">Sync:</span>
									<span className="font-semibold text-gray-900 dark:text-gray-100">{testRunDetailsState.testRun.sync ? 'Yes' : 'No'}</span>
								</div>
								{testRunDetailsState.testRun.rwmixread !== undefined && testRunDetailsState.testRun.rwmixread !== null && (
									<div className="flex justify-between">
										<span className="text-gray-500 dark:text-gray-400">Read/Write Mix (Read %):</span>
										<span className="font-semibold text-gray-900 dark:text-gray-100">{testRunDetailsState.testRun.rwmixread}%</span>
									</div>
								)}
								{testRunDetailsState.testRun.fio_version && (
									<div className="flex justify-between">
										<span className="text-gray-500 dark:text-gray-400">FIO Version:</span>
										<span className="font-semibold text-gray-900 dark:text-gray-100">{testRunDetailsState.testRun.fio_version}</span>
									</div>
								)}
								{testRunDetailsState.testRun.job_runtime !== undefined && testRunDetailsState.testRun.job_runtime !== null && (
									<div className="flex justify-between">
										<span className="text-gray-500 dark:text-gray-400">Job Runtime:</span>
										<span className="font-semibold text-gray-900 dark:text-gray-100">{testRunDetailsState.testRun.job_runtime}s</span>
									</div>
								)}
							</div>
						</div>

						{/* Performance Metrics */}
						<div>
							<h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 border-b border-gray-200 dark:border-gray-700 pb-2">Performance Metrics</h3>
							<div className="space-y-3">
								{/* Primary Metrics */}
								<div className="grid grid-cols-2 gap-3">
									<div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg">
										<div className="text-xs text-gray-500 dark:text-gray-400 mb-1">IOPS</div>
										<div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
											{testRunDetailsState.testRun.iops ? Math.round(testRunDetailsState.testRun.iops).toLocaleString() : 'N/A'}
										</div>
									</div>
									<div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
										<div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Bandwidth</div>
										<div className="text-2xl font-bold text-green-600 dark:text-green-400">
											{testRunDetailsState.testRun.bandwidth ? `${testRunDetailsState.testRun.bandwidth.toFixed(2)} MB/s` : 'N/A'}
										</div>
									</div>
								</div>

								{/* Latency Metrics */}
								<div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg space-y-2 text-sm">
									<div className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Latency Metrics</div>
									<div className="flex justify-between">
										<span className="text-gray-500 dark:text-gray-400">Average Latency:</span>
										<span className="font-semibold text-gray-900 dark:text-gray-100">
											{testRunDetailsState.testRun.avg_latency ? `${testRunDetailsState.testRun.avg_latency.toFixed(3)} ms` : 'N/A'}
										</span>
									</div>
									{testRunDetailsState.testRun.p70_latency !== undefined && testRunDetailsState.testRun.p70_latency !== null && (
										<div className="flex justify-between">
											<span className="text-gray-500 dark:text-gray-400">P70 Latency:</span>
											<span className="font-semibold text-gray-900 dark:text-gray-100">
												{testRunDetailsState.testRun.p70_latency.toFixed(3)} ms
											</span>
										</div>
									)}
									{testRunDetailsState.testRun.p90_latency !== undefined && testRunDetailsState.testRun.p90_latency !== null && (
										<div className="flex justify-between">
											<span className="text-gray-500 dark:text-gray-400">P90 Latency:</span>
											<span className="font-semibold text-gray-900 dark:text-gray-100">
												{testRunDetailsState.testRun.p90_latency.toFixed(3)} ms
											</span>
										</div>
									)}
									<div className="flex justify-between">
										<span className="text-gray-500 dark:text-gray-400">P95 Latency:</span>
										<span className="font-semibold text-gray-900 dark:text-gray-100">
											{testRunDetailsState.testRun.p95_latency ? `${testRunDetailsState.testRun.p95_latency.toFixed(3)} ms` : 'N/A'}
										</span>
									</div>
									<div className="flex justify-between">
										<span className="text-gray-500 dark:text-gray-400">P99 Latency:</span>
										<span className="font-semibold text-gray-900 dark:text-gray-100">
											{testRunDetailsState.testRun.p99_latency ? `${testRunDetailsState.testRun.p99_latency.toFixed(3)} ms` : 'N/A'}
										</span>
									</div>
								</div>

								{/* I/O Statistics */}
								{(testRunDetailsState.testRun.total_ios_read || testRunDetailsState.testRun.total_ios_write) && (
									<div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg space-y-2 text-sm">
										<div className="font-semibold text-gray-900 dark:text-gray-100 mb-2">I/O Statistics</div>
										{testRunDetailsState.testRun.total_ios_read !== undefined && testRunDetailsState.testRun.total_ios_read !== null && (
											<div className="flex justify-between">
												<span className="text-gray-500 dark:text-gray-400">Total Read I/Os:</span>
												<span className="font-semibold text-gray-900 dark:text-gray-100">
													{testRunDetailsState.testRun.total_ios_read.toLocaleString()}
												</span>
											</div>
										)}
										{testRunDetailsState.testRun.total_ios_write !== undefined && testRunDetailsState.testRun.total_ios_write !== null && (
											<div className="flex justify-between">
												<span className="text-gray-500 dark:text-gray-400">Total Write I/Os:</span>
												<span className="font-semibold text-gray-900 dark:text-gray-100">
													{testRunDetailsState.testRun.total_ios_write.toLocaleString()}
												</span>
											</div>
										)}
									</div>
								)}

								{/* CPU Usage */}
								{(testRunDetailsState.testRun.usr_cpu || testRunDetailsState.testRun.sys_cpu) && (
									<div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg space-y-2 text-sm">
										<div className="font-semibold text-gray-900 dark:text-gray-100 mb-2">CPU Usage</div>
										{testRunDetailsState.testRun.usr_cpu !== undefined && testRunDetailsState.testRun.usr_cpu !== null && (
											<div className="flex justify-between">
												<span className="text-gray-500 dark:text-gray-400">User CPU:</span>
												<span className="font-semibold text-gray-900 dark:text-gray-100">
													{testRunDetailsState.testRun.usr_cpu.toFixed(2)}%
												</span>
											</div>
										)}
										{testRunDetailsState.testRun.sys_cpu !== undefined && testRunDetailsState.testRun.sys_cpu !== null && (
											<div className="flex justify-between">
												<span className="text-gray-500 dark:text-gray-400">System CPU:</span>
												<span className="font-semibold text-gray-900 dark:text-gray-100">
													{testRunDetailsState.testRun.sys_cpu.toFixed(2)}%
												</span>
											</div>
										)}
									</div>
								)}
							</div>
						</div>

						{/* UUIDs */}
						<div>
							<h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 border-b border-gray-200 dark:border-gray-700 pb-2">UUIDs</h3>
							<div className="space-y-2 text-sm">
								<div>
									<div className="text-gray-500 dark:text-gray-400 mb-1">Config UUID:</div>
									<div className="font-mono text-xs text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-700 p-2 rounded">
										{testRunDetailsState.testRun.config_uuid || 'N/A'}
									</div>
								</div>
								<div>
									<div className="text-gray-500 dark:text-gray-400 mb-1">Run UUID:</div>
									<div className="font-mono text-xs text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-700 p-2 rounded">
										{testRunDetailsState.testRun.run_uuid || 'N/A'}
									</div>
								</div>
							</div>
						</div>

						{/* Description */}
						{testRunDetailsState.testRun.description && (
							<div>
								<h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 border-b border-gray-200 dark:border-gray-700 pb-2">Description</h3>
								<div className="text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 p-3 rounded-lg whitespace-pre-wrap">
									{testRunDetailsState.testRun.description}
								</div>
							</div>
						)}

						<div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
							<Button
								variant="outline"
								onClick={() => setTestRunDetailsState({ isOpen: false, testRun: null, isLoading: false })}
								className="flex-1"
							>
								Close
							</Button>
						</div>
					</div>
				) : (
					<div className="text-center py-12 text-gray-500 dark:text-gray-400">
						No test run data available
					</div>
				)}
			</Modal>
		</div>
	);
};

export default Admin;
