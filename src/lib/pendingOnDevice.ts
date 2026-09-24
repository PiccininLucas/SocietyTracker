/**
 * Lances do mesário guardados no aparelho e ainda não enviados. A fila só é enviada com o
 * mesário aberto: quem sai dele (outra página, o app fechado) deixa os lances parados até
 * voltar. O Layout usa isto para avisar em qualquer página.
 *
 * Sem imports de propósito: o script do Layout vai para todas as páginas.
 */

/** Prefixo da chave do cache do mesário por rodada (matchSync.ts). */
export const MATCH_CACHE_PREFIX = 'society_active_match_state:';

export interface PendingOnDevice {
  sessionId: string;
  count: number;
}

type ReadableStorage = Pick<Storage, 'length' | 'key' | 'getItem'>;

/** Rodadas com lances pendentes neste aparelho. Uma chave ilegível é ignorada. */
export function pendingOnDevice(storage: ReadableStorage): PendingOnDevice[] {
  const found: PendingOnDevice[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(MATCH_CACHE_PREFIX)) continue;
    const sessionId = key.slice(MATCH_CACHE_PREFIX.length);
    try {
      const cache = JSON.parse(storage.getItem(key) ?? 'null');
      if (cache?.version !== 2 || cache.sessionId !== sessionId) continue;
      const count = Array.isArray(cache.pending) ? cache.pending.length : 0;
      if (count > 0) found.push({ sessionId, count });
    } catch {
      // JSON corrompido: o mesário daquela rodada também o ignora (readCache).
    }
  }
  return found;
}
