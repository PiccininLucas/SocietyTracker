// Service worker do SocietyTracker, servido em /sw.js (escopo /) e registrado pelo Layout.
//
// Serve para o app abrir sem sinal. O mesário guarda a fila de lances no localStorage,
// mas sem service worker uma recarga na quadra, sem rede, mostrava a página de erro do
// navegador, e a fila ficava inacessível até o sinal voltar.
//
// - Páginas (navegação): rede primeiro, e a resposta boa vai para o cache junto com o
//   JS e o CSS que ela usa. Sem rede, ou com a rede demorando mais de NETWORK_TIMEOUT_MS
//   quando já existe cópia, serve a cópia. Sem cópia, a página /offline.
// - /_astro/*: arquivos com hash no nome, que nunca mudam. Cache primeiro.
// - Ícones, manifesto e favicon: servidos do cache e atualizados em segundo plano.
// - /api/* e qualquer outra origem passam direto, sem cache. Os dados do mesário têm a
//   fila própria, e uma resposta da API guardada aqui mostraria placar velho como atual.
//
// Resposta com `Cache-Control: no-store` não é guardada: as páginas usam isso quando
// saem com erro (banco fora do ar), e a cópia boa anterior não pode ser trocada por ela.
//
// Ao mudar a estratégia, troque VERSION: o activate apaga os caches das versões antigas.

const VERSION = 'v1';
// O logout (Layout.astro) apaga este cache: as telas do mesário saem junto com a sessão.
const PAGES = 'society-pages-' + VERSION;
const ASSETS = 'society-assets-' + VERSION;
const OFFLINE_URL = '/offline';
const NETWORK_TIMEOUT_MS = 5000;
const MAX_PAGES = 30;
const MAX_ASSETS = 150;
// Sem sinal, uma página de login guardada não serve para nada: melhor a /offline.
const NEVER_SAVED = new Set(['/login', OFFLINE_URL]);
const STATIC_FILE = /^\/(icons\/.+|manifest\.webmanifest|favicon\.(svg|ico))$/;
const ASSET_REF = /\/_astro\/[^"'\s)<>]+/g;

self.addEventListener('install', (event) => {
  event.waitUntil(precacheOffline().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('society-') && key !== PAGES && key !== ASSETS)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') event.respondWith(navigation(event, url));
  else if (url.pathname.startsWith('/_astro/')) event.respondWith(immutable(request));
  else if (STATIC_FILE.test(url.pathname)) event.respondWith(refreshed(event));
});

// Primeira visita: a página e o JS dela carregaram antes de existir SW. O Layout manda
// a lista para guardar agora, senão a primeira abertura sem sinal viria vazia.
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'cache-page' || typeof data.url !== 'string') return;
  event.waitUntil(warm(data.url, Array.isArray(data.assets) ? data.assets : []));
});

/** Só resposta 200 da própria origem, sem redirecionamento e sem `no-store`. */
function savable(response) {
  return (
    response.ok &&
    response.type === 'basic' &&
    !response.redirected &&
    !/no-store/i.test(response.headers.get('Cache-Control') || '')
  );
}

/**
 * Cópia sem a marca de redirecionamento: o navegador recusa responder uma navegação com
 * uma resposta que veio de redirect (a /offline pode ter vindo de /offline/).
 */
