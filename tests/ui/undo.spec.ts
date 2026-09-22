import { test, expect, type Page } from '@playwright/test';
import { rounds } from './data';

interface Summary {
  status: string;
  homeScore: number;
  awayScore: number;
  events: unknown[];
}
const round = rounds.undo;
const serverMatch = async (request: import('@playwright/test').APIRequestContext) =>
  ((await (await request.get('/api/sessions/' + round.id + '/matches')).json()) as Summary[])[0];

async function goal(page: Page, team: string, scorer: string) {
  await page.getByRole('button', { name: '+ Gol ' + team, exact: true }).click();
  await page.getByRole('button', { name: scorer + ' GOL' }).click();
  await page.getByRole('button', { name: 'Sem Assistência (Jogada Individual)' }).click();
}

test('desfazer tira o gol antes de ir ao servidor, inclusive o da vitória e o gol contra', async ({
  page,
  request,
}) => {
  test.setTimeout(60000);
  page.on('dialog', (d) => void d.accept());
  await page.goto('/tests/ui/index.html?live&session=undo&undo=4000');
  await page.getByRole('button', { name: 'Iniciar partida', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Partida #1', exact: true })).toBeVisible();
  const pending = page.getByText(/Salvo no aparelho; será enviado/);
  await expect(pending).toHaveCount(0);

  // Gol comum desfeito: o servidor nunca o recebe.
  await goal(page, 'Time 0', 'Jogador 0');
  await expect(page.getByTestId('home-score')).toHaveText('1');
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
  await expect(page.getByTestId('home-score')).toHaveText('0');
  await expect(page.getByText('Gol desfeito.', { exact: true })).toBeVisible();
  await expect(pending).toHaveCount(0);
  expect((await serverMatch(request)).events).toHaveLength(0);

  // Sem desfazer, o gol vai depois da janela.
  await goal(page, 'Time 0', 'Jogador 0');
  await expect(page.getByRole('button', { name: 'Desfazer', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Desfazer', exact: true })).toHaveCount(0, {
    timeout: 8000,
  });
  await expect(pending).toHaveCount(0, { timeout: 8000 });
  expect((await serverMatch(request)).homeScore).toBe(1);

  // Gol da vitória desfeito: a partida volta a ficar em andamento.
  await goal(page, 'Time 0', 'Jogador 1');
  await expect(page.getByText(/Time 0 venceu · Regra dos dois gols/)).toBeVisible();
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
  await expect(page.getByTestId('home-score')).toHaveText('1');
  await expect(page.getByRole('button', { name: '+ Gol Time 0', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Finalizar partida', exact: true })).toBeEnabled();

  // Gol contra (um toque só) também pode ser desfeito.
  await page.getByRole('button', { name: '+ Gol Time 1', exact: true }).click();
  await page.getByRole('button', { name: /^Gol Contra/ }).click();
  await expect(page.getByText('Gol contra registrado', { exact: true })).toBeVisible();
  await expect(page.getByTestId('away-score')).toHaveText('1');
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
  await expect(page.getByTestId('away-score')).toHaveText('0');

  await expect(pending).toHaveCount(0);
  const match = await serverMatch(request);
  expect([match.status, match.homeScore, match.awayScore]).toEqual(['ongoing', 1, 0]);
  expect(match.events).toHaveLength(1);
});
