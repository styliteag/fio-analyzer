import { expect, test, type Page } from '@playwright/test';
import { adminCredentials, login, trackPageErrors } from './helpers';

const admin = adminCredentials();

const ZFS = 'zfs-host|local|nvme|pool1';
const CEPH = 'ceph-node1|rbd|ssd|pool2';

const targets = [
    { hostname: 'ceph-node1', protocol: 'rbd', drive_type: 'ssd', drive_model: 'pool2', target: CEPH, test_runs: 12, last_run: '2025-06-31T20:00:00' },
    { hostname: 'zfs-host', protocol: 'local', drive_type: 'nvme', drive_model: 'pool1', target: ZFS, test_runs: 8, last_run: '2025-06-31T20:00:00' },
];

const metrics = (iops: number) => ({ iops, bandwidth: iops / 10, avg_latency: 1, p95_latency: 2, p99_latency: 3 });
const cell = (iops: number, testSize = '10G') => ({
    ...metrics(iops),
    timestamp: '2025-06-31T20:00:00',
    rows_merged: 1,
    test_size: testSize,
    duration: 60,
    layout: '',
});
const diff = (pct: number) => ({ iops: pct, bandwidth: pct, avg_latency: 0, p95_latency: 0, p99_latency: 0 });
const better = (pct: number) => ({ iops: pct > 0, bandwidth: pct > 0, avg_latency: null, p95_latency: null, p99_latency: null });

const row = (pattern: string, blockSize: string, iodepth: number, base: number, other: number, strict: boolean) => {
    const pct = Math.round(((other - base) / base) * 1000) / 10;
    const otherSize = strict ? '10G' : '1G';
    return {
        read_write_pattern: pattern,
        block_size: blockSize,
        sync: 'none',
        direct: 1,
        num_jobs: 1,
        iodepth,
        ...(strict ? { test_size: '10G', duration: 60, layout: '' } : { mismatch: ['test_size'] }),
        results: { [ZFS]: cell(base), [CEPH]: cell(other, otherSize) },
        diff_pct: { [CEPH]: diff(pct) },
        better: { [CEPH]: better(pct) },
    };
};

const comparison = (strict: boolean) => ({
    baseline: ZFS,
    targets: [ZFS, CEPH],
    strict,
    rows: [
        row('randread', '4K', 1, 400, 500, strict), // +25 %
        row('randread', '4K', 32, 400, 520, strict), // +30 % → median 27.5 % in one cell with ×2
        row('randwrite', '64K', 1, 500, 300, strict), // −40 %
    ],
    summary: {
        [CEPH]: { configs_compared: 3, configs_mismatched: strict ? 0 : 3, median_diff_pct: diff(25) },
    },
});

const mockCompareApi = async (page: Page): Promise<string[]> => {
    const requests: string[] = [];
    await page.route(/\/api\/compare\/targets/, (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ targets }) }),
    );
    await page.route(/\/api\/compare\?/, (route) => {
        const url = new URL(route.request().url());
        requests.push(url.search);
        const strict = url.searchParams.get('strict') !== 'false';
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(comparison(strict)) });
    });
    return requests;
};

const compareUrl = (...extra: string[]) =>
    `/compare?${[`t=${encodeURIComponent(ZFS)}`, `t=${encodeURIComponent(CEPH)}`, ...extra].join('&')}`;

