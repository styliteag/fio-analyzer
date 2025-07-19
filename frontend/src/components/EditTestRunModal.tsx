import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import type { TestRun } from "../types";
import { updateTestRun } from "../services/api/testRuns";
import BaseTestRunModal from "./shared/BaseTestRunModal";
import DriveTypeSelector from "./shared/DriveTypeSelector";
import ProtocolSelector from "./shared/ProtocolSelector";

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
		} catch {
			setError("Network error occurred");
		} finally {
			setSaving(false);
		}
	};


	const handleDriveTypeChange = (driveType: string, customType: string, showCustom: boolean) => {
		setDriveType(driveType);
		setCustomDriveType(customType);
		setShowCustomType(showCustom);
	};

	if (!isOpen || !testRun) return null;

	return (
		<BaseTestRunModal
			isOpen={isOpen}
			onClose={onClose}
			title="Edit Test Run"
			saving={saving}
			error={error}
			onSave={handleSave}
			saveButtonText="Save Changes"
			saveButtonIcon={<Save className="h-4 w-4 mr-2" />}
			maxWidth="md"
			saveDisabled={!driveModel && !driveType && !customDriveType}
		>
			{/* Test Run Info */}
					<div className="theme-bg-secondary rounded-lg p-4 text-sm border theme-border-secondary">
						<div className="grid grid-cols-2 gap-2 theme-text-primary">
							<div>
								<span className="font-medium">Test:</span> {testRun.test_name}
							</div>
							<div>
								<span className="font-medium">Block Size:</span>{" "}
								{testRun.block_size}
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
				<DriveTypeSelector
					value={driveType}
					customValue={customDriveType}
					showCustom={showCustomType}
					onChange={handleDriveTypeChange}
					disabled={saving}
				/>
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
				<ProtocolSelector
					value={protocol}
					onChange={setProtocol}
					disabled={saving}
				/>
			</div>

		</BaseTestRunModal>
	);
}
