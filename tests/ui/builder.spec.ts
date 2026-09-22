import { test, expect } from '@playwright/test';

test('a montagem da rodada sobrevive à recarga e pode ser descartada', async ({ page }) => {
  page.on('dialog', (d) => void d.accept());
  await page.goto('/tests/ui/index.html?builder');
  const notes = page.getByPlaceholder('Ex: Rodada especial de fim de mês');
  await expect(page.getByText('0 escalados (24 livres)', { exact: true })).toBeVisible();
  await expect(page.getByText(/Montagem restaurada/)).toHaveCount(0);

  await notes.fill('Quadra 2');
  await page.getByRole('button', { name: 'Sortear Equilibrado' }).click();
  await expect(page.getByText('24 escalados (0 livres)', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText(/Montagem restaurada deste aparelho/)).toBeVisible();
  await expect(page.getByText('24 escalados (0 livres)', { exact: true })).toBeVisible();
  await expect(notes).toHaveValue('Quadra 2');

  await page.getByRole('button', { name: 'Descartar e começar do zero' }).click();
  await expect(page.getByText('0 escalados (24 livres)', { exact: true })).toBeVisible();
  await expect(notes).toHaveValue('');
  await expect(page.getByText(/Montagem restaurada/)).toHaveCount(0);

  // Montagem limpa não vira rascunho: nada para restaurar.
  await page.reload();
  await expect(page.getByText('0 escalados (24 livres)', { exact: true })).toBeVisible();
  await expect(page.getByText(/Montagem restaurada/)).toHaveCount(0);
});
