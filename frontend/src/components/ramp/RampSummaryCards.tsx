// Key figures of a client ramp from GET /api/ramp/runs/{ramp_uuid}/summary
import React from 'react';
import type { RampSummary, RampSummaryStep } from '../../services/api/ramp';

const iops = (value: number | null | undefined): string => (value != null ? Math.round(value).toLocaleString() : '–');
const ms = (value: number | null | undefined): string => (value != null ? `${value.toFixed(2)} ms` : '–');

const stepDetail = (step: RampSummaryStep | null): string =>
    step ? `${iops(step.iops)} IOPS · ${iops(step.per_client_iops)} per client · P95 ${ms(step.p95_latency)}` : '';

interface SummaryCardProps {
    readonly label: string;
    readonly value: string;
    readonly detail?: string;
    readonly tone?: 'default' | 'good' | 'bad' | 'warn';
}

const TONES: Readonly<Record<NonNullable<SummaryCardProps['tone']>, string>> = {
    default: 'theme-text-primary',
    good: 'text-green-600 dark:text-green-400',
    bad: 'text-red-600 dark:text-red-400',
    warn: 'text-amber-600 dark:text-amber-400',
};

const SummaryCard: React.FC<SummaryCardProps> = ({ label, value, detail, tone = 'default' }) => (
    <div className="theme-card rounded-lg border theme-border-primary p-4">
        <div className="text-xs font-medium uppercase tracking-wide theme-text-secondary">{label}</div>
        <div className={`mt-1 text-xl font-semibold ${TONES[tone]}`}>{value}</div>
        {detail && <div className="mt-1 text-xs theme-text-secondary">{detail}</div>}
    </div>
);

export const RampSummaryCards: React.FC<{ readonly summary: RampSummary }> = ({ summary }) => {
    const fairness = summary.steps.filter((step) => step.complete && step.fairness !== null);
    const worst = fairness.length > 0 ? fairness.reduce((a, b) => ((a.fairness ?? 1) <= (b.fairness ?? 1) ? a : b)) : null;
    const drop = summary.per_client_iops_drop_pct;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <SummaryCard
                label={`Within ${summary.threshold_ms} ms P95`}
                value={summary.best_within ? `${summary.best_within.clients} clients` : 'None'}
                detail={summary.best_within ? stepDetail(summary.best_within) : 'No complete step stays within the threshold'}
                tone={summary.best_within ? 'good' : 'bad'}
            />
            <SummaryCard
                label="Threshold crossed at"
                value={summary.crossed_at ? `${summary.crossed_at.clients} clients` : 'Not reached'}
                detail={summary.crossed_at ? stepDetail(summary.crossed_at) : 'P95 stays below the threshold on every complete step'}
                tone={summary.crossed_at ? 'bad' : 'default'}
            />
            <SummaryCard
                label="Max aggregate IOPS"
                value={iops(summary.max_iops?.iops)}
                detail={summary.max_iops ? `at ${summary.max_iops.clients} clients` : undefined}
            />
            <SummaryCard
                label="Per-client IOPS drop"
                value={drop != null ? `${drop.toFixed(1)} %` : '–'}
                detail="smallest to largest complete step"
                tone={drop != null && drop >= 25 ? 'warn' : 'default'}
            />
            <SummaryCard
                label="Worst fairness"
                value={worst?.fairness != null ? `${Math.round(worst.fairness * 100)} %` : '–'}
                detail={worst ? `slowest / fastest client at ${worst.clients} clients` : 'needs at least two clients'}
                tone={worst?.fairness != null && worst.fairness < 0.8 ? 'warn' : 'default'}
            />
            <SummaryCard
                label="Incomplete steps"
                value={String(summary.incomplete_steps)}
                detail={summary.incomplete_steps > 0 ? 'a client failed; not ranked' : `of ${summary.steps.length} client counts`}
                tone={summary.incomplete_steps > 0 ? 'bad' : 'default'}
            />
        </div>
    );
};

export default RampSummaryCards;
