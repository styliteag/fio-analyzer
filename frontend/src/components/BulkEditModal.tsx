import { AlertCircle, Edit, Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { TestRun } from "../types";
import { updateTestRun } from "../utils/api";

interface BulkEditModalProps {
	testRuns: TestRun[];
	isOpen: boolean;
	onClose: () => void;
	onSave: (updatedRuns: TestRun[]) => void;
}

export default function BulkEditModal({
	testRuns,
	isOpen,
	onClose,
	onSave,
}: BulkEditModalProps) {
	const [driveModel, setDriveModel] = useState("");
	const [driveType, setDriveType] = useState("");
	const [customDriveType, setCustomDriveType] = useState("");
	const [showCustomType, setShowCustomType] = useState(false);
	const [hostname, setHostname] = useState("");
	const [protocol, setProtocol] = useState("");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [progress, setProgress] = useState({ current: 0, total: 0 });

	// Field update flags
	const [updateDriveModel, setUpdateDriveModel] = useState(false);
	const [updateDriveType, setUpdateDriveType] = useState(false);
	const [updateHostname, setUpdateHostname] = useState(false);
	const [updateProtocol, setUpdateProtocol] = useState(false);

	useEffect(() => {
		if (testRuns.length > 0) {
			// Reset form
			setDriveModel("");
			setDriveType("");
			setCustomDriveType("");
			setShowCustomType(false);
			setHostname("");
			setProtocol("");
			setUpdateDriveModel(false);
			setUpdateDriveType(false);
			setUpdateHostname(false);
			setUpdateProtocol(false);
			setError(null);
			setProgress({ current: 0, total: 0 });
		}
	}, [testRuns]);

	const handleSave = async () => {
		if (!testRuns.length) return;

		// Check if at least one field is selected for update
		if (
			!updateDriveModel &&
			!updateDriveType &&
			!updateHostname &&
			!updateProtocol
		) {
			setError("Please select at least one field to update");
			return;
		}

		setSaving(true);
		setError(null);
		setProgress({ current: 0, total: testRuns.length });

		const finalDriveType = showCustomType ? customDriveType : driveType;
		const updatedRuns: TestRun[] = [];
		let failed = 0;

		try {
			for (let i = 0; i < testRuns.length; i++) {
				const testRun = testRuns[i];
				setProgress({ current: i + 1, total: testRuns.length });

				try {
					const updateData: any = {};

					if (updateDriveModel && driveModel.trim()) {
						updateData.drive_model = driveModel.trim();
					}
					if (updateDriveType && finalDriveType.trim()) {
						updateData.drive_type = finalDriveType.trim();
					}
					if (updateHostname && hostname.trim()) {
						updateData.hostname = hostname.trim();
					}
					if (updateProtocol && protocol.trim()) {
						updateData.protocol = protocol.trim();
					}

					// Only update if we have data to send
					if (Object.keys(updateData).length > 0) {
						await updateTestRun(testRun.id, updateData);

						const updatedTestRun = { ...testRun, ...updateData };
						updatedRuns.push(updatedTestRun);
					} else {
						updatedRuns.push(testRun);
					}
				} catch (err) {
					console.error(`Failed to update test run ${testRun.id}:`, err);
					failed++;
					updatedRuns.push(testRun); // Keep original if update failed
				}
			}

			if (failed > 0) {
				setError(
					`Updated ${testRuns.length - failed} of ${testRuns.length} test runs. ${failed} failed.`,
				);
			}

			onSave(updatedRuns);

			if (failed === 0) {
				onClose();
			}
		} catch {
			setError("Bulk update failed");
		} finally {
			setSaving(false);
			setProgress({ current: 0, total: 0 });
		}
	};

	const handleClose = () => {
		if (!saving) {
			onClose();
			setError(null);
		}
	};

	const handleDriveTypeChange = (value: string) => {
		if (value === "custom") {
			setShowCustomType(true);
			setDriveType("");
		} else {
			setShowCustomType(false);
			setDriveType(value);
			setCustomDriveType("");
		}
	};

	if (!isOpen || !testRuns.length) return null;

	return (
		<div className="fixed inset-0 theme-overlay flex items-center justify-center p-4 z-50">
			<div className="theme-modal rounded-lg shadow-xl max-w-lg w-full border">
				{/* Header */}
				<div className="flex items-center justify-between p-6 border-b theme-border-primary">
					<h3 className="text-lg font-medium theme-text-primary flex items-center">
						<Edit className="h-5 w-5 mr-2" />
						Bulk Edit {testRuns.length} Test Runs
					</h3>
					<button
						onClick={handleClose}
						disabled={saving}
						className="theme-text-tertiary hover:theme-text-secondary disabled:opacity-50 transition-colors"
					>
						<X className="h-6 w-6" />
					</button>
				</div>

				{/* Content */}
				<div className="p-6 space-y-4">
					{/* Selected Runs Preview */}
					<div className="theme-bg-secondary rounded-lg p-4 text-sm border theme-border-secondary">
						<div className="font-medium theme-text-primary mb-2">
							Selected Test Runs:
						</div>
						<div className="max-h-32 overflow-y-auto space-y-1">
							{testRuns.slice(0, 5).map((run) => (
								<div key={run.id} className="theme-text-secondary text-xs">
									{run.drive_model} - {run.test_name}
								</div>
							))}
							{testRuns.length > 5 && (
								<div className="theme-text-tertiary text-xs">
									... and {testRuns.length - 5} more
								</div>
							)}
						</div>
					</div>

					{/* Drive Model */}
					<div className="theme-form-group">
						<div className="flex items-center mb-2">
							<input
								type="checkbox"
								id="update-drive-model"
								checked={updateDriveModel}
								onChange={(e) => setUpdateDriveModel(e.target.checked)}
								className="mr-2"
								disabled={saving}
							/>
							<label
								htmlFor="update-drive-model"
								className="theme-form-label mb-0"
							>
								Update Drive Model
							</label>
						</div>
						<input
							type="text"
							value={driveModel}
							onChange={(e) => setDriveModel(e.target.value)}
							placeholder="e.g., Samsung 980 PRO"
							className="theme-form-input"
							disabled={saving || !updateDriveModel}
						/>
					</div>

					{/* Drive Type */}
					<div className="theme-form-group">
						<div className="flex items-center mb-2">
							<input
								type="checkbox"
								id="update-drive-type"
								checked={updateDriveType}
								onChange={(e) => setUpdateDriveType(e.target.checked)}
								className="mr-2"
								disabled={saving}
							/>
							<label
								htmlFor="update-drive-type"
								className="theme-form-label mb-0"
							>
								Update Drive Type
							</label>
						</div>
						{!showCustomType ? (
							<select
								value={driveType}
								onChange={(e) => handleDriveTypeChange(e.target.value)}
								className="theme-form-select"
								disabled={saving || !updateDriveType}
							>
								<option value="">Select type</option>
								<option value="NVMe SSD">NVMe SSD</option>
								<option value="SATA SSD">SATA SSD</option>
								<option value="HDD">HDD</option>
								<option value="Optane">Optane</option>
								<option value="eUFS">eUFS</option>
								<option value="eMMC">eMMC</option>
								<option value="SD Card">SD Card</option>
								<option value="custom">+ Add Custom Type</option>
							</select>
						) : (
							<div className="flex gap-2">
								<input
									type="text"
									value={customDriveType}
									onChange={(e) => setCustomDriveType(e.target.value)}
									placeholder="Enter custom drive type"
									className="theme-form-input"
									disabled={saving || !updateDriveType}
								/>
								<button
									type="button"
									onClick={() => {
										setShowCustomType(false);
										setCustomDriveType("");
										setDriveType("");
									}}
									className="px-3 py-2 text-sm theme-btn-secondary rounded-md transition-colors"
									disabled={saving || !updateDriveType}
								>
									Cancel
								</button>
							</div>
						)}
					</div>

					{/* Hostname */}
					<div className="theme-form-group">
						<div className="flex items-center mb-2">
							<input
								type="checkbox"
								id="update-hostname"
								checked={updateHostname}
								onChange={(e) => setUpdateHostname(e.target.checked)}
								className="mr-2"
								disabled={saving}
							/>
							<label
								htmlFor="update-hostname"
								className="theme-form-label mb-0"
							>
								📡 Update Hostname
							</label>
						</div>
						<input
							type="text"
							value={hostname}
							onChange={(e) => setHostname(e.target.value)}
							placeholder="e.g., web-server-01"
							className="theme-form-input"
							disabled={saving || !updateHostname}
						/>
					</div>

					{/* Protocol */}
					<div className="theme-form-group">
						<div className="flex items-center mb-2">
							<input
								type="checkbox"
								id="update-protocol"
								checked={updateProtocol}
								onChange={(e) => setUpdateProtocol(e.target.checked)}
								className="mr-2"
								disabled={saving}
							/>
							<label
								htmlFor="update-protocol"
								className="theme-form-label mb-0"
							>
								🔗 Update Protocol
							</label>
						</div>
						<select
							value={protocol}
							onChange={(e) => setProtocol(e.target.value)}
							className="theme-form-select"
							disabled={saving || !updateProtocol}
						>
							<option value="">Select protocol</option>
							<option value="NFS">NFS</option>
							<option value="SMB">SMB</option>
							<option value="iSCSI">iSCSI</option>
							<option value="FC">Fibre Channel</option>
							<option value="SAS">SAS</option>
							<option value="SATA">SATA</option>
							<option value="NVMe">NVMe</option>
							<option value="USB">USB</option>
							<option value="Thunderbolt">Thunderbolt</option>
							<option value="Local">Local</option>
							<option value="Unknown">Unknown</option>
						</select>
					</div>

					{/* Progress */}
					{saving && (
						<div className="theme-bg-secondary rounded-lg p-3 border theme-border-secondary">
							<div className="flex items-center justify-between text-sm theme-text-primary mb-2">
								<span>Updating test runs...</span>
								<span>
									{progress.current} / {progress.total}
								</span>
							</div>
							<div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
								<div
									className="bg-blue-600 h-2 rounded-full transition-all duration-300"
									style={{
										width: `${(progress.current / progress.total) * 100}%`,
									}}
								></div>
							</div>
						</div>
					)}

					{/* Error Message */}
					{error && (
						<div className="flex items-center p-3 text-sm theme-error rounded-md border">
							<AlertCircle className="h-4 w-4 mr-2" />
							{error}
						</div>
					)}
				</div>

				{/* Footer */}
				<div className="flex items-center justify-end gap-3 p-6 border-t theme-border-primary theme-bg-secondary">
					<button
						onClick={handleClose}
						disabled={saving}
						className="px-4 py-2 text-sm font-medium theme-btn-secondary border rounded-md transition-colors disabled:opacity-50"
					>
						Cancel
					</button>
					<button
						onClick={handleSave}
						disabled={
							saving ||
							(!updateDriveModel &&
								!updateDriveType &&
								!updateHostname &&
								!updateProtocol)
						}
						className="inline-flex items-center px-4 py-2 text-sm font-medium theme-btn-primary border border-transparent rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{saving ? (
							<>
								<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
								Updating...
							</>
						) : (
							<>
								<Save className="h-4 w-4 mr-2" />
								Update {testRuns.length} Test Runs
							</>
						)}
					</button>
				</div>
			</div>
		</div>
	);
}
