import { test, expect } from '@playwright/test';
import { rounds } from './data';

const round = rounds.close;

test('encerrar a rodada bloqueia partida nova, mantém a correção e pode ser desfeito', async ({
  page,
  request,
}) => {
  page.on('dialog', (d) => void d.accept());
  await page.goto('/tests/ui/index.html?live&session=close&undo=0');
  const close = page.getByRole('button', { name: 'Encerrar rodada', exact: true });
  await expect(close).toBeVisible();

  // Com partida em andamento o botão some: o servidor recusaria.
  await page.getByRole('button', { name: 'Iniciar partida', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Partida #1', exact: true })).toBeVisible();
  await expect(close).toHaveCount(0);
  await page.getByRole('button', { name: '+ Gol Time 0', exact: true }).click();
  await page.getByRole('button', { name: 'Jogador 0 GOL' }).click();
  await page.getByRole('button', { name: 'Sem Assistência (Jogada Individual)' }).click();
  await page.getByRole('button', { name: 'Finalizar partida', exact: true }).click();
  await expect(page.getByText(/Time 0 venceu/)).toBeVisible();
  await expect(page.getByText(/Salvo no aparelho; será enviado/)).toHaveCount(0);

  await close.click();
  const panel = page.getByRole('region', { name: 'Rodada encerrada' });
  await expect(panel).toBeVisible();
  await expect(page.getByRole('button', { name: 'Iniciar partida', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Próximo confronto', exact: true })).toHaveCount(0);
  await expect(page.getByText('rodada encerrada', { exact: false }).first()).toBeVisible();

  // O servidor recusa iniciar outra partida, mesmo por fora da tela.
  const refused = await request.post('/api/matches/start', {
    headers: { 'Idempotency-Key': crypto.randomUUID() },
    data: {
      sessionId: round.id,
      homeTeamId: round.teams[0].id,
      awayTeamId: round.teams[1].id,
    },
  });
  expect(refused.status()).toBe(409);
  expect((await refused.json()).error).toMatch(/Rodada encerrada/);

  // A última partida continua corrigível depois do encerramento.
  await page.getByText(/#1 · Time 0 1 × 0 Time 1/).click();
  await expect(
    page.getByRole('button', { name: 'Editar gol de Jogador 0', exact: true })
  ).toBeVisible();

  await panel.getByRole('button', { name: 'Reabrir rodada', exact: true }).click();
  await expect(panel).toHaveCount(0);
  await expect(close).toBeVisible();
  await page.getByRole('button', { name: 'Próximo confronto', exact: true }).click();
  await page.getByRole('button', { name: 'Iniciar partida', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Partida #2', exact: true })).toBeVisible();
});