async function fresh(response) {
  return new Response(await response.blob(), {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map((key) => cache.delete(key)));
}

/** Guarda os /_astro/ ainda ausentes. Falha de um arquivo não impede os outros. */
async function saveAssets(urls) {
  const cache = await caches.open(ASSETS);
  await Promise.all(
    [...new Set(urls)].map(async (url) => {
      if (await cache.match(url)) return;
      try {
        const response = await fetch(url);
        if (savable(response)) await cache.put(url, response);
      } catch {
        // Sem rede agora; o arquivo entra no cache na próxima vez que a página o pedir.
      }
    })
  );
  await trim(ASSETS, MAX_ASSETS);
}

/** Guarda a página e o JS/CSS que o HTML dela referencia (ilhas, estilos, scripts). */
async function savePage(key, response) {
  const html = await response.clone().text();
  const cache = await caches.open(PAGES);
  await cache.put(key, response);
  await trim(PAGES, MAX_PAGES);
  await saveAssets(html.match(ASSET_REF) || []);
}

async function precacheOffline() {
  const response = await fetch(OFFLINE_URL, { cache: 'reload' });
  if (!response.ok) throw new Error('Página /offline indisponível: ' + response.status);
  const html = await response.clone().text();
  await (await caches.open(ASSETS)).put(OFFLINE_URL, response);
  await saveAssets(html.match(ASSET_REF) || []);
}

/**
 * Cópia guardada da página. `/rodada/mesario` sem query (a barra de navegação) aceita a
 * cópia mais recente da mesma página com query (`?sessionId=`, vindo do montador).
 */
async function savedPage(request, url) {
  const cache = await caches.open(PAGES);
  const exact = await cache.match(request, { ignoreVary: true });
  if (exact || url.search) return exact;
  const all = await cache.matchAll(request, { ignoreSearch: true, ignoreVary: true });
  return all[all.length - 1];
}

async function offlinePage() {
  const saved = await (await caches.open(ASSETS)).match(OFFLINE_URL);
  return saved ? fresh(saved) : Response.error();
}

async function navigation(event, url) {
  const { request } = event;
  const network = fetch(request).then((response) => {
    if (!NEVER_SAVED.has(url.pathname) && savable(response))
      event.waitUntil(savePage(request, response.clone()).catch(() => {}));
    return response;
  });
  // A rede segue mesmo quando a cópia responde antes: ela atualiza o cache.
  event.waitUntil(network.catch(() => {}));

  const saved = NEVER_SAVED.has(url.pathname) ? undefined : await savedPage(request, url);
  if (!saved) return network.catch(() => offlinePage());

  let timer;
  const slow = new Promise((resolve) => {
    timer = setTimeout(resolve, NETWORK_TIMEOUT_MS);
  });
  try {
    const winner = await Promise.race([network, slow]);
    // Gateway ou função fora do ar (5xx) conta como falta de rede; 404 e redirect para
    // o login passam, porque são a resposta certa.
    return winner && winner.status < 500 ? winner : fresh(saved);
  } catch {
    return fresh(saved);
  } finally {
    clearTimeout(timer);
  }
}

async function immutable(request) {
  const cache = await caches.open(ASSETS);
  const saved = await cache.match(request);
  if (saved) return saved;
  const response = await fetch(request);
  if (savable(response)) {
    await cache.put(request, response.clone());
    await trim(ASSETS, MAX_ASSETS);
  }
  return response;
}

async function refreshed(event) {
  const cache = await caches.open(ASSETS);
  const saved = await cache.match(event.request);
  const network = fetch(event.request).then(async (response) => {
    if (savable(response)) await cache.put(event.request, response.clone());
    return response;
  });
  if (!saved) return network;
  event.waitUntil(network.catch(() => {}));
  return saved;
}

async function warm(pageUrl, assetUrls) {
  const url = new URL(pageUrl, self.location.origin);
  const assets = assetUrls
    .map((raw) => {
      try {
        return new URL(raw, self.location.origin);
      } catch {
        return null;
      }
    })
    .filter((u) => u && u.origin === self.location.origin && u.pathname.startsWith('/_astro/'))
    .map((u) => u.href);
  await saveAssets(assets);
  if (url.origin !== self.location.origin || NEVER_SAVED.has(url.pathname)) return;
  try {
    const response = await fetch(url.href, { credentials: 'same-origin' });
    if (savable(response)) await savePage(url.href, response);
  } catch {
    // Sem rede agora; a página entra no cache na próxima navegação.
  }
}
