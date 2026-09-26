import { CheckCircle2, Upload as UploadIcon } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/layout";
import { Button, Card } from "../components/ui";
import FileDropZone from "../components/upload/FileDropZone";
import UploadHelp from "../components/upload/UploadHelp";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { uploadFioData } from "../services/api/upload";

const DRIVE_TYPES = ["NVMe SSD", "SATA SSD", "HDD", "Optane", "eUFS", "eMMC", "SD Card"] as const;
const CUSTOM_TYPE = "__custom__";

interface UploadForm {
	readonly hostname: string;
	readonly protocol: string;
	readonly driveType: string;
	readonly customDriveType: string;
	readonly driveModel: string;
	readonly description: string;
}

const EMPTY_FORM: UploadForm = {
	hostname: "",
	protocol: "",
	driveType: "",
	customDriveType: "",
	driveModel: "",
	description: "",
};

const HIERARCHY_HELP = "Used to group results: Host → Protocol → Drive type → Drive model. Empty fields become \"Unknown\".";

export default function Upload() {
	const { isAdmin } = useAuth();
	const toast = useToast();
	const [file, setFile] = useState<File | null>(null);
	const [form, setForm] = useState<UploadForm>(EMPTY_FORM);
	const [uploading, setUploading] = useState(false);
	const [lastUpload, setLastUpload] = useState<{ fileName: string; hostname: string } | null>(null);

	const update = (field: keyof UploadForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
		setForm((current) => ({ ...current, [field]: e.target.value }));

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!file) {
			toast.error("Please choose a FIO JSON file first.");
			return;
		}

		setUploading(true);
		const driveType = form.driveType === CUSTOM_TYPE ? form.customDriveType : form.driveType;
		const hostname = form.hostname.trim() || "Unknown";
		const result = await uploadFioData(file, {
			drive_model: form.driveModel.trim() || "Unknown",
			drive_type: driveType.trim() || "Unknown",
			hostname,
			protocol: form.protocol.trim() || "Unknown",
			description: form.description.trim() || "Imported FIO test",
		});
		setUploading(false);

		if (result.error) {
			toast.error(`Import failed: ${result.error}`);
			return;
		}

		toast.success(`${file.name} imported`);
		setLastUpload({ fileName: file.name, hostname });
		setFile(null);
		// Keep host metadata: consecutive uploads usually come from the same machine
		setForm((current) => ({ ...current, description: "" }));
	};

	return (
		<div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
			<PageHeader
				title="Upload FIO Results"
				description="Import FIO JSON output. IOPS, latency, bandwidth and percentiles are extracted automatically."
			/>

			<UploadHelp />

			{lastUpload && (
				<div role="status" className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-green-400 bg-green-50 dark:bg-green-900/20 p-4">
					<CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" aria-hidden="true" />
					<p className="flex-1 text-sm text-green-800 dark:text-green-200">
						<span className="font-medium">{lastUpload.fileName}</span> was imported for host <span className="font-medium">{lastUpload.hostname}</span>.
						Host fields are kept for the next file.
					</p>
					{isAdmin && (
						<Link
							to={`/host?${new URLSearchParams({ hosts: lastUpload.hostname })}`}
							className="text-sm font-medium text-green-800 dark:text-green-200 underline whitespace-nowrap"
						>
							View results →
						</Link>
					)}
				</div>
			)}

			<Card className="p-6 sm:p-8">
				<form onSubmit={handleSubmit} className="space-y-6">
					<div>
						<span className="block text-sm font-medium theme-text-primary mb-2">
							FIO JSON file <span className="text-red-500" aria-hidden="true">*</span>
						</span>
						<FileDropZone file={file} onFileChange={setFile} onInvalidFile={toast.error} />
					</div>

					<fieldset>
						<legend className="text-sm font-medium theme-text-primary">Where was the test run?</legend>
						<p className="theme-form-help mb-3">{HIERARCHY_HELP}</p>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div className="theme-form-group">
								<label htmlFor="hostname" className="theme-form-label">Hostname</label>
								<input id="hostname" type="text" value={form.hostname} onChange={update("hostname")} placeholder="e.g. server-01" className="theme-form-input" />
							</div>
							<div className="theme-form-group">
								<label htmlFor="protocol" className="theme-form-label">Protocol</label>
								<input id="protocol" type="text" value={form.protocol} onChange={update("protocol")} placeholder="e.g. Local, NVMe-oF, iSCSI, NFS" className="theme-form-input" />
							</div>
							<div className="theme-form-group">
								<label htmlFor="drive-type" className="theme-form-label">Drive type</label>
								<select id="drive-type" value={form.driveType} onChange={update("driveType")} className="theme-form-select">
									<option value="">Select type</option>
									{DRIVE_TYPES.map((type) => (
										<option key={type} value={type}>{type}</option>
									))}
									<option value={CUSTOM_TYPE}>Other…</option>
								</select>
								{form.driveType === CUSTOM_TYPE && (
									<input
										type="text"
										aria-label="Custom drive type"
										value={form.customDriveType}
										onChange={update("customDriveType")}
										placeholder="Enter drive type"
										className="theme-form-input mt-2"
									/>
								)}
							</div>
							<div className="theme-form-group">
								<label htmlFor="drive-model" className="theme-form-label">Drive model</label>
								<input id="drive-model" type="text" value={form.driveModel} onChange={update("driveModel")} placeholder="e.g. Samsung 980 PRO" className="theme-form-input" />
							</div>
						</div>
					</fieldset>

					<div className="theme-form-group">
						<label htmlFor="description" className="theme-form-label">Description (optional)</label>
						<textarea
							id="description"
							value={form.description}
							onChange={update("description")}
							placeholder="e.g. Weekly check after firmware update"
							className="theme-form-input"
							rows={2}
						/>
					</div>

					<Button type="submit" size="lg" disabled={!file} loading={uploading}>
						<UploadIcon className="h-5 w-5" aria-hidden="true" />
						{uploading ? "Importing…" : "Import results"}
					</Button>
				</form>
			</Card>
		</div>
	);
}
