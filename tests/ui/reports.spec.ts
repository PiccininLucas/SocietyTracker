import { test, expect } from '@playwright/test';
test('relatório anual, todo o histórico e erro de rede no celular', async ({ page }) => {
  await page.goto('/tests/ui/index.html?reports');
  await page.getByRole('button', { name: '🏆 Temporada', exact: true }).click();
  await expect(page.getByLabel('Temporada do relatório')).toHaveValue('2026');
  await expect(page.getByText('Temporada 2026', { exact: true })).toBeVisible();
  await page.getByLabel('Temporada do relatório').selectOption('all');
  await expect(page.getByText('Todo o histórico', { exact: true }).last()).toBeVisible();
  await page.screenshot({ path: 'test-results/relatorios-mobile.png' });
  await page.route('**/api/reports/period*', (route) => route.abort(), { times: 1 });
  await page.getByLabel('Temporada do relatório').selectOption('2026');
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await expect(page.getByText('Temporada 2026', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
});
