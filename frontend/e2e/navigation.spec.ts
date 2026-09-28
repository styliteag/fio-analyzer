import { expect, test } from '@playwright/test';
import { adminCredentials, login, trackPageErrors } from './helpers';

const admin = adminCredentials();

const PAGES = [
    { path: '/', link: 'Dashboard', heading: 'Dashboard' },
    { path: '/host', link: 'Hosts', heading: 'Host Analysis' },
    { path: '/history', link: 'History', heading: 'Performance History' },
    { path: '/saturation', link: 'Saturation', heading: 'Saturation Analysis' },
    { path: '/compare', link: 'Compare', heading: 'Compare Storage' },
    { path: '/upload', link: 'Upload', heading: 'Upload FIO Results' },
    { path: '/admin', link: 'Admin', heading: 'Admin' },
    { path: '/users', link: 'Users', heading: 'User Management' },
] as const;

test.describe('navigation (admin)', () => {
    test.skip(!admin, 'E2E_USER / E2E_PASSWORD not set');

    test.beforeEach(async ({ page }) => {
        await login(page, admin!);
    });

    test('header links reach every page and mark the active one', async ({ page }) => {
        const errors = trackPageErrors(page);
        const nav = page.getByRole('navigation', { name: 'Main' });

        for (const { path, link, heading } of PAGES) {
            await nav.getByRole('link', { name: link, exact: true }).click();
            await expect(page).toHaveURL(new RegExp(`${path === '/' ? '/$' : path}`));
            await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
            await expect(nav.getByRole('link', { name: link, exact: true })).toHaveAttribute('aria-current', 'page');
        }
        expect(errors).toEqual([]);
    });

    test('same header and footer on every page', async ({ page }) => {
        for (const { path } of PAGES) {
            await page.goto(path);
            await expect(page.getByRole('banner')).toHaveCount(1);
            await expect(page.getByRole('contentinfo')).toHaveCount(1);
            await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();
        }
    });

    test('unknown route shows not-found page with a way back', async ({ page }) => {
        await page.goto('/does-not-exist');
        await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
        await page.getByRole('link', { name: 'Go to Dashboard' }).click();
        await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
    });

    test('dashboard task cards deep-link without full reload', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => ((window as unknown as { __marker: number }).__marker = 1));
        await page.getByRole('link', { name: /Compare hosts/ }).click();
        await expect(page).toHaveURL(/\/host$/);
        expect(await page.evaluate(() => (window as unknown as { __marker?: number }).__marker)).toBe(1);
    });
});

test.describe('admin page (admin)', () => {
    test.skip(!admin, 'E2E_USER / E2E_PASSWORD not set');

    test('defaults to Latest Runs and keeps tab + search in the URL', async ({ page }) => {
        await login(page, admin!);
        await page.goto('/admin');
        await expect(page.getByRole('tab', { selected: true })).toContainText('Latest');
        await page.getByRole('tab', { name: /History/ }).click();
        await expect(page).toHaveURL(/tab=history/);
        await page.getByLabel('Search test runs').fill('sim-db');
        await expect(page).toHaveURL(/q=sim-db/);
        await page.reload();
        await expect(page.getByRole('tab', { selected: true })).toContainText('History');
        await expect(page.getByLabel('Search test runs')).toHaveValue('sim-db');
    });
});
