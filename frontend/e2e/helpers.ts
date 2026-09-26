import { expect, type Page } from '@playwright/test';

export interface Credentials {
    readonly user: string;
    readonly password: string;
}

export const adminCredentials = (): Credentials | null =>
    process.env.E2E_USER && process.env.E2E_PASSWORD ? { user: process.env.E2E_USER, password: process.env.E2E_PASSWORD } : null;

export const uploaderCredentials = (): Credentials | null =>
    process.env.E2E_UPLOADER_USER && process.env.E2E_UPLOADER_PASSWORD
        ? { user: process.env.E2E_UPLOADER_USER, password: process.env.E2E_UPLOADER_PASSWORD }
        : null;

export const login = async (page: Page, credentials: Credentials): Promise<void> => {
    await page.goto('/');
    await page.fill('#username', credentials.user);
    await page.fill('#password', credentials.password);
    await page.click('button[type=submit]');
    await expect(page.getByRole('banner')).toBeVisible();
};

/** Collect uncaught page errors so tests can assert a page rendered cleanly */
export const trackPageErrors = (page: Page): string[] => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    return errors;
};
