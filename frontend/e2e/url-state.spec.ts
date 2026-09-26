import { expect, test } from '@playwright/test';
import { adminCredentials, login } from './helpers';

const admin = adminCredentials();

test.describe('page state survives reloads (admin)', () => {
    test.skip(!admin, 'E2E_USER / E2E_PASSWORD not set');

    test.beforeEach(async ({ page }) => {
        await login(page, admin!);
    });

    test('host selection, view and filters are kept in the URL', async ({ page }) => {
        await page.goto('/host');
        await expect(page.getByRole('heading', { name: 'Pick hosts to start' })).toBeVisible();
        const firstHost = page.getByRole('group', { name: 'Quick pick a host' }).getByRole('button').first();
        const hostName = (await firstHost.textContent())?.trim() ?? '';
        await firstHost.click();

        await expect(page).toHaveURL(new RegExp(`hosts=${encodeURIComponent(hostName)}`));
        await page.getByRole('tab', { name: 'Radar' }).click();
        await expect(page).toHaveURL(/view=radar/);

        await page.reload();
        await expect(page.getByRole('tab', { name: 'Radar' })).toHaveAttribute('aria-selected', 'true');
        await expect(page).toHaveURL(new RegExp(`hosts=${encodeURIComponent(hostName)}`));
        await expect(page.getByRole('heading', { name: 'Pick hosts to start' })).toHaveCount(0);
    });

    test('unknown view in URL falls back to overview', async ({ page }) => {
        await page.goto('/host?view=bogus');
        await expect(page.getByRole('heading', { level: 1, name: 'Host Analysis' })).toBeVisible();
    });

    test('history loads data on first visit and keeps metric choice', async ({ page }) => {
        await page.goto('/history');
        await expect(page.locator('canvas').or(page.getByText('No test runs in this range'))).toBeVisible();
        await page.getByLabel('Bandwidth').click(); // URL-driven state updates asynchronously
        await expect(page.getByLabel('Bandwidth')).toBeChecked();
        await expect(page).toHaveURL(/metric=bandwidth/);
        await page.reload();
        await expect(page.getByLabel('Bandwidth')).toBeChecked();
    });

    test('history deep link from dashboard pre-selects the server', async ({ page }) => {
        await page.goto('/');
        await page.getByRole('link', { name: /^History for / }).first().click();
        await expect(page).toHaveURL(/\/history\?server=/);
        await expect(page.locator('#history-server')).not.toHaveValue('');
    });
});
