import { test, expect } from '@playwright/test';
test('production shell installs and reloads offline without caching API', async ({ page, context }) => {
  test.skip(process.env.PWA_TEST !== '1', 'Requires npm run start production server');
  await page.goto('/');
  await expect(page.getByRole('button', { name: '体验演示模式' })).toBeVisible();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: '欢迎来到 MengSign' })).toBeVisible();
  await context.setOffline(true); await page.reload();
  await expect(page.getByRole('button', { name: '体验演示模式' })).toBeVisible();
  await expect(page.getByRole('button', { name: '登录', exact: true })).toBeDisabled();
  const cacheUrls = await page.evaluate(async () => { const keys = await caches.keys(); return (await Promise.all(keys.map(async key => (await (await caches.open(key)).keys()).map(req => req.url)))).flat(); });
  expect(cacheUrls.some(url => url.includes('/api/'))).toBe(false);
  expect(cacheUrls.some(url => url.includes('/_next/static/'))).toBe(true);
});
