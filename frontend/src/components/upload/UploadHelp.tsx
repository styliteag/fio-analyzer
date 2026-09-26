// Collapsible guidance: automated script vs. manual fio commands
import { Download, Terminal } from 'lucide-react';
import { TESTING_SCRIPT_URL } from '../../utils/apiDocs';

const EXAMPLES: readonly { title: string; command: string }[] = [
    {
        title: 'Sequential read',
        command: 'fio --name=seqread --rw=read --bs=64k --iodepth=16 --runtime=60 --time_based --output-format=json --output=results.json',
    },
    {
        title: 'Random mixed 70/30',
        command: 'fio --name=randtest --rw=randrw --rwmixread=70 --bs=4k --iodepth=32 --runtime=120 --time_based --output-format=json --output=results.json',
    },
];

const UploadHelp: React.FC = () => (
    <div className="mb-6 grid gap-4 md:grid-cols-2 items-start">
        <div className="rounded-lg border theme-border-primary p-4">
            <div className="flex items-center gap-2 mb-2">
                <Download className="h-5 w-5 theme-text-accent" aria-hidden="true" />
                <h2 className="font-semibold theme-text-primary">Recommended: automated script</h2>
            </div>
            <p className="text-sm theme-text-secondary">
                <a href={TESTING_SCRIPT_URL} className="theme-text-accent underline">fio-test.sh</a> runs a full test matrix and uploads every result with the
                right host, protocol and drive metadata. Start with <code className="px-1 rounded theme-bg-tertiary">./fio-test.sh --generate-env</code>.
            </p>
        </div>
        <details className="rounded-lg border theme-border-primary p-4 group">
            <summary className="flex items-center gap-2 cursor-pointer list-none">
                <Terminal className="h-5 w-5 theme-text-accent" aria-hidden="true" />
                <span className="font-semibold theme-text-primary">Manual: run fio yourself</span>
                <span className="ml-auto text-xs theme-text-tertiary group-open:hidden">Show commands</span>
            </summary>
            <div className="mt-3 space-y-2">
                {EXAMPLES.map((example) => (
                    <div key={example.title}>
                        <p className="text-xs theme-text-tertiary mb-1"># {example.title}</p>
                        <pre className="text-xs font-mono whitespace-pre-wrap break-all p-2 rounded theme-bg-tertiary theme-text-secondary">
                            {example.command}
                        </pre>
                    </div>
                ))}
            </div>
        </details>
    </div>
);

export default UploadHelp;
