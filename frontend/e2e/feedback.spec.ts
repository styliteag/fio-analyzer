import { expect, test } from '@playwright/test';
import { adminCredentials, login, uploaderCredentials } from './helpers';

const admin = adminCredentials();
const uploader = uploaderCredentials();

test.describe('upload feedback', () => {
    test.skip(!admin, 'E2E_USER / E2E_PASSWORD not set');

    test('rejects non-JSON files with a toast instead of an alert', async ({ page }) => {
        let dialogShown = false;
        page.on('dialog', async (dialog) => {
            dialogShown = true;
            await dialog.dismiss();
        });
        await login(page, admin!);
        await page.goto('/upload');
        await page.setInputFiles('#file-input', { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
        await expect(page.getByRole('alert')).toContainText('is not a JSON file');
        expect(dialogShown).toBe(false);
    });

    test('shows the server reason when an import fails', async ({ page }) => {
        await login(page, admin!);
        await page.route('**/api/import', (route) =>
            route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ detail: 'Invalid JSON format: test' }) }),
        );
        await page.goto('/upload');
        await page.setInputFiles('#file-input', { name: 'r.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
        await page.getByRole('button', { name: 'Import results' }).click();
        await expect(page.getByRole('alert')).toContainText('Invalid JSON format: test');
        await expect(page.getByText('was imported')).toHaveCount(0);
    });
});

test.describe('uploader role', () => {
    test.skip(!uploader, 'E2E_UPLOADER_USER / E2E_UPLOADER_PASSWORD not set');

    test('sees only Upload and is redirected there', async ({ page }) => {
        await login(page, uploader!);
        await expect(page).toHaveURL(/\/upload$/);
        const nav = page.getByRole('navigation', { name: 'Main' });
        await expect(nav.getByRole('link')).toHaveCount(1);
        await page.goto('/admin');
        await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();
    });
});
