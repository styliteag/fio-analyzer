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
} from '../services/api/testRuns';
import { fetchTimeSeriesHistory } from '../services/api/timeSeries';
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

	// Toggle group expansion
	const toggleGroup = useCallback((uuid: string) => {
		setExpandedGroups((prev) => {
			const next = new Set(prev);
			if (next.has(uuid)) {
				next.delete(uuid);
			} else {
				next.add(uuid);
			}
			return next;
		});
	}, []);

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

	// Render UUID Group Card
	const renderUUIDGroup = (group: UUIDGroup, uuidType: 'config_uuid' | 'run_uuid') => {
		const isExpanded = expandedGroups.has(group.uuid);

		return (
			<div key={group.uuid} className="border border-gray-200 rounded-lg mb-4 bg-white">
				{/* Group Header */}
				<div className="p-4 bg-gray-50 border-b border-gray-200">
					<div className="flex items-start justify-between">
						<div className="flex-1">
							<div className="flex items-center gap-3 mb-3">
								<div className="flex items-center gap-2">
									<span className="text-gray-500 text-sm">Host:</span>
									<h3 className="text-lg font-semibold text-gray-900">
										{group.sample_metadata.hostname || 'N/A'}
									</h3>
								</div>
								<div className="flex items-center gap-2">
									<span className="text-gray-500 text-sm">
										{uuidType === 'config_uuid' ? 'Config UUID:' : 'Run UUID:'}
									</span>
									<span className="font-mono text-sm text-gray-600">{group.uuid}</span>
									<button
										onClick={() => copyUUID(group.uuid)}
										className="p-1 hover:bg-gray-200 rounded transition-colors"
										title="Copy UUID"
									>
										{copiedUUID === group.uuid ? (
											<Check className="w-4 h-4 text-green-600" />
										) : (
											<Copy className="w-4 h-4 text-gray-500" />
										)}
									</button>
								</div>
							</div>

							<div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
								<div>
									<span className="text-gray-500">Tests:</span>
									<span className="ml-2 font-semibold">{group.count}</span>
								</div>
								<div>
									<span className="text-gray-500">Avg IOPS:</span>
									<span className="ml-2 font-semibold">
										{group.avg_iops
											? Math.round(group.avg_iops).toLocaleString()
											: 'N/A'}
									</span>
								</div>
								<div>
									<span className="text-gray-500">Date Range:</span>
									<span className="ml-2 font-semibold">
										{formatDateRange(group.first_test, group.last_test)}
									</span>
								</div>
							</div>

							<div className="mt-2 text-sm text-gray-600">
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
								onClick={() => toggleGroup(group.uuid)}
								className="p-2 hover:bg-gray-200 rounded transition-colors"
							>
								{isExpanded ? (
									<ChevronUp className="w-5 h-5" />
								) : (
									<ChevronDown className="w-5 h-5" />
								)}
							</button>
						</div>
					</div>
				</div>

				{/* Expanded Test List */}
				{isExpanded && (
					<div className="p-4">
						<div className="text-sm text-gray-600 mb-2">
							{group.count} test run{group.count !== 1 ? 's' : ''} in this group:
						</div>
						<div className="bg-gray-50 rounded p-2 max-h-96 overflow-y-auto">
							<div className="space-y-1">
								{group.test_run_ids.map((id) => (
									<div
										key={id}
										className="text-sm text-gray-700 font-mono px-2 py-1 hover:bg-gray-100 rounded"
									>
										Test Run ID: {id}
									</div>
								))}
							</div>
						</div>
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
						<h2 className="text-2xl font-bold">{title}</h2>
					</div>
					<div className="text-sm text-gray-600">
						{groupsData.length} {searchTerm && `/ ${totalGroups}`} group{groupsData.length !== 1 ? 's' : ''}
					</div>
				</div>

				{groupsData.length === 0 ? (
					<div className="text-center py-12 text-gray-500">
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
		<div className="min-h-screen bg-gray-50">
			{/* Header */}
			<div className="bg-white border-b border-gray-200 sticky top-0 z-10">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex items-center justify-between h-16">
						<div className="flex items-center gap-4">
							<button
								onClick={() => navigate('/')}
								className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
							>
								<ArrowLeft className="w-5 h-5" />
								<span className="font-medium">Back to Dashboard</span>
							</button>
							<div className="h-6 w-px bg-gray-300"></div>
							<div className="flex items-center gap-2">
								<Settings className="w-6 h-6 text-indigo-600" />
								<h1 className="text-2xl font-bold text-gray-900">
									Admin Panel
								</h1>
							</div>
						</div>
					</div>

					{/* Search Bar */}
					<div className="mt-4 mb-2">
						<div className="relative max-w-md">
							<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
							<input
								type="text"
								placeholder="Search by hostname, protocol, drive, name, description, UUID..."
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
							/>
							{searchTerm && (
								<button
									onClick={() => setSearchTerm('')}
									className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
									? 'border-indigo-600 text-indigo-600'
									: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
							}`}
						>
							<Server className="w-4 h-4" />
							By Host Config
						</button>
						<button
							onClick={() => setActiveTab('by-run')}
							className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${
								activeTab === 'by-run'
									? 'border-indigo-600 text-indigo-600'
									: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
							}`}
						>
							<PlayCircle className="w-4 h-4" />
							By Script Run
						</button>
						<button
							onClick={() => setActiveTab('latest')}
							className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${
								activeTab === 'latest'
									? 'border-indigo-600 text-indigo-600'
									: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
							}`}
						>
							<Database className="w-4 h-4" />
							Latest Runs
						</button>
						<button
							onClick={() => setActiveTab('history')}
							className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${
								activeTab === 'history'
									? 'border-indigo-600 text-indigo-600'
									: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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
						<Server className="w-6 h-6 text-indigo-600" />
					)}

				{activeTab === 'by-run' &&
					renderUUIDGroupsTab(
						runGroups,
						filteredRunGroups,
						'run_uuid',
						'By Script Run',
						<PlayCircle className="w-6 h-6 text-indigo-600" />
					)}

				{activeTab === 'latest' && (
					<div>
						<div className="mb-6 flex items-center justify-between">
							<div className="flex items-center gap-2">
								<Database className="w-6 h-6 text-indigo-600" />
								<h2 className="text-2xl font-bold">Latest Test Runs (Grouped by Run)</h2>
							</div>
							<div className="text-sm text-gray-600">
								{groupedLatestRuns.length} {searchTerm && `/ ${new Set(latestRuns.map(r => r.run_uuid)).size}`} run{groupedLatestRuns.length !== 1 ? 's' : ''}
							</div>
						</div>

						{latestLoading ? (
							<Loading message="Loading latest runs..." />
						) : latestError ? (
							<ErrorDisplay error={latestError} />
						) : groupedLatestRuns.length === 0 ? (
							<div className="text-center py-12 text-gray-500">
								{searchTerm ? `No test runs found matching "${searchTerm}"` : 'No test runs found'}
							</div>
						) : (
							<div>
								{groupedLatestRuns.map((group) => {
									const isExpanded = expandedGroups.has(group.uuid);
									return (
										<div key={group.uuid} className="border border-gray-200 rounded-lg mb-4 bg-white">
											{/* Group Header */}
											<div className="p-4 bg-gray-50 border-b border-gray-200">
												<div className="flex items-start justify-between">
													<div className="flex-1">
														<div className="flex items-center gap-3 mb-3">
															<div className="flex items-center gap-2">
																<span className="text-gray-500 text-sm">Host:</span>
																<h3 className="text-lg font-semibold text-gray-900">
																	{group.hostname}
																</h3>
															</div>
															{group.uuid !== 'no-uuid' && (
																<div className="flex items-center gap-2">
																	<span className="text-gray-500 text-sm">Run UUID:</span>
																	<span className="font-mono text-sm text-gray-600">{group.uuid}</span>
																	<button
																		onClick={() => copyUUID(group.uuid)}
																		className="p-1 hover:bg-gray-200 rounded transition-colors"
																		title="Copy UUID"
																	>
																		{copiedUUID === group.uuid ? (
																			<Check className="w-4 h-4 text-green-600" />
																		) : (
																			<Copy className="w-4 h-4 text-gray-500" />
																		)}
																	</button>
																</div>
															)}
														</div>

														<div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
															<div>
																<span className="text-gray-500">Tests:</span>
																<span className="ml-2 font-semibold">{group.count}</span>
															</div>
															<div>
																<span className="text-gray-500">Avg IOPS:</span>
																<span className="ml-2 font-semibold">
																	{Math.round(group.avgIops).toLocaleString()}
																</span>
															</div>
															<div>
																<span className="text-gray-500">Latest:</span>
																<span className="ml-2 font-semibold">
																	{new Date(group.latestTimestamp).toLocaleDateString()}
																</span>
															</div>
														</div>
													</div>

													<button
														onClick={() => toggleGroup(group.uuid)}
														className="p-2 hover:bg-gray-200 rounded transition-colors ml-4"
													>
														{isExpanded ? (
															<ChevronUp className="w-5 h-5" />
														) : (
															<ChevronDown className="w-5 h-5" />
														)}
													</button>
												</div>
											</div>

											{/* Expanded Test Table */}
											{isExpanded && (
												<div className="overflow-x-auto">
													<table className="min-w-full divide-y divide-gray-200">
														<thead className="bg-gray-100">
															<tr>
																<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
																<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
																<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Protocol</th>
																<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Drive</th>
																<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pattern</th>
																<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Block Size</th>
																<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IOPS</th>
																<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Config UUID</th>
															</tr>
														</thead>
														<tbody className="bg-white divide-y divide-gray-200">
															{group.runs.map((run) => (
																<tr key={run.id} className="hover:bg-gray-50">
																	<td className="px-4 py-3 text-sm text-gray-900">{run.id}</td>
																	<td className="px-4 py-3 text-sm text-gray-500">
																		{new Date(run.timestamp).toLocaleDateString()}
																	</td>
																	<td className="px-4 py-3 text-sm text-gray-600">{run.protocol}</td>
																	<td className="px-4 py-3 text-sm text-gray-600">
																		{run.drive_type}
																		<br />
																		<span className="text-xs text-gray-500">{run.drive_model}</span>
																	</td>
																	<td className="px-4 py-3 text-sm text-gray-600">{run.read_write_pattern}</td>
																	<td className="px-4 py-3 text-sm text-gray-600">{run.block_size}</td>
																	<td className="px-4 py-3 text-sm font-semibold text-gray-900">
																		{run.iops ? Math.round(run.iops).toLocaleString() : 'N/A'}
																	</td>
																	<td className="px-4 py-3 text-xs text-gray-500">
																		{run.config_uuid && (
																			<div title={run.config_uuid}>
																				{run.config_uuid.slice(0, 8)}...
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
						<h2 className="text-2xl font-bold mb-4">Historical Test Runs</h2>
						<p className="text-gray-600 mb-6">
							Showing {filteredHistoryData.length} {searchTerm && `/ ${timeSeriesData.length}`} historical test run{filteredHistoryData.length !== 1 ? 's' : ''}
						</p>
						{timeSeriesLoading ? (
							<Loading message="Loading history..." />
						) : filteredHistoryData.length === 0 ? (
							<div className="text-center py-12 text-gray-500">
								{searchTerm ? `No historical test runs found matching "${searchTerm}"` : 'No historical test runs found'}
							</div>
						) : (
							<div className="bg-white rounded-lg shadow overflow-hidden">
								<div className="overflow-x-auto">
									<table className="min-w-full divide-y divide-gray-200">
										<thead className="bg-gray-50">
											<tr>
												<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
												<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
												<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hostname</th>
												<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Protocol</th>
												<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Drive</th>
												<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pattern</th>
												<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Block Size</th>
												<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IOPS</th>
												<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">UUIDs</th>
											</tr>
										</thead>
										<tbody className="bg-white divide-y divide-gray-200">
											{filteredHistoryData.map((run: any) => (
												<tr key={run.test_run_id || run.id} className="hover:bg-gray-50">
													<td className="px-4 py-3 text-sm text-gray-900">{run.test_run_id || run.id}</td>
													<td className="px-4 py-3 text-sm text-gray-500">
														{new Date(run.timestamp || run.test_date).toLocaleDateString()}
													</td>
													<td className="px-4 py-3 text-sm text-gray-900">{run.hostname}</td>
													<td className="px-4 py-3 text-sm text-gray-600">{run.protocol}</td>
													<td className="px-4 py-3 text-sm text-gray-600">
														{run.drive_type && (
															<>
																{run.drive_type}
																<br />
															</>
														)}
														<span className="text-xs text-gray-500">{run.drive_model}</span>
													</td>
													<td className="px-4 py-3 text-sm text-gray-600">{run.read_write_pattern}</td>
													<td className="px-4 py-3 text-sm text-gray-600">{run.block_size}</td>
													<td className="px-4 py-3 text-sm font-semibold text-gray-900">
														{run.iops ? Math.round(run.iops).toLocaleString() : 'N/A'}
													</td>
													<td className="px-4 py-3 text-xs text-gray-500">
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
					<div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
						<p className="text-sm text-blue-800">
							<strong>Warning:</strong> This will update {uuidEditState.count} test
							run{uuidEditState.count !== 1 ? 's' : ''} with the same values.
						</p>
						<p className="text-xs text-blue-600 mt-1 font-mono">
							UUID: {uuidEditState.uuid}
						</p>
					</div>

					{/* Field toggles and inputs */}
					{(
						['hostname', 'protocol', 'drive_type', 'drive_model', 'test_name', 'description'] as Array<
							keyof EditableFields
						>
					).map((field) => (
						<div key={field} className="border border-gray-200 rounded-lg p-3">
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
								<span className="font-medium text-sm capitalize">
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
								className="w-full px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-100 disabled:text-gray-400"
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
					<div className="bg-red-50 border border-red-200 rounded-lg p-4">
						<p className="text-sm text-red-800">
							<strong>Warning:</strong> You are about to delete{' '}
							{uuidDeleteState.count} test run
							{uuidDeleteState.count !== 1 ? 's' : ''}. This action cannot be
							undone.
						</p>
						<p className="text-xs text-red-600 mt-1 font-mono">
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
		</div>
	);
};

export default Admin;
