import { test, expect } from '@playwright/test';

const url = '/tests/ui/index.html?live&session=tabs';
const notice = /aberto em outra aba ou janela/;

test('só uma aba registra lances; a outra consulta e assume quando pedida ou quando a dona fecha', async ({
  context,
}) => {
  const first = await context.newPage();
  await first.goto(url);
  await expect(first.getByRole('button', { name: 'Iniciar partida', exact: true })).toBeEnabled();

  const second = await context.newPage();
  await second.goto(url);
  await expect(second.getByText(notice)).toBeVisible();
  await expect(second.getByRole('button', { name: 'Iniciar partida', exact: true })).toHaveCount(0);

  await second.getByRole('button', { name: 'Usar nesta aba', exact: true }).click();
  await expect(second.getByText(notice)).toHaveCount(0);
  await expect(first.getByText(notice)).toBeVisible();
  await second.getByRole('button', { name: 'Iniciar partida', exact: true }).click();
  await expect(second.getByRole('heading', { name: 'Partida #1', exact: true })).toBeVisible();

  // Ao fechar a dona, a outra aba assume sozinha e relê a fila salva no aparelho.
  await second.close();
  await expect(first.getByText(notice)).toHaveCount(0);
  await expect(first.getByRole('heading', { name: 'Partida #1', exact: true })).toBeVisible();
});
