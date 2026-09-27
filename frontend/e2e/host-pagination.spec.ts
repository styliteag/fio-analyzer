import { expect, test } from '@playwright/test';
import { adminCredentials, login } from './helpers';

const admin = adminCredentials();

const run = (id: number, blockSize: string, sync = 'sync') => ({
    id,
    timestamp: '2026-09-01T10:00:00+00:00',
    hostname: 'paged-host',
    protocol: 'NVMe',
    drive_type: 'SSD',
    drive_model: 'Model P',
    block_size: blockSize,
    read_write_pattern: 'randread',
    queue_depth: 1,
    iops: 1000 + id,
    avg_latency: 1,
    bandwidth: 100,
    p95_latency: 2,
    p99_latency: 3,
    sync,
});

test.describe('host analysis loads every page of test runs', () => {
    test.skip(!admin, 'E2E_USER / E2E_PASSWORD not set');

    test('hosts with more rows than one API page are not truncated', async ({ page }) => {
        const offsets: string[] = [];
        await page.route('**/api/test-runs?*', async (route) => {
            const url = new URL(route.request().url());
            if (url.searchParams.get('hostnames') !== 'paged-host') return route.continue();
            const offset = url.searchParams.get('offset') ?? '0';
            offsets.push(offset);
            const body =
                offset === '0'
                    ? { data: [run(1, '4K'), run(2, '8K')], total: 3, limit: 2, offset: 0, has_more: true }
                    : { data: [run(3, '64K')], total: 3, limit: 2, offset: 2, has_more: false };
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
        });

        await login(page, admin!);
        await page.goto('/host?hosts=paged-host');

        await expect(page.getByText('Total Tests').locator('..')).toContainText('3');
        expect(new Set(offsets)).toEqual(new Set(['0', '2'])); // StrictMode may load twice in dev
    });
});

test.describe('sync mode filter', () => {
    test.skip(!admin, 'E2E_USER / E2E_PASSWORD not set');

    test('shows none, sync and dsync as separate named options', async ({ page }) => {
        await page.route('**/api/test-runs?*', async (route) => {
            const url = new URL(route.request().url());
            if (url.searchParams.get('hostnames') !== 'sync-host') return route.continue();
            const data = [run(1, '4K', 'none'), run(2, '4K', 'sync'), run(3, '4K', 'dsync')].map((r) => ({ ...r, hostname: 'sync-host' }));
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ data, total: 3, limit: 10000, offset: 0, has_more: false }),
            });
        });

        await login(page, admin!);
        await page.goto('/host?hosts=sync-host');

        const section = page.getByText('Sync Mode', { exact: true }).locator('..');
        await expect(section).toContainText('None');
        await expect(section).toContainText('Sync (O_SYNC)');
        await expect(section).toContainText('DSync (O_DSYNC)');
    });
});
