import { Edit, Save } from "lucide-react";
import { useEffect, useState } from "react";
import type { TestRun } from "../types";
import { updateTestRun } from "../services/api/testRuns";
import BaseTestRunModal from "./shared/BaseTestRunModal";
import TestRunFormFields, {
	useTestRunFormData,
	useTestRunUpdateFlags
} from "./shared/TestRunFormFields";

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
	const [formData, setFormData] = useTestRunFormData();
	const [updateFlags, setUpdateFlags] = useTestRunUpdateFlags();
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [progress, setProgress] = useState({ current: 0, total: 0 });

	useEffect(() => {
		if (testRuns.length > 0) {
			// Reset form
			setFormData({
				driveModel: "",
				driveType: "",
				customDriveType: "",
				showCustomType: false,
				hostname: "",
				protocol: ""
			});
			setUpdateFlags({
				updateDriveModel: false,
				updateDriveType: false,
				updateHostname: false,
				updateProtocol: false
			});
			setError(null);
			setProgress({ current: 0, total: 0 });
		}
	}, [testRuns, setFormData, setUpdateFlags]);

	const handleSave = async () => {
		if (!testRuns.length) return;

		// Check if at least one field is selected for update
		if (
			!updateFlags.updateDriveModel &&
			!updateFlags.updateDriveType &&
			!updateFlags.updateHostname &&
			!updateFlags.updateProtocol
		) {
			setError("Please select at least one field to update");
			return;
		}

		setSaving(true);
		setError(null);
		setProgress({ current: 0, total: testRuns.length });

		const finalDriveType = formData.showCustomType ? formData.customDriveType : formData.driveType;
		const updatedRuns: TestRun[] = [];
		let failed = 0;

		try {
			for (let i = 0; i < testRuns.length; i++) {
				const testRun = testRuns[i];
				setProgress({ current: i + 1, total: testRuns.length });

				try {
					const updateData: any = {};

					if (updateFlags.updateDriveModel && formData.driveModel.trim()) {
						updateData.drive_model = formData.driveModel.trim();
					}
					if (updateFlags.updateDriveType && finalDriveType.trim()) {
						updateData.drive_type = finalDriveType.trim();
					}
					if (updateFlags.updateHostname && formData.hostname.trim()) {
						updateData.hostname = formData.hostname.trim();
					}
					if (updateFlags.updateProtocol && formData.protocol.trim()) {
						updateData.protocol = formData.protocol.trim();
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



	if (!isOpen || !testRuns.length) return null;

	return (
		<BaseTestRunModal
			isOpen={isOpen}
			onClose={onClose}
			title={`Bulk Edit ${testRuns.length} Test Runs`}
			icon={<Edit className="h-5 w-5" />}
			saving={saving}
			error={error}
			onSave={handleSave}
			saveButtonText={`Update ${testRuns.length} Test Runs`}
			saveButtonIcon={<Save className="h-4 w-4 mr-2" />}
			maxWidth="lg"
			saveDisabled={
				!updateFlags.updateDriveModel &&
				!updateFlags.updateDriveType &&
				!updateFlags.updateHostname &&
				!updateFlags.updateProtocol
			}
		>
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

			{/* Form Fields */}
			<TestRunFormFields
				formData={formData}
				onFormDataChange={setFormData}
				mode="bulk"
				updateFlags={updateFlags}
				onUpdateFlagsChange={setUpdateFlags}
				disabled={saving}
			/>

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

		</BaseTestRunModal>
	);
}
