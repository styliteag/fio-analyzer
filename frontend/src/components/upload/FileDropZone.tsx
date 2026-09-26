// Click-or-drop file picker for FIO JSON files
import { useRef, useState } from 'react';
import { FileJson, Upload as UploadIcon, X } from 'lucide-react';

interface FileDropZoneProps {
    readonly file: File | null;
    readonly onFileChange: (file: File | null) => void;
    readonly onInvalidFile: (message: string) => void;
}

const isJsonFile = (file: File): boolean => file.name.toLowerCase().endsWith('.json') || file.type === 'application/json';

const formatSize = (bytes: number): string =>
    bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const FileDropZone: React.FC<FileDropZoneProps> = ({ file, onFileChange, onInvalidFile }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);

    const accept = (candidate: File | undefined) => {
        if (!candidate) return;
        if (!isJsonFile(candidate)) {
            onInvalidFile(`"${candidate.name}" is not a JSON file. Run fio with --output-format=json.`);
            return;
        }
        onFileChange(candidate);
    };

    const clear = () => {
        onFileChange(null);
        if (inputRef.current) inputRef.current.value = '';
    };

    if (file) {
        return (
            <div className="flex items-center gap-3 rounded-lg border theme-border-primary p-4">
                <FileJson className="h-8 w-8 theme-text-accent shrink-0" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                    <p className="font-medium theme-text-primary truncate">{file.name}</p>
                    <p className="text-xs theme-text-secondary">{formatSize(file.size)}</p>
                </div>
                <button type="button" onClick={clear} className="p-2 rounded-md theme-nav-link" aria-label="Remove selected file">
                    <X className="h-4 w-4" />
                </button>
            </div>
        );
    }

    return (
        <div
            onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                accept(e.dataTransfer.files[0]);
            }}
            className={`flex justify-center rounded-lg border-2 border-dashed px-6 py-8 transition-colors ${
                dragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
            }`}
        >
            <div className="text-center">
                <UploadIcon className="mx-auto h-10 w-10 theme-text-tertiary" aria-hidden="true" />
                <p className="mt-2 text-sm theme-text-secondary">
                    <label htmlFor="file-input" className="cursor-pointer font-medium theme-text-accent underline focus-within:outline-none">
                        Choose a file
                        <input
                            ref={inputRef}
                            id="file-input"
                            type="file"
                            accept=".json,application/json"
                            className="sr-only"
                            onChange={(e) => accept(e.target.files?.[0])}
                        />
                    </label>{' '}
                    or drag and drop it here
                </p>
                <p className="mt-1 text-xs theme-text-tertiary">FIO JSON output (--output-format=json)</p>
            </div>
        </div>
    );
};

export default FileDropZone;