test.describe('compare page', () => {
    test.skip(!admin, 'E2E_USER / E2E_PASSWORD not set');

    test.beforeEach(async ({ page }) => {
        await login(page, admin!);
    });

    test('picking targets keeps their order in the URL and allows a new baseline', async ({ page }) => {
        const errors = trackPageErrors(page);
        await mockCompareApi(page);
        await page.goto('/compare');
        await expect(page.getByRole('heading', { level: 1, name: 'Compare Storage' })).toBeVisible();
        await expect(page.getByText('Pick at least two targets')).toBeVisible();

        const input = page.locator('#compare-targets');
        await input.fill('zfs');
        await input.press('Enter');
        await input.fill('ceph');
        await input.press('Enter');

        await expect.poll(() => new URL(page.url()).searchParams.getAll('t')).toEqual([ZFS, CEPH]);
        await input.press('Escape'); // close the menu that stays open for further picks
        const order = page.getByRole('list', { name: 'Selected targets in order' });
        await expect(order.getByRole('listitem').first()).toContainText('Baseline');

        await page.getByRole('button', { name: /Make ceph-node1 .* the baseline/ }).click();
        await expect.poll(() => new URL(page.url()).searchParams.getAll('t')).toEqual([CEPH, ZFS]);
        expect(errors).toEqual([]);
    });

    test('matrix shows signed, coloured diffs with a count badge for merged configs', async ({ page }) => {
        await mockCompareApi(page);
        await page.goto(compareUrl());

        const matrix = page.getByRole('table', { name: /IOPS difference of ceph-node1/ });
        const better = matrix.locator('[data-better="true"]');
        await expect(better).toHaveCount(1);
        await expect(better).toContainText(/\+27[.,]5%/);
        await expect(better).toContainText('×2');
        await expect(better).toHaveClass(/bg-green/);

        const worse = matrix.locator('[data-better="false"]');
        await expect(worse).toContainText('−40%');
        await expect(worse).toHaveClass(/bg-red/);
        await expect(worse).toHaveAttribute('title', /baseline 500 → 300/);

        await expect(page.getByRole('table', { name: 'Summary per target' })).toContainText('+25%');
        await page.getByText(/All 3 configurations/).click();
        await expect(page.getByRole('cell', { name: 'randwrite' })).toBeVisible();
    });

    test('config filters narrow the matrix to one queue depth', async ({ page }) => {
        await mockCompareApi(page);
        await page.goto(compareUrl());
        await page.getByLabel('IO depth').selectOption('32');
        await expect(page).toHaveURL(/qd=32/);
        const matrix = page.getByRole('table', { name: /IOPS difference of ceph-node1/ });
        await expect(matrix.locator('[data-better="true"]')).toContainText('+30%');
        await expect(matrix.locator('[data-better="true"]')).not.toContainText('×2');
    });

    test('turning strict off sends strict=false and marks mismatched cells', async ({ page }) => {
        const requests = await mockCompareApi(page);
        await page.goto(compareUrl());
        await expect(page.getByRole('table', { name: /IOPS difference/ })).toBeVisible();
        await expect(page.getByTestId('mismatch-marker')).toHaveCount(0);
        expect(requests.at(-1)).toContain('strict=true');

        await page.getByLabel('Strict matching').click();
        await expect(page).toHaveURL(/strict=0/);
        await expect(page.getByLabel('Strict matching')).not.toBeChecked();
        await expect.poll(() => requests.at(-1)).toContain('strict=false');
        await expect(page.getByTestId('mismatch-marker').first()).toHaveAttribute('title', /test_size/);
    });

    test('shows the API error detail', async ({ page }) => {
        await mockCompareApi(page);
        await page.route(/\/api\/compare\?/, (route) =>
            route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ detail: "No test runs found for target 'x'" }) }),
        );
        await page.goto(compareUrl());
        await expect(page.getByText("No test runs found for target 'x'")).toBeVisible();
    });
});

const satRun = (uuid: string, hostname: string) => ({
    run_uuid: uuid,
    hostname,
    protocol: 'local',
    drive_type: 'nvme',
    drive_model: `${hostname}-model`,
    block_size: '4K',
    description: null,
    started: '2025-06-31T20:00:00',
    step_count: 5,
});

const step = (qd: number, iops: number, p95: number) => ({ id: qd, total_qd: qd, iodepth: qd, num_jobs: 1, iops, bandwidth: iops / 10, p95_latency: p95 });

const satSummary = (uuid: string, iops: number) => ({
    run_uuid: uuid,
    hostname: 'h',
    threshold_ms: 5,
    threshold_source: 'stored',
    patterns: [
        { read_write_pattern: 'randread', block_size: '4K', sync: 'none', status: 'saturated', steps: 5, best_within: step(8, iops, 4.5), crossed_at: step(16, iops, 9) },
    ],
});

test.describe('compare page: saturation tab', () => {
    test.skip(!admin, 'E2E_USER / E2E_PASSWORD not set');

    test('compares saturation points and highlights the best IOPS', async ({ page }) => {
        const thresholds: (string | null)[] = [];
        await page.route(/\/api\/test-runs\/saturation-runs/, (route) =>
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([satRun('run-a', 'zfs-host'), satRun('run-b', 'ceph-node1')]) }),
        );
        await page.route(/\/api\/saturation\/runs\/[^/]+\/summary/, (route) => {
            const url = new URL(route.request().url());
            thresholds.push(url.searchParams.get('threshold_ms'));
            const uuid = url.pathname.split('/')[4];
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(satSummary(uuid, uuid === 'run-a' ? 900 : 600)) });
        });

        await login(page, admin!);
        await page.goto('/compare?tab=saturation&r=run-a&r=run-b');
        await expect(page.getByRole('tab', { name: 'Saturation', selected: true })).toBeVisible();

        const table = page.getByRole('table', { name: 'Saturation comparison' });
        await expect(table).toContainText('QD 8 · 900 IOPS · P95 4.50 ms');
        await expect(table).toContainText('Crossed at QD 16');
        await expect(table.locator('[data-best="true"]')).toHaveCount(1);
        await expect(table.locator('[data-best="true"]')).toContainText('900 IOPS');
        expect(thresholds.every((value) => value === null)).toBe(true);

        const threshold = page.getByLabel('P95 threshold');
        await threshold.fill('3');
        await threshold.press('Enter');
        await expect(page).toHaveURL(/threshold=3/);
        await expect.poll(() => thresholds.at(-1)).toBe('3');
    });
});
