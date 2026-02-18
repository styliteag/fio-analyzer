import { DashboardHeader, DashboardFooter } from '../components/layout';
import Card from '../components/ui/Card';
import SaturationChart from '../components/saturation/SaturationChart';

export default function Saturation() {
    return (
        <div className="min-h-screen theme-bg-secondary transition-colors">
            <DashboardHeader />

            <main className="w-full px-4 sm:px-6 lg:px-8 py-6">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold theme-text-primary mb-2">
                        Saturation Test Analysis
                    </h1>
                    <p className="theme-text-secondary text-lg">
                        Analyze IOPS saturation and P95 latency thresholds across queue depths
                    </p>
                </div>

                <Card className="p-6">
                    <SaturationChart />
                </Card>
            </main>

            <DashboardFooter getApiDocsUrl={() => {
                const apiBaseUrl = import.meta.env.VITE_API_URL || '';
                return apiBaseUrl ? `${apiBaseUrl}/api-docs` : '/api-docs';
            }} />
        </div>
    );
}
