import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pendingOnDevice, MATCH_CACHE_PREFIX } from '../src/lib/pendingOnDevice.ts';
import { cacheKey } from '../src/components/live/matchSync.ts';

/** O mínimo de Storage que o Layout usa, sobre um Map. */
function storage(entries: Record<string, string>) {
  const keys = Object.keys(entries);
  return {
    get length() {
      return keys.length;
    },
    key: (i: number) => keys[i] ?? null,
    getItem: (k: string) => entries[k] ?? null,
  };
}

const cache = (sessionId: string, pending: unknown[], version = 2) =>
  JSON.stringify({ version, sessionId, pending, timers: {}, matches: [] });

describe('pendingOnDevice', () => {
  it('uses the same key as the mesário cache', () => {
    assert.equal(cacheKey('s-1'), MATCH_CACHE_PREFIX + 's-1');
  });

  it('counts the pending commands of each round', () => {
    const found = pendingOnDevice(
      storage({
        [cacheKey('s-1')]: cache('s-1', [{ operationId: 'a' }, { operationId: 'b' }]),
        [cacheKey('s-2')]: cache('s-2', []),
        [cacheKey('s-3')]: cache('s-3', [{ operationId: 'c', sendAfter: Date.now() + 5000 }]),
        society_team_builder_draft: '{}',
      })
    );
    assert.deepEqual(found, [
      { sessionId: 's-1', count: 2 },
      { sessionId: 's-3', count: 1 },
    ]);
  });

  it('skips what the mesário would not read either', () => {
    const found = pendingOnDevice(
      storage({
        [cacheKey('corrompido')]: '{"version":2,',
        [cacheKey('antigo')]: cache('antigo', [{ operationId: 'a' }], 1),
        [cacheKey('trocado')]: cache('outra', [{ operationId: 'a' }]),
        [cacheKey('sem-fila')]: JSON.stringify({ version: 2, sessionId: 'sem-fila' }),
        // Chave única da versão anterior: não tem fila confirmável (useMatchSession).
        society_active_match_state: cache('s-9', [{ operationId: 'a' }]),
      })
    );
    assert.deepEqual(found, []);
  });
});
