// First-run guidance shown while the database has no test runs
import { Link } from 'react-router-dom';
import { Rocket } from 'lucide-react';
import { Card } from '../ui';
import { TESTING_SCRIPT_URL } from '../../utils/apiDocs';

const STEPS: readonly { title: string; body: React.ReactNode }[] = [
    {
        title: 'Download the test script',
        body: (
            <>
                <a href={TESTING_SCRIPT_URL} className="theme-text-accent underline">fio-test.sh</a> runs a configurable FIO matrix and uploads the results.
            </>
        ),
    },
    {
        title: 'Create a configuration',
        body: (
            <>
                Run <code className="px-1 rounded theme-bg-tertiary">./fio-test.sh --generate-env</code>, then set HOSTNAME, PROTOCOL, DRIVE_TYPE, DRIVE_MODEL, the server URL and upload credentials in <code className="px-1 rounded theme-bg-tertiary">.env</code>.
            </>
        ),
    },
    {
        title: 'Run the tests',
        body: (
            <>
                Run <code className="px-1 rounded theme-bg-tertiary">./fio-test.sh</code>. Results appear here automatically. Add <code className="px-1 rounded theme-bg-tertiary">--saturation</code> for a queue-depth saturation test.
            </>
        ),
    },
];

const GettingStarted: React.FC = () => (
    <Card className="p-6 mb-8 border-l-4 border-l-blue-500">
        <div className="flex items-center gap-2 mb-4">
            <Rocket className="h-5 w-5 theme-text-accent" aria-hidden="true" />
            <h2 className="text-lg font-semibold theme-text-primary">No benchmark data yet. Get started in three steps</h2>
        </div>
        <ol className="grid gap-4 md:grid-cols-3">
            {STEPS.map((step, index) => (
                <li key={step.title} className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold theme-btn-primary">
                        {index + 1}
                    </span>
                    <div>
                        <h3 className="font-medium theme-text-primary">{step.title}</h3>
                        <p className="text-sm theme-text-secondary mt-1">{step.body}</p>
                    </div>
                </li>
            ))}
        </ol>
        <p className="mt-4 text-sm theme-text-secondary">
            Already have FIO JSON files? <Link to="/upload" className="theme-text-accent underline">Upload them directly</Link>.
        </p>
    </Card>
);

export default GettingStarted;
