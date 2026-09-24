import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseMatchRepository } from '../src/core/infrastructure/repositories/SupabaseMatchRepository.ts';
import { DatabaseError } from '../src/core/infrastructure/database/DatabaseError.ts';
import type { MatchSummary } from '../src/core/domain/repositories/IMatchRepository.ts';

type Reply = { data: unknown; error: { message: string; code: string } | null };

/** Cliente Supabase falso: registra cada RPC e recusa qualquer outra consulta. */
function fakeClient(reply: Reply) {
  const calls: { fn: string; args: unknown }[] = [];
  const client = {
    async rpc(fn: string, args: unknown) {
      calls.push({ fn, args });
      return reply;
    },
    from() {
      throw new Error('o repositório não deveria consultar tabelas aqui');
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

const match = { matchId: 'm-1', sessionId: 's-1', status: 'ongoing' } as MatchSummary;
const command = { action: 'goal' as const, matchId: 'm-1', operationId: 'op-1', input: {} };

describe('SupabaseMatchRepository', () => {
  it('um comando é uma ida ao banco só, e a súmula vem na resposta', async () => {
    const { client, calls } = fakeClient({
      data: { match_id: 'm-1', event_id: 'op-1', match },
      error: null,
    });
    const result = await new SupabaseMatchRepository(client).executeCommand(command);
    assert.deepEqual(result, { match, eventId: 'op-1' });
    assert.deepEqual(calls, [
      {
        fn: 'society_match_command_with_match',
        args: { p_action: 'goal', p_match_id: 'm-1', p_input: {}, p_operation_id: 'op-1' },
      },
    ]);
  });

  it('remove_match devolve a súmula arquivada, e comando sem gol não traz eventId', async () => {
    const deleted = { ...match, deletedAt: '2026-09-24T20:00:00Z' };
    const { client } = fakeClient({
      data: { match_id: 'm-1', deleted_match: deleted },
      error: null,
    });
    const result = await new SupabaseMatchRepository(client).executeCommand({
      ...command,
      action: 'remove_match',
    });
    assert.deepEqual(result, { match: deleted, eventId: undefined });
  });

  it('propaga o SQLSTATE, para a rota distinguir recusa de falha transitória', async () => {
    const { client } = fakeClient({
      data: null,
      error: { message: 'MATCH_LOCKED: Partida consolidada.', code: 'P0001' },
    });
    await assert.rejects(
      new SupabaseMatchRepository(client).executeCommand(command),
      (error: unknown) => error instanceof DatabaseError && error.code === 'P0001'
    );
  });

  it('sem súmula na resposta, falha para o cliente reenviar com a mesma chave', async () => {
    const { client } = fakeClient({ data: { match_id: 'm-1', match: null }, error: null });
    await assert.rejects(
      new SupabaseMatchRepository(client).executeCommand(command),
      /não foi possível carregar a confirmação/
    );
  });

  it('getMatchById lê uma partida numa chamada, e null quando ela não existe', async () => {
    const found = fakeClient({ data: match, error: null });
    assert.deepEqual(await new SupabaseMatchRepository(found.client).getMatchById('m-1'), match);
    assert.deepEqual(found.calls, [{ fn: 'society_match_snapshot', args: { p_match_id: 'm-1' } }]);
    const missing = fakeClient({ data: null, error: null });
    assert.equal(await new SupabaseMatchRepository(missing.client).getMatchById('m-9'), null);
  });
});
