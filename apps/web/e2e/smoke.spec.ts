import { expect, test } from '@playwright/test';

/**
 * Frontend smoke test — the browser-side counterpart to the server smoke
 * test. Run after bumping frontend packages (TanStack Start/Router/Query,
 * Vite, oRPC client, Tailwind, ...) to confirm the app still renders and the
 * full frontend → oRPC → backend round-trip works.
 *
 * Read-only on purpose: it never mutates data, so it's safe against the
 * shared dev/prod stage.
 */

test.describe('Smoke tests', () => {
  test('homepage renders and the API round-trip works', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/tanstack/i);

    // All four system-status cards render (proves SSR + hydration).
    for (const name of [
      'API Connection',
      'KV Storage',
      'D1 Database',
      'R2 Storage',
    ]) {
      await expect(page.getByText(name, { exact: true })).toBeVisible();
    }

    // At least one health check resolves to "Healthy" — proves the full
    // frontend → oRPC client → TanStack Query → Hono backend chain is intact.
    // We don't assert all four, since R2 may be unconfigured on a given stage.
    await expect(page.getByText('Healthy').first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('playground renders its example cards', async ({ page }) => {
    await page.goto('/playground');
    await expect(page.getByText('User Management')).toBeVisible();
    await expect(page.getByText('R2 Storage')).toBeVisible();
    await expect(page.getByText('Server Side Rendering')).toBeVisible();
  });
});
