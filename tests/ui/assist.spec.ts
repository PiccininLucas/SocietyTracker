import { test, expect } from '@playwright/test';
import { teams } from './data';
for (const [width, height] of [
  [360, 640],
  [390, 844],
  [430, 740],
  [740, 360],
  [1280, 800],
]) {
  test(
    'última assistência alcançável e salva pelo ID em ' + width + 'x' + height,
    async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/tests/ui/index.html');
      await page.getByRole('button', { name: 'Jogador 0 GOL' }).click();
      const last = page.getByRole('button', { name: 'Jogador 5 Passe' });
      await last.scrollIntoViewIfNeeded();
      await expect(last).toBeInViewport();
      expect(
        await last.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
        })
      ).toBe(true);
      await last.click();
      await expect(page.locator('output')).toContainText(
        '"assistId":"' + teams[0].players[5].id + '"'
      );
      await expect(page.locator('output')).toContainText('"assistName":"Jogador 5"');
    }
  );
}
test('sem assistência, lista unitária, lista vazia e exclusão do próprio autor', async ({
  page,
}) => {
  await page.goto('/tests/ui/index.html?players=1');
  await page.getByRole('button', { name: 'Jogador 0 GOL' }).click();
  await expect(page.getByRole('button', { name: /Passe/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Sem Assistência (Jogada Individual)' }).click();
  await expect(page.locator('output')).toContainText('"assistId":null');
  await page.goto('/tests/ui/index.html?players=0');
  await expect(page.getByText('Nenhum jogador escalado neste time.')).toBeVisible();
  await page.getByRole('button', { name: 'Registrar Gol Contra (Adversário)' }).click();
  await expect(page.locator('output')).toContainText('"isOwnGoal":true');
});
