import { expect, test } from '@playwright/test';
import { adminCredentials, login } from './helpers';

const admin = adminCredentials();

test.describe('browser session', () => {
    test.skip(!admin, 'E2E_USER and E2E_PASSWORD are required');

    test('keeps no password in the browser and survives a reload', async ({ page, context }) => {
        await login(page, admin!);
        const stored = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
        expect(stored).not.toContain(admin!.password);
        const cookie = (await context.cookies()).find((c) => c.name === 'fio_session');
        expect(cookie?.httpOnly).toBe(true);
        expect(cookie?.sameSite).toBe('Strict');
        await page.reload();
        await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();
    });

    test('log out ends the session on the server', async ({ page, context }) => {
        await login(page, admin!);
        const cookie = (await context.cookies()).find((c) => c.name === 'fio_session');
        await page.getByRole('button', { name: 'Log out' }).click();
        await expect(page.locator('#username')).toBeVisible();
        // Replaying the old cookie must not work any more
        await context.addCookies([{ ...cookie!, expires: -1 }]);
        const status = await page.evaluate(async () => (await fetch('/api/users/me')).status);
        expect(status).toBe(401);
    });
});
