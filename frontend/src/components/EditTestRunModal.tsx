import { AlertCircle, Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { TestRun } from "../types";
import { updateTestRun } from "../utils/api";

interface EditTestRunModalProps {
	testRun: TestRun | null;
	isOpen: boolean;
	onClose: () => void;
	onSave: (testRun: TestRun) => void;
}

export default function EditTestRunModal({
	testRun,
	isOpen,
	onClose,
	onSave,
}: EditTestRunModalProps) {
	const [driveModel, setDriveModel] = useState("");
	const [driveType, setDriveType] = useState("");
	const [customDriveType, setCustomDriveType] = useState("");
	const [showCustomType, setShowCustomType] = useState(false);
	const [hostname, setHostname] = useState("");
	const [protocol, setProtocol] = useState("");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (testRun) {
			setDriveModel(testRun.drive_model);
			setDriveType(testRun.drive_type);
			setCustomDriveType("");
			setShowCustomType(false);
			setHostname(testRun.hostname || "");
			setProtocol(testRun.protocol || "");
			setError(null);
		}
	}, [testRun]);

	const handleSave = async () => {
		if (!testRun) return;

		setSaving(true);
		setError(null);

		const finalDriveType = showCustomType ? customDriveType : driveType;

		try {
			await updateTestRun(testRun.id, {
				drive_model: driveModel,
				drive_type: finalDriveType,
				hostname: hostname,
				protocol: protocol,
			});

			const updatedTestRun = {
				...testRun,
				drive_model: driveModel,
				drive_type: finalDriveType,
				hostname: hostname,
				protocol: protocol,
			};
			onSave(updatedTestRun);
			onClose();
		} catch (_err) {
			setError("Network error occurred");
		} finally {
			setSaving(false);
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

	if (!isOpen || !testRun) return null;

	return (
		<div className="fixed inset-0 theme-overlay flex items-center justify-center p-4 z-50">
			<div className="theme-modal rounded-lg shadow-xl max-w-md w-full border">
				{/* Header */}
				<div className="flex items-center justify-between p-6 border-b theme-border-primary">
					<h3 className="text-lg font-medium theme-text-primary">
						Edit Test Run
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
					{/* Test Run Info */}
					<div className="theme-bg-secondary rounded-lg p-4 text-sm border theme-border-secondary">
						<div className="grid grid-cols-2 gap-2 theme-text-primary">
							<div>
								<span className="font-medium">Test:</span> {testRun.test_name}
							</div>
							<div>
								<span className="font-medium">Block Size:</span>{" "}
								{testRun.block_size}k
							</div>
							<div>
								<span className="font-medium">Pattern:</span>{" "}
								{testRun.read_write_pattern}
							</div>
							<div>
								<span className="font-medium">Queue Depth:</span>{" "}
								{testRun.queue_depth}
							</div>
							{testRun.hostname && (
								<div>
									<span className="font-medium">📡 Host:</span>{" "}
									{testRun.hostname}
								</div>
							)}
							{testRun.protocol && (
								<div>
									<span className="font-medium">🔗 Protocol:</span>{" "}
									{testRun.protocol}
								</div>
							)}
						</div>
					</div>

					{/* Drive Model */}
					<div className="theme-form-group">
						<label htmlFor="drive-model" className="theme-form-label">
							Drive Model
						</label>
						<input
							id="drive-model"
							type="text"
							value={driveModel}
							onChange={(e) => setDriveModel(e.target.value)}
							placeholder="e.g., Samsung 980 PRO"
							className="theme-form-input"
							disabled={saving}
						/>
					</div>

					{/* Drive Type */}
					<div className="theme-form-group">
						<label htmlFor="drive-type" className="theme-form-label">
							Drive Type
						</label>
						{!showCustomType ? (
							<select
								id="drive-type"
								value={driveType}
								onChange={(e) => handleDriveTypeChange(e.target.value)}
								className="theme-form-select"
								disabled={saving}
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
									disabled={saving}
								/>
								<button
									type="button"
									onClick={() => {
										setShowCustomType(false);
										setCustomDriveType("");
										setDriveType("");
									}}
									className="px-3 py-2 text-sm theme-btn-secondary rounded-md transition-colors"
									disabled={saving}
								>
									Cancel
								</button>
							</div>
						)}
					</div>

					{/* Hostname */}
					<div className="theme-form-group">
						<label htmlFor="hostname" className="theme-form-label">
							📡 Hostname
						</label>
						<input
							id="hostname"
							type="text"
							value={hostname}
							onChange={(e) => setHostname(e.target.value)}
							placeholder="e.g., web-server-01"
							className="theme-form-input"
							disabled={saving}
						/>
					</div>

					{/* Protocol */}
					<div className="theme-form-group">
						<label htmlFor="protocol" className="theme-form-label">
							🔗 Protocol
						</label>
						<select
							id="protocol"
							value={protocol}
							onChange={(e) => setProtocol(e.target.value)}
							className="theme-form-select"
							disabled={saving}
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
						disabled={saving || (!driveModel && !driveType && !customDriveType)}
						className="inline-flex items-center px-4 py-2 text-sm font-medium theme-btn-primary border border-transparent rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{saving ? (
							<>
								<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
								Saving...
							</>
						) : (
							<>
								<Save className="h-4 w-4 mr-2" />
								Save Changes
							</>
						)}
					</button>
				</div>
			</div>
		</div>
	);
}
