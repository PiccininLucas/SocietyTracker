import { test, expect } from '@playwright/test';

test('totais acumulados no celular preservam zero sem expor detalhes da migração', async ({ page }) => {
  await page.goto('/tests/ui/index.html?historical');
  await expect(page.getByText(/totais antigos|jogos antigos|inclui totais/i)).toHaveCount(0);
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
