import { test, expect } from '@playwright/test';

/**
 * Editor de times da noite com as regras do montador (teamRules.ts). A rodada `touchTeams`
 * tem 6 jogadores por time, sem capitão, e o "Avulso Único" fora dos times. Nada aqui
 * chega a salvar: a rodada continua igual para as outras specs.
 */
test('editor do mesário: teto de 6 no ato e capitão obrigatório para salvar', async ({ page }) => {
  const saves: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'PUT' && r.url().includes('/teams')) saves.push(r.url());
  });
  await page.goto('/tests/ui/index.html?live&session=touchTeams');
  await page.getByRole('button', { name: 'Editar times', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Editar times da rodada' });

  await dialog.getByRole('button', { name: 'Adicionar Atleta' }).first().click();
  await dialog.getByRole('button', { name: 'Avulso Único' }).click();
  await expect(dialog.getByRole('alert')).toHaveText(
    'Time 0 já está completo com 6 jogadores. Tire alguém antes de adicionar outro.'
  );
  await expect(dialog.getByRole('button', { name: 'Remover Avulso Único do time' })).toHaveCount(0);

  // Mover para um time cheio também é recusado, e o jogador fica onde estava.
  await dialog.getByLabel('Mover Jogador 0 para outro time').selectOption({ label: 'Time 1' });
  await expect(dialog.getByRole('alert')).toHaveText(
    'Time 1 já está completo com 6 jogadores. Tire alguém antes de adicionar outro.'
  );
  await expect(dialog.getByLabel('Mover Jogador 0 para outro time')).toBeVisible();

  await expect(dialog.getByText('Sem capitão: marque a ⭐ de um jogador')).toHaveCount(4);
  await dialog.getByRole('button', { name: 'Salvar Alterações' }).click();
  await expect(dialog.getByRole('alert')).toHaveText(
    'Defina um capitão para cada time antes de salvar. Sem capitão: Time 0, Time 1, Time 2, Time 3.'
  );
  expect(saves).toEqual([]);
});
