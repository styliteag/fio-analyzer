import { expect, test } from '@playwright/test';
import { adminCredentials, login } from './helpers';

const admin = adminCredentials();

test.describe('dashboard statistics', () => {
    test.skip(!admin, 'E2E_USER / E2E_PASSWORD not set');

    test('uses the aggregated stats endpoint instead of downloading test runs', async ({ page }) => {
        const requested: string[] = [];
        page.on('request', (request) => {
            const path = new URL(request.url()).pathname;
            if (path.startsWith('/api/')) requested.push(path);
        });

        await login(page, admin!);
        await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
        await expect(page.getByText('Test runs').locator('..')).not.toContainText('---');

        expect(requested).toContain('/api/dashboard/stats');
        expect(requested.filter((path) => path.startsWith('/api/test-runs'))).toEqual([]);
    });
});
