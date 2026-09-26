import { expect, test } from '@playwright/test';
import { adminCredentials, login } from './helpers';

const admin = adminCredentials();

test.describe('mobile layout', () => {
    test.skip(!admin, 'E2E_USER / E2E_PASSWORD not set');

    test('menu button reveals navigation and logout; no horizontal scroll', async ({ page }) => {
        await login(page, admin!);
        await page.getByRole('button', { name: 'Open menu' }).click();
        const nav = page.locator('#mobile-menu').getByRole('navigation', { name: 'Main' });
        await expect(nav.getByRole('link', { name: 'Hosts' })).toBeVisible();
        await expect(page.locator('#mobile-menu').getByRole('button', { name: 'Log out' })).toBeVisible();

        await nav.getByRole('link', { name: 'History' }).click();
        await expect(page.locator('#mobile-menu')).toHaveCount(0);

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBeLessThanOrEqual(1);
    });
});
