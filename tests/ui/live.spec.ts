import { test, expect } from '@playwright/test';
import { sid, teams } from './data';
test('fluxo completo com banco: zero, gol, recarga, edição, finalização, histórico e bloqueio', async ({
  page,
  context,
  request,
}) => {
  test.setTimeout(90000);
  page.on('dialog', (d) => void d.accept());
  await page.goto('/tests/ui/index.html?live');
  await page.getByRole('button', { name: 'Iniciar partida', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Partida #1', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Iniciar Cronômetro', exact: true }).click();
  await expect(page.getByText(/Tempo regulamentar encerrado/)).toBeVisible({ timeout: 7000 });
  await expect(page.getByRole('button', { name: '+ Gol Time 0', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '+ Gol Time 0', exact: true }).click();
  await page.getByRole('button', { name: 'Jogador 0 GOL' }).click();
  await page.getByRole('button', { name: 'Jogador 5 Passe' }).click();
  await expect(page.getByText('Assistência: Jogador 5', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('home-score')).toHaveText('1');
  await expect(page.getByText(/Tempo regulamentar encerrado/)).toBeVisible();
  await page.getByRole('button', { name: 'Editar gol de Jogador 0', exact: true }).click();
  await page.getByLabel('Assistência', { exact: true }).selectOption('');
  await page.getByRole('button', { name: 'Salvar correção' }).click();
  await expect(page.getByText('Sem assistência', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Remover gol', exact: true }).click();
  await expect(page.getByTestId('home-score')).toHaveText('0');
  // The network fails after an event is saved locally.
  await context.setOffline(true);
  await page.getByRole('button', { name: '+ Gol Time 1', exact: true }).click();
  await page.getByRole('button', { name: 'Jogador 6 GOL' }).click();
  await page.getByRole('button', { name: 'Sem Assistência (Jogada Individual)' }).click();
  await expect(page.getByTestId('away-score')).toHaveText('1');
  await expect(page.getByText(/operação está pendente/)).toBeVisible();
  await context.setOffline(false);
  await page.reload();
  await expect(page.getByTestId('away-score')).toHaveText('1');
  await expect(page.getByRole('button', { name: 'Remover gol', exact: true })).toBeEnabled();
  // Repeated clicks must produce one manual completion.
  await page.route(
    '**/api/matches/*/finish',
    async (route) => {
      const response = await route.fetch();
      expect(response.ok()).toBeTruthy();
      // Commit succeeds, but the browser never receives its acknowledgement.
      await route.abort('failed');
    },
    { times: 1 }
  );
  await page
    .getByRole('button', { name: 'Finalizar partida', exact: true })
    .evaluate((el: HTMLButtonElement) => {
      el.click();
      el.click();
    });
  await expect(page.getByText(/operação está pendente/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Iniciar partida', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Próximo confronto', exact: true })).toBeEnabled();
  let all = await (await request.get('/api/sessions/' + sid + '/matches')).json();
  expect(all).toHaveLength(1);
  expect(all[0].status).toBe('finished');
  expect(all[0].endReason).toBe('manual');
  const first = all[0];
  await page.screenshot({ path: 'test-results/mesario-mobile.png', fullPage: true });
  // Start and finish three more matches, including a two-goal victory and a draw.
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Próximo confronto', exact: true }).click();
    await page.getByRole('button', { name: 'Iniciar partida', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Partida #' + (i + 2), exact: true })
    ).toBeVisible();
    if (i === 0) {
      for (let goal = 0; goal < 2; goal++) {
        await page.getByRole('button', { name: '+ Gol Time 1', exact: true }).click();
        await page.getByRole('button', { name: 'Jogador 6 GOL' }).click();
        await page.getByRole('button', { name: 'Sem Assistência (Jogada Individual)' }).click();
        if (goal === 0)
          await expect(
            page.getByRole('button', { name: 'Remover gol', exact: true }).first()
          ).toBeEnabled();
      }
    } else await page.getByRole('button', { name: 'Finalizar partida', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Próximo confronto', exact: true })
    ).toBeEnabled();
  }
  all = await (await request.get('/api/sessions/' + sid + '/matches')).json();
  expect(all).toHaveLength(4);
  expect(all.find((m: { matchId: string }) => m.matchId === first.matchId).lockedAt).toBeTruthy();
  const blocked = await request.delete(
    '/api/matches/' + first.matchId + '/events/' + first.events[0].id
  );
  expect(blocked.status()).toBe(409);
  const third = page
    .getByRole('region', { name: 'Últimas três partidas' })
    .locator('details')
    .filter({ hasText: '#3 · Time 1 0 × 0 Time 0' });
  await third.locator('summary').click();
  await third.getByRole('button', { name: 'Corrigir placar' }).click();
  await page.getByLabel('Gols mandante').fill('1');
  await page.getByRole('button', { name: 'Salvar correção' }).click();
  const corrected = page
    .getByRole('region', { name: 'Últimas três partidas' })
    .locator('details')
    .filter({ hasText: '#3 · Time 1 1 × 0 Time 0' });
  await corrected.getByRole('button', { name: 'Editar gol de Autoria não informada' }).click();
  await page.getByLabel('Autor do gol', { exact: true }).selectOption(teams[1].players[1].id);
  await page.getByLabel('Assistência', { exact: true }).selectOption(teams[1].players[5].id);
  await page.getByRole('button', { name: 'Salvar correção' }).click();
  await expect(corrected.getByText('Assistência: Jogador 11', { exact: true })).toBeVisible();
  await expect(corrected.getByRole('button', { name: 'Remover gol', exact: true })).toBeEnabled();
  const standings = page.getByRole('region', { name: 'Tabela de classificação semanal' });
  await expect(standings.getByRole('row').filter({ hasText: 'Time 1' })).toContainText('10');
  await page.getByText('Retrospecto dos confrontos · mesma semana', { exact: true }).click();
  await expect(
    page.getByText('Time 0 × Time 1: 0 × 3 vitórias, 1 empate(s), 4 jogo(s), 0 × 4 gols.', {
      exact: true,
    })
  ).toBeVisible();
  await page.screenshot({ path: 'test-results/correcao-recente-mobile.png', fullPage: true });
  await page.goto('/tests/ui/index.html?stats');
  await expect(
    page.getByRole('region', { name: 'Desempenho individual da temporada' })
  ).toBeVisible();
  await expect(
    page
      .getByRole('row')
      .filter({ has: page.getByRole('rowheader', { name: 'Jogador 11', exact: true }) })
  ).toContainText('83.3%');
  await page.screenshot({ path: 'test-results/estatisticas-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Súmula #1', exact: true }).click();
  await expect(page.getByText(/Consolidada · somente leitura/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remover gol', exact: true })).toHaveCount(0);
  await page.screenshot({ path: 'test-results/historico-bloqueado-mobile.png', fullPage: false });
  await expect(page.getByRole('button', { name: 'Apagar partida', exact: true })).toHaveCount(0);
  expect((await request.delete('/api/matches/' + first.matchId)).status()).toBe(409);
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.getByRole('button', { name: 'Súmula #3', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Apagar partida', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/apagar-partida-mobile.png', fullPage: false });
  page.removeAllListeners('dialog');
  page.once('dialog', d => void d.dismiss());
  await page.getByRole('button', { name: 'Apagar partida', exact: true }).click();
  await expect(page.getByText('Assistência: Jogador 11', { exact: true })).toBeVisible();
  page.on('dialog', d => void d.accept());
  await page.getByRole('button', { name: 'Apagar partida', exact: true }).click();
  await expect(page.getByText('Partida apagada. Estatísticas atualizadas.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Súmula #3', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  await expect(page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'Jogador 11', exact: true }) })).toContainText('77.8%');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Súmula #4', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Súmula #3', exact: true })).toHaveCount(0);
  await page.goto('/tests/ui/index.html?live');
  await page.getByRole('button', { name: 'Iniciar partida', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Partida #5', exact: true })).toBeVisible();
  // Lost acknowledgement: the queued deletion survives reload and retries safely.
  await page.route('**/api/matches/*', async route => {
    if (route.request().method() !== 'DELETE') return route.continue();
    await route.fetch();
    await route.abort();
  });
  await page.getByRole('button', { name: 'Apagar partida', exact: true }).first().click();
  await expect(page.getByText(/A operação está pendente neste dispositivo/)).toBeVisible();
  await page.unroute('**/api/matches/*');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Partida #5', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Iniciar partida', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Iniciar partida', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Partida #6', exact: true })).toBeVisible();
});
