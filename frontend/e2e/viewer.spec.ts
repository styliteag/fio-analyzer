import { expect, test } from '@playwright/test';
import { login, trackPageErrors, viewerCredentials } from './helpers';

const viewer = viewerCredentials();

test.describe('viewer role (read-only)', () => {
    test.skip(!viewer, 'E2E_VIEWER_USER / E2E_VIEWER_PASSWORD not set');

    test('sees the analysis pages but no upload or management', async ({ page }) => {
        const errors = trackPageErrors(page);
        await login(page, viewer!);
        await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();

        const nav = page.getByRole('navigation', { name: 'Main' });
        await expect(nav.getByRole('link')).toHaveText(['Dashboard', 'Hosts', 'History', 'Saturation', 'Compare']);
        await expect(page.getByRole('link', { name: /Add results/ })).toHaveCount(0);

        for (const path of ['/upload', '/admin', '/users']) {
            await page.goto(path);
            await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();
        }

        await page.goto('/history');
        await expect(page.locator('canvas').or(page.getByText('No test runs in this range'))).toBeVisible();
        expect(errors).toEqual([]);
    });

    test('is not logged out when the API refuses a write', async ({ page }) => {
        await login(page, viewer!);
        const status = await page.evaluate(async () => {
            const { credentials } = JSON.parse(localStorage.getItem('fio-auth') ?? '{}');
            const response = await fetch('/api/test-runs/1', { method: 'DELETE', headers: { Authorization: `Basic ${credentials}` } });
            return response.status;
        });
        expect(status).toBe(403);
        await page.reload();
        await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
    });
});
