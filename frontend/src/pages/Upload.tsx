import {
	AlertCircle,
	ArrowLeft,
	Check,
	Download,
	FileText,
	LogOut,
	Upload as UploadIcon,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ThemeToggle from "../components/ThemeToggle";
import { useAuth } from "../contexts/AuthContext";
import { uploadFioData } from "../services/api/upload";

export default function Upload() {
	const navigate = useNavigate();
	const { username, logout } = useAuth();
	const [file, setFile] = useState<File | null>(null);
	const [driveModel, setDriveModel] = useState("");
	const [driveType, setDriveType] = useState("");
	const [customDriveType, setCustomDriveType] = useState("");
	const [showCustomType, setShowCustomType] = useState(false);
	const [uploading, setUploading] = useState(false);
	const [message, setMessage] = useState<{
		type: "success" | "error";
		text: string;
	} | null>(null);
	const [hostname, setHostname] = useState("");
	const [protocol, setProtocol] = useState("");
	const [description, setDescription] = useState("");

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const selectedFile = e.target.files?.[0];
		if (selectedFile) {
			setFile(selectedFile);
			setMessage(null);
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

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!file) {
			setMessage({ type: "error", text: "Please select a FIO JSON file" });
			return;
		}

		setUploading(true);

		const finalDriveType = showCustomType ? customDriveType : driveType;

		try {
			const result = await uploadFioData(file, {
				drive_model: driveModel || "Unknown",
				drive_type: finalDriveType || "Unknown",
				hostname: hostname || "Unknown",
				protocol: protocol || "Unknown",
				description: description || "Imported FIO test",
			});

			setMessage({
				type: "success",
				text: "FIO results imported successfully!",
			});
			setFile(null);
			setDriveModel("");
			setDriveType("");
			setCustomDriveType("");
			setShowCustomType(false);
			setHostname("");
			setProtocol("");
			setDescription("");

			// Reset file input
			const fileInput = document.getElementById(
				"file-input",
			) as HTMLInputElement;
			if (fileInput) fileInput.value = "";

			// Navigate back to home after 2 seconds
			setTimeout(() => {
				navigate("/");
			}, 2000);
		} catch {
			setMessage({ type: "error", text: "Network error occurred" });
		} finally {
			setUploading(false);
		}
	};

	return (
		<div className="min-h-screen theme-bg-secondary transition-colors">
			{/* Header */}
			<header className="theme-header shadow-sm">
				<div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex items-center justify-between h-16">
						<button
							type="button"
							onClick={() => navigate("/")}
							className="flex items-center theme-nav-link transition-colors"
						>
							<ArrowLeft className="h-5 w-5 mr-2" />
							Back to Dashboard
						</button>
						<div className="flex items-center space-x-4">
							<div className="flex items-center">
								<UploadIcon className="h-8 w-8 theme-text-accent mr-3" />
								<h1 className="text-2xl font-bold theme-text-primary">
									Upload FIO Results
								</h1>
							</div>
							<ThemeToggle />
							<div className="flex items-center space-x-2">
								<span className="text-sm theme-text-secondary">
									Welcome, {username}
								</span>
								<button
									onClick={logout}
									className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md theme-text-secondary hover:theme-text-primary transition-colors"
									title="Logout"
								>
									<LogOut className="h-4 w-4" />
								</button>
							</div>
						</div>
					</div>
				</div>
			</header>

			{/* Main Content */}
			<main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
				<div className="theme-card rounded-lg shadow-lg p-8 border">
					{/* Instructions */}
					<div className="mb-8">
						<div className="flex items-center mb-4">
							<FileText className="h-6 w-6 theme-text-accent mr-3" />
							<h2 className="text-xl font-semibold theme-text-primary">
								Import Benchmark Data
							</h2>
						</div>
						<p className="theme-text-secondary mb-4">
							Upload FIO JSON output files to analyze storage performance
							metrics. The system will automatically extract IOPS, latency,
							throughput, and detailed percentile data from your benchmark
							results.
						</p>

						{/* FIO Command Examples */}
						<div className="theme-bg-secondary rounded-lg p-4 mb-6 border theme-border-secondary">
							<h3 className="font-medium theme-text-primary mb-2">
								Generate FIO JSON files with these commands:
							</h3>
							<div className="space-y-2 text-sm font-mono theme-text-secondary">
								<div className="theme-bg-card p-2 rounded border theme-border-primary">
									<div className="theme-text-tertiary text-xs mb-1">
										# Sequential read test
									</div>
									<div>
										fio --name=seqread --rw=read --bs=64k --iodepth=16
										--runtime=60 --time_based --output-format=json
										--output=results.json
									</div>
								</div>
								<div className="theme-bg-card p-2 rounded border theme-border-primary">
									<div className="theme-text-tertiary text-xs mb-1">
										# Random mixed workload
									</div>
									<div>
										fio --name=randtest --rw=randrw --rwmixread=70 --bs=4k
										--iodepth=32 --runtime=120 --time_based --output-format=json
										--output=results.json
									</div>
								</div>
							</div>
						</div>
					</div>

					{/* Upload Form */}
					<form onSubmit={handleSubmit} className="space-y-6">
						{/* File Upload */}
						<div>
							<label
								htmlFor="file-input"
								className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
							>
								FIO JSON Results File *
							</label>
							<div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg hover:border-gray-400 dark:hover:border-gray-500 transition-colors">
								<div className="space-y-1 text-center">
									<UploadIcon className="mx-auto h-12 w-12 theme-text-quaternary" />
									<div className="flex text-sm theme-text-secondary">
										<label
											htmlFor="file-input"
											className="relative cursor-pointer theme-bg-card rounded-md font-medium theme-text-accent hover:theme-text-accent focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 theme-focus"
										>
											<span>Upload a file</span>
											<input
												id="file-input"
												name="file-upload"
												type="file"
												accept=".json"
												className="sr-only"
												onChange={handleFileChange}
											/>
										</label>
										<p className="pl-1">or drag and drop</p>
									</div>
									<p className="text-xs theme-text-tertiary">JSON files only</p>
								</div>
							</div>
							{file && (
								<div className="mt-2 text-sm theme-text-secondary">
									Selected: <span className="font-medium">{file.name}</span>
								</div>
							)}
						</div>

						{/* Drive Information */}
						<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
								/>
								<p className="theme-form-help">
									Optional: Specify the storage device model
								</p>
							</div>

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
										/>
										<button
											type="button"
											onClick={() => {
												setShowCustomType(false);
												setCustomDriveType("");
												setDriveType("");
											}}
											className="px-3 py-2 text-sm theme-btn-secondary rounded-md transition-colors"
										>
											Cancel
										</button>
									</div>
								)}
								<p className="theme-form-help">
									Optional: Categorize the storage device
								</p>
							</div>
						</div>

						{/* Host and Protocol Information */}
						<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
							<div className="theme-form-group">
								<label htmlFor="hostname" className="theme-form-label">
									Hostname
								</label>
								<input
									id="hostname"
									type="text"
									value={hostname}
									onChange={(e) => setHostname(e.target.value)}
									placeholder="e.g., server-01"
									className="theme-form-input"
								/>
								<p className="theme-form-help">
									Optional: Specify the host where the test was run
								</p>
							</div>

							<div className="theme-form-group">
								<label htmlFor="protocol" className="theme-form-label">
									Protocol
								</label>
								<input
									id="protocol"
									type="text"
									value={protocol}
									onChange={(e) => setProtocol(e.target.value)}
									placeholder="e.g., NVMe, SATA, iSCSI"
									className="theme-form-input"
								/>
								<p className="theme-form-help">
									Optional: Specify the storage protocol used
								</p>
							</div>
						</div>

						{/* Description */}
						<div className="mt-6">
							<label htmlFor="description" className="theme-form-label">
								Description
							</label>
							<textarea
								id="description"
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								placeholder="e.g., Weekly performance check of production database server"
								className="theme-form-input"
								rows={3}
							/>
							<p className="theme-form-help">
								Optional: Add a description for this test run
							</p>
						</div>

						{/* Hidden date field */}
						<input type="hidden" name="date" value={new Date().toISOString()} />

						{/* Submit Button */}
						<div className="flex items-center justify-between pt-6">
							<button
								type="submit"
								disabled={!file || uploading}
								className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm theme-btn-primary disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
							>
								{uploading ? (
									<>
										<div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
										Importing Results...
									</>
								) : (
									<>
										<UploadIcon className="h-5 w-5 mr-3" />
										Import FIO Results
									</>
								)}
							</button>

							{message && (
								<div
									className={`flex items-center ${message.type === "success" ? "theme-text-success" : "theme-text-error"}`}
								>
									{message.type === "success" ? (
										<Check className="h-5 w-5 mr-2" />
									) : (
										<AlertCircle className="h-5 w-5 mr-2" />
									)}
									<span className="font-medium">{message.text}</span>
								</div>
							)}
						</div>
					</form>

					{/* Success Message */}
					{message?.type === "success" && (
						<div className="mt-6 theme-success rounded-lg p-4 border">
							<div className="flex">
								<Check className="h-5 w-5 theme-text-success mr-3 mt-0.5" />
								<div>
									<h3 className="text-sm font-medium theme-text-success">
										Import Successful!
									</h3>
									<p className="text-sm theme-text-success mt-1">
										Your FIO results have been processed and stored. Redirecting
										to dashboard...
									</p>
								</div>
							</div>
						</div>
					)}
				</div>
			</main>

			{/* Footer */}
			<footer className="theme-header mt-12">
				<div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
					<div className="text-center">
						<div className="text-sm theme-text-secondary mb-4">
							<p>
								Upload your FIO JSON results or use our automated testing script
							</p>
						</div>

						{/* Download Links */}
						<div className="flex justify-center items-center space-x-6 text-sm">
							<a
								href="/script.sh"
								className="inline-flex items-center px-3 py-2 theme-text-secondary hover:theme-text-primary transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
								title="Download FIO testing script"
							>
								<Download className="h-4 w-4 mr-2" />
								Testing Script
							</a>
							<span className="theme-text-secondary">•</span>
							<a
								href="/env.example"
								download
								className="inline-flex items-center px-3 py-2 theme-text-secondary hover:theme-text-primary transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
								title="Download configuration template"
							>
								<Download className="h-4 w-4 mr-2" />
								Config Template
							</a>
						</div>

						<div className="mt-2 text-xs theme-text-secondary">
							Download and configure these files to run automated FIO tests
						</div>
					</div>
				</div>
			</footer>
		</div>
	);
}
