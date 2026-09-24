import { test, expect, type Page } from '@playwright/test';
import { rounds } from './data';

interface Summary {
  sequence: number;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  status: string;
  endReason: string | null;
}
const pendingNote = (page: Page) => page.getByText(/Salvo no aparelho; será enviado/);

async function goal(page: Page, team: string, scorer: string) {
  await page.getByRole('button', { name: '+ Gol ' + team, exact: true }).click();
  await page.getByRole('button', { name: scorer + ' GOL' }).click();
  await page.getByRole('button', { name: 'Sem Assistência (Jogada Individual)' }).click();
}

test('sem sinal: inicia, fecha pelos dois gols, encadeia o próximo jogo e sincroniza ao voltar', async ({
  page,
  context,
  request,
}) => {
  const round = rounds.offline;
  page.on('dialog', (d) => void d.accept());
  await page.goto('/tests/ui/index.html?live&session=offline');
  await expect(page.getByRole('button', { name: 'Iniciar partida', exact: true })).toBeEnabled();

  await context.setOffline(true);
  // O id da partida nasce no aparelho: sem rede, ela começa e recebe lances mesmo assim.
  await page.getByRole('button', { name: 'Iniciar partida', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Partida #1', exact: true })).toBeVisible();
  await goal(page, 'Time 0', 'Jogador 0');
  await goal(page, 'Time 0', 'Jogador 1');
  await expect(page.getByText(/Time 0 venceu · Regra dos dois gols/)).toBeVisible();

  // Quem vence fica; entra quem espera há mais tempo (Time 2 ainda não jogou).
  await page.getByRole('button', { name: 'Próximo confronto', exact: true }).click();
  await expect(page.getByLabel('Time 1', { exact: true })).toHaveValue(round.teams[0].id);
  await expect(page.getByLabel('Time 2', { exact: true })).toHaveValue(round.teams[2].id);
  await page.getByRole('button', { name: 'Iniciar partida', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Partida #2', exact: true })).toBeVisible();
  await goal(page, 'Time 2', 'Jogador 12');
  await expect(page.getByTestId('away-score')).toHaveText('1');
  await expect(pendingNote(page)).toBeVisible();
  expect(await (await request.get('/api/sessions/' + round.id + '/matches')).json()).toEqual([]);

  // A volta da rede dispara o reenvio da fila inteira, em ordem.
  await context.setOffline(false);
  await expect(pendingNote(page)).toHaveCount(0, { timeout: 15000 });
  const all = (
    (await (await request.get('/api/sessions/' + round.id + '/matches')).json()) as Summary[]
  )
    .map((m) => [
      m.sequence,
      m.homeTeamName,
      m.homeScore,
      m.awayScore,
      m.awayTeamName,
      m.status,
      m.endReason,
    ])
    .sort((a, b) => Number(a[0]) - Number(b[0]));
  expect(all).toEqual([
    [1, 'Time 0', 2, 0, 'Time 1', 'finished', 'two_goals'],
    [2, 'Time 0', 0, 1, 'Time 2', 'ongoing', null],
  ]);
});

test('falha transitória do servidor é reenviada sozinha, sem tocar em nada', async ({
  page,
  request,
}) => {
  const round = rounds.retry;
  await page.goto('/tests/ui/index.html?live&session=retry');
  await page.getByRole('button', { name: 'Iniciar partida', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Partida #1', exact: true })).toBeVisible();
  await expect(pendingNote(page)).toHaveCount(0);

  let calls = 0;
  await page.route('**/api/matches/*/goals', (route) =>
    calls++ === 0
      ? route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Servidor indisponível no momento.' }),
        })
      : route.continue()
  );
  await goal(page, 'Time 0', 'Jogador 0');
  await expect(page.getByText(/Nova tentativa automática em \d+s/)).toBeVisible();
  await expect(pendingNote(page)).toHaveCount(0, { timeout: 15000 });
  expect(calls).toBe(2);
  const [match] = (await (
    await request.get('/api/sessions/' + round.id + '/matches')
  ).json()) as Summary[];
  expect([match.homeScore, match.awayScore]).toEqual([1, 0]);
});
