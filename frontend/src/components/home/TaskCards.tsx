// "What do you want to do?" entry points on the dashboard
import { Link } from 'react-router-dom';
import { ArrowRight, Gauge, History, Server, Upload, type LucideIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface Task {
    readonly to: string;
    readonly title: string;
    readonly description: string;
    readonly icon: LucideIcon;
    readonly color: string;
    readonly needsUpload?: boolean;
}

const TASKS: readonly Task[] = [
    { to: '/host', title: 'Compare hosts & drives', description: 'Pick hosts and explore IOPS, latency and bandwidth across 14 views.', icon: Server, color: 'text-blue-600 dark:text-blue-400' },
    { to: '/history', title: 'Spot regressions', description: 'See how each configuration performs over time.', icon: History, color: 'text-emerald-600 dark:text-emerald-400' },
    { to: '/saturation', title: 'Find the saturation point', description: 'Queue depth where IOPS stop scaling and latency explodes.', icon: Gauge, color: 'text-orange-600 dark:text-orange-400' },
    { to: '/upload', title: 'Add results', description: 'Upload FIO JSON output or use the automated test script.', icon: Upload, color: 'text-purple-600 dark:text-purple-400', needsUpload: true },
];

const TaskCards: React.FC = () => {
    const { isUploader } = useAuth();
    const tasks = TASKS.filter((task) => !task.needsUpload || isUploader);

    return (
        <section aria-labelledby="tasks-heading" className="mb-8">
            <h2 id="tasks-heading" className="sr-only">
                Start a task
            </h2>
            <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${tasks.length === 4 ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}>
                {tasks.map(({ to, title, description, icon: Icon, color }) => (
                    <Link
                        key={to}
                        to={to}
                        className="group theme-card rounded-lg border p-5 transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <Icon className={`h-6 w-6 ${color}`} aria-hidden="true" />
                            <ArrowRight className="h-4 w-4 theme-text-tertiary transition-transform group-hover:translate-x-1" aria-hidden="true" />
                        </div>
                        <h3 className="font-semibold theme-text-primary">{title}</h3>
                        <p className="mt-1 text-sm theme-text-secondary">{description}</p>
                    </Link>
                ))}
            </div>
        </section>
    );
};

export default TaskCards;
