import { test, expect } from '@playwright/test';

test('totais antigos no celular preservam zero e mostram jogos desconhecidos', async ({ page }) => {
  await page.goto('/tests/ui/index.html?historical');
  await expect(page.getByText('A quantidade de jogos antigos não foi informada', { exact: false })).toBeVisible();
  const scorer = page.getByRole('row').filter({ hasText: 'Barbaroto' });
  await expect(scorer.getByRole('cell').nth(0)).toHaveText('—');
  await expect(scorer.getByRole('cell').nth(5)).toHaveText('64');
  const zero = page.getByRole('row').filter({ hasText: 'Caio' });
  await expect(zero.getByRole('cell').nth(0)).toHaveText('—');
  await expect(zero.getByRole('cell').nth(6)).toHaveText('0');
  await expect(zero.getByRole('cell').last()).toHaveText('1');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/historical-mobile.png' });
});
