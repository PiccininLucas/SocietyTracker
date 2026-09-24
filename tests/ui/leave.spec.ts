import { test, expect, type Page } from '@playwright/test';

async function goal(page: Page, team: string, scorer: string) {
  await page.getByRole('button', { name: '+ Gol ' + team, exact: true }).click();
  await page.getByRole('button', { name: scorer + ' GOL' }).click();
  await page.getByRole('button', { name: 'Sem Assistência (Jogada Individual)' }).click();
}

/**
 * Sair do mesário sem deixar lances para trás: a navegação de baixo some durante a
 * partida, e com lance no aparelho o navegador pergunta antes de fechar. O banner das
 * outras páginas fica no Layout, que o harness não carrega (tests/pending-on-device).
 */
test('partida em andamento esconde a navegação, e lance pendente pergunta antes de sair', async ({
  page,
  context,
}) => {
  const dialogs: string[] = [];
  page.on('dialog', (d) => {
    dialogs.push(d.type());
    // "Ficar na página" no aviso de saída; os confirm() do mesário são aceitos.
    void (d.type() === 'beforeunload' ? d.dismiss() : d.accept());
  });
  await page.goto('/tests/ui/index.html?live&session=leave&undo=0');
  const nav = page.locator('#mobile-nav');
  const start = page.getByRole('button', { name: 'Iniciar partida', exact: true });
  const pendingNote = page.getByText(/Salvo no aparelho; será enviado/);
  await expect(start).toBeEnabled();
  await expect(nav).toBeVisible();

  await context.setOffline(true);
  await start.click();
  await expect(page.getByRole('heading', { name: 'Partida #1', exact: true })).toBeVisible();
  await expect(nav).toBeHidden();
  await goal(page, 'Time 0', 'Jogador 0');
  await expect(pendingNote).toBeVisible();

  // Com o início e o gol só no aparelho, fechar a aba pergunta antes.
  await page.close({ runBeforeUnload: true });
  await expect.poll(() => dialogs).toEqual(['beforeunload']);
  expect(page.isClosed()).toBe(false);

  // Com o sinal de volta a fila vai ao servidor. O segundo gol encerra a partida, e a
  // barra de baixo volta.
  await context.setOffline(false);
  await expect(pendingNote).toHaveCount(0, { timeout: 15000 });
  await goal(page, 'Time 0', 'Jogador 1');
  await expect(page.getByText(/Time 0 venceu · Regra dos dois gols/)).toBeVisible();
  await expect(nav).toBeVisible();
  await expect(pendingNote).toHaveCount(0, { timeout: 15000 });

  // Sem nada pendente, a aba fecha sem perguntar.
  const closed = page.waitForEvent('close');
  await page.close({ runBeforeUnload: true });
  await closed;
  expect(dialogs).toEqual(['beforeunload']);
});
