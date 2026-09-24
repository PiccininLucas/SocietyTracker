import { test, expect, type Page } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';

/**
 * O public/sw.js de verdade, num navegador de verdade, contra um servidor mínimo: cada
 * página diz quantas vezes o servidor a gerou, e assim o teste sabe se a resposta veio da
 * rede ou do cache do aparelho.
 */
const SW = readFileSync('public/sw.js', 'utf8');
let server: Server;
let origin = '';
let hits: Record<string, number> = {};
let broken = false;
let slow = false;

const html = (title: string, n: number) => `<!doctype html><html><head><title>${title}</title>
<link rel="stylesheet" href="/_astro/app.css"></head><body><h1>${title} #${n}</h1>
<script type="module">
  const first = !navigator.serviceWorker.controller;
  navigator.serviceWorker.register('/sw.js').then(() => navigator.serviceWorker.ready).then((r) => {
    if (first) r.active.postMessage({ type: 'cache-page', url: location.href,
      assets: performance.getEntriesByType('resource').map((e) => e.name) });
  });
</script></body></html>`;

test.beforeAll(async () => {
  server = createServer((req, res) => {
    const path = new URL(req.url ?? '/', 'http://x').pathname;
    const n = (hits[path] = (hits[path] ?? 0) + 1);
    if (path === '/sw.js') {
      res.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-cache' });
      return res.end(SW);
    }
    if (path === '/_astro/app.css') {
      res.writeHead(200, { 'Content-Type': 'text/css' });
      return res.end('h1{color:rgb(1, 2, 3)}');
    }
    if (path === '/api/data') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify({ n }));
    }
    if (path === '/offline') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(html('Sem conexão', n));
    }
    if (slow) {
      // Sinal ruim: a resposta chega, mas muito depois do limite do SW (5s). A folga é
      // grande para o teste não depender da carga da máquina.
      setTimeout(() => {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html('Página lenta', n));
      }, 25000);
      return;
    }
    if (broken) {
      res.writeHead(503, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end('<h1>Gateway fora do ar</h1>');
    }
    // /erro sai com no-store, como as páginas do app quando o banco falha.
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      ...(path === '/erro' ? { 'Cache-Control': 'no-store' } : {}),
    });
    res.end(html('Página ' + path, n));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
});

test.afterAll(() => {
  server.closeAllConnections();
  return new Promise<void>((resolve) => server.close(() => resolve()));
});

test.beforeEach(() => {
  hits = {};
  broken = false;
  slow = false;
});

/**
 * Espera o SW controlar a página e ter guardado a página e o CSS (o "cache-page" da
 * primeira visita é assíncrono). Devolve o número da cópia guardada: é ela que tem de
 * voltar sem rede.
 */
async function controlled(page: Page): Promise<number> {
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  let saved = 0;
  await expect
    .poll(
      async () =>
        (saved = await page.evaluate(async () => {
          const pages = await caches.open('society-pages-v1');
          const assets = await caches.open('society-assets-v1');
          const copy = await pages.match(location.href);
          if (!copy || !(await assets.match('/_astro/app.css'))) return 0;
          return Number(/#(\d+)<\/h1>/.exec(await copy.text())?.[1] ?? 0);
        })),
      { timeout: 10000 }
    )
    .toBeGreaterThan(0);
  return saved;
}

const shownNumber = async (page: Page) =>
  Number(/#(\d+)$/.exec((await page.getByRole('heading').textContent()) ?? '')?.[1]);

test('sem sinal, a página já aberta volta do aparelho com o CSS, e a nunca aberta cai na /offline', async ({
  page,
  context,
}) => {
  await page.goto(origin + '/rodada/mesario?sessionId=abc');
  const saved = await controlled(page);
  const served = hits['/rodada/mesario'];

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading')).toHaveText('Página /rodada/mesario #' + saved);
  await expect(page.getByRole('heading')).toHaveCSS('color', 'rgb(1, 2, 3)');

  // A barra de navegação abre o mesário sem query: vale a última cópia com query.
  await page.goto(origin + '/rodada/mesario');
  await expect(page.getByRole('heading')).toHaveText('Página /rodada/mesario #' + saved);
  expect(hits['/rodada/mesario']).toBe(served);

  await page.goto(origin + '/historico');
  await expect(page.getByRole('heading')).toHaveText(/^Sem conexão/);

  // A API nunca vem do cache: sem rede, falha.
  expect(
    await page.evaluate(() =>
      fetch('/api/data').then(
        () => 'ok',
        () => 'falhou'
      )
    )
  ).toBe('falhou');

  // Com a rede de volta, a página vem do servidor, e não da cópia. Logo depois de religar,
  // o Chromium ainda pode recusar a primeira requisição (e a cópia responde): tenta de novo.
  await context.setOffline(false);
  await expect(async () => {
    await page.goto(origin + '/rodada/mesario?sessionId=abc');
    expect(await shownNumber(page)).toBeGreaterThan(served);
  }).toPass({ timeout: 15000 });
});

test('resposta no-store não substitui a cópia boa, e 5xx serve a cópia', async ({ page }) => {
  await page.goto(origin + '/');
  const saved = await controlled(page);
  await page.goto(origin + '/erro');
  await expect(page.getByRole('heading')).toHaveText('Página /erro #1');
  expect(await page.evaluate(async () => !!(await caches.match('/erro')))).toBe(false);

  broken = true;
  await page.goto(origin + '/');
  // A cópia guardada pelo SW na primeira visita, e não a página de erro do gateway.
  await expect(page.getByRole('heading')).toHaveText('Página / #' + saved);
});

test('a API passa direto, sem cache, com a rede ligada', async ({ page }) => {
  await page.goto(origin + '/');
  await controlled(page);
  const read = () => page.evaluate(() => fetch('/api/data').then((r) => r.json()));
  expect((await read()).n).toBe(1);
  expect((await read()).n).toBe(2);
});

test('com a rede lenta, a cópia guardada responde no limite, sem esperar o servidor', async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto(origin + '/rodada/mesario');
  const saved = await controlled(page);
  slow = true;
  // O servidor leva 25s; o SW responde com a cópia no limite dele (5s).
  const started = Date.now();
  await page.reload();
  await expect(page.getByRole('heading')).toHaveText('Página /rodada/mesario #' + saved);
  expect(Date.now() - started).toBeLessThan(20000);
});
