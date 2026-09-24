import { test, expect, type Page } from '@playwright/test';

/**
 * Alvos de toque e campos no celular (360 × 640, o viewport padrão da config).
 *
 * - Todo botão, link e campo visível tem ao menos 44 × 44 px. Checkbox e radio contam
 *   pelo `<label>` que os envolve, que é onde o dedo toca.
 * - Todo campo de texto, número, data e select tem fonte de ao menos 16 px: abaixo
 *   disso o Safari do iPhone dá zoom na página ao focar o campo.
 *
 * Elementos do próprio harness (fora do app) levam `data-audit-skip`.
 */
async function offenders(page: Page) {
  return page.evaluate(() => {
    const found: string[] = [];
    const selector =
      'button, a[href], select, textarea, summary, [role="button"], input:not([type="hidden"])';
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
      if (el.closest('[data-audit-skip]')) continue;
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none') continue;
      const toggle = el.matches('input[type="checkbox"], input[type="radio"]');
      const target = toggle ? (el.closest('label') ?? el) : el;
      // Tamanho de layout, sem transform: os modais entram com scale(0.95), e o
      // getBoundingClientRect mediria a animação em vez do botão.
      const box = { width: target.offsetWidth, height: target.offsetHeight };
      if (!box.width && !box.height) continue;
      const name = (
        el.getAttribute('aria-label') ||
        el.getAttribute('title') ||
        el.getAttribute('placeholder') ||
        el.textContent ||
        el.tagName
      )
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 40);
      const tag = el.tagName.toLowerCase();
      if (box.height < 43.5 || box.width < 43.5)
        found.push(`${tag} "${name}": ${Math.round(box.width)}×${Math.round(box.height)}`);
      if (!toggle && el.matches('input, select, textarea') && parseFloat(style.fontSize) < 16)
        found.push(`${tag} "${name}": fonte ${style.fontSize}`);
    }
    return [...new Set(found)];
  });
}

test('montador de times: presença, escalação, avulso e edição', async ({ page }) => {
  await page.goto('/tests/ui/index.html?builder');
  await page.getByRole('button', { name: 'Sortear Equilibrado' }).click();
  // Deixa alguém livre para aparecer no banco de disponíveis, com os botões "+".
  await page
    .getByRole('button', { name: /^Remover .+ do time$/ })
    .first()
    .click();
  expect.soft(await offenders(page)).toEqual([]);

  await page.getByRole('button', { name: 'Novo Avulso' }).click();
  expect.soft(await offenders(page)).toEqual([]);
  await page.getByRole('button', { name: 'Cancelar' }).click();

  await page
    .getByRole('button', { name: /^Editar Jogador/ })
    .first()
    .click();
  expect.soft(await offenders(page)).toEqual([]);
});

test('mesário: confronto, placar, gaveta, correção, times e desfazer', async ({ page }) => {
  page.on('dialog', (d) => void d.accept());
  await page.goto('/tests/ui/index.html?live&session=touch&undo=60000');
  await expect(page.getByRole('button', { name: 'Iniciar partida', exact: true })).toBeEnabled();
  expect.soft(await offenders(page)).toEqual([]);

  await page.getByRole('button', { name: 'Iniciar partida', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Partida #1', exact: true })).toBeVisible();
  expect.soft(await offenders(page)).toEqual([]);

  await page.getByRole('button', { name: '+ Gol Time 0', exact: true }).click();
  expect.soft(await offenders(page)).toEqual([]);
  await page.getByRole('button', { name: /Jogador Emprestado/ }).click();
  expect.soft(await offenders(page)).toEqual([]);
  await page.getByRole('button', { name: 'Voltar' }).click();
  await page.getByRole('button', { name: 'Jogador 0 GOL' }).click();
  await page.getByRole('button', { name: 'Sem Assistência (Jogada Individual)' }).click();
  // Toast do "Desfazer" aberto (janela longa nesta spec).
  await expect(page.getByRole('button', { name: 'Desfazer', exact: true })).toBeVisible();
  expect.soft(await offenders(page)).toEqual([]);
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click();

  // A correção só aparece depois do envio: o mesmo gol, agora sem janela de desfazer.
  await page.goto('/tests/ui/index.html?live&session=touch&undo=0');
  await page.getByRole('button', { name: '+ Gol Time 0', exact: true }).click();
  await page.getByRole('button', { name: 'Jogador 0 GOL' }).click();
  await page.getByRole('button', { name: 'Sem Assistência (Jogada Individual)' }).click();
  await page.getByRole('button', { name: 'Editar gol de Jogador 0', exact: true }).click();
  expect.soft(await offenders(page)).toEqual([]);
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();

  await page.getByRole('button', { name: 'Ver times', exact: true }).click();
  expect.soft(await offenders(page)).toEqual([]);
  await page.keyboard.press('Escape');
});

test('mesário: editar times da noite', async ({ page }) => {
  await page.goto('/tests/ui/index.html?live&session=touchTeams');
  await page.getByRole('button', { name: 'Editar times', exact: true }).click();
  expect.soft(await offenders(page)).toEqual([]);
  await page.getByRole('button', { name: 'Adicionar Atleta' }).first().click();
  expect.soft(await offenders(page)).toEqual([]);
});

test('classificação, súmula, relatórios e PIN', async ({ page }) => {
  await page.goto('/tests/ui/index.html?stats');
  await expect(page.getByRole('table').first()).toBeVisible();
  expect.soft(await offenders(page)).toEqual([]);

  await page.goto('/tests/ui/index.html?reports');
  await expect(page.getByText('Carregando relatórios…')).toHaveCount(0);
  expect.soft(await offenders(page)).toEqual([]);

  await page.goto('/tests/ui/index.html?pin');
  expect.soft(await offenders(page)).toEqual([]);
});
