import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractMissingColumn,
  executeWithSchemaFallback,
} from '../src/core/infrastructure/database/schemaResilience.ts';

describe('Schema Resilience & Auto Migration Fallback', () => {
  it('should correctly extract missing column name from PostgREST errors', () => {
    const err1 = "Could not find the 'is_goalkeeper' column of 'players' in the schema cache";
    assert.deepEqual(extractMissingColumn(err1), { column: 'is_goalkeeper', source: 'cache' });

    const err2 = 'column "is_loaned" of relation "session_team_players" does not exist';
    assert.deepEqual(extractMissingColumn(err2), { column: 'is_loaned', source: 'ddl' });

    assert.equal(extractMissingColumn('Other unrelated database error'), null);
  });

  it('must NOT treat a NOT NULL violation as a missing column', () => {
    // O PostgreSQL cita coluna e relação com as mesmas palavras nesta mensagem. Tratá-la
    // como coluna ausente fazia o campo ser removido do payload e a linha ser gravada sem
    // ele — com resposta de sucesso.
    const notNull =
      'null value in column "match_duration_seconds" of relation "sessions" violates not-null constraint';
    assert.equal(extractMissingColumn(notNull), null);

    const checkViolation =
      'new row for relation "matches" violates check constraint "matches_home_score_check"';
    assert.equal(extractMissingColumn(checkViolation), null);
  });

  it('should surface a NOT NULL violation as an error instead of silently dropping the column', async () => {
    let callCount = 0;
    const mockOperation = async (payload: any) => {
      callCount++;
      if (payload.match_duration_seconds === null) {
        return {
          data: null,
          error: {
            message:
              'null value in column "match_duration_seconds" of relation "sessions" violates not-null constraint',
          },
        };
      }
      return { data: { id: 's-1', ...payload }, error: null };
    };

    const result = await executeWithSchemaFallback(
      'mock_sessions',
      { session_date: '2026-09-24', match_duration_seconds: null },
      mockOperation
    );

    // Sem retentativa: o erro chega ao chamador em vez de virar um 201 com dado perdido.
    assert.equal(callCount, 1);
    assert.ok(result.error);
    assert.deepEqual(result.droppedColumns, []);
  });

  it('should report which columns were dropped', async () => {
    const result = await executeWithSchemaFallback(
      'mock_reporting',
      { name: 'Ney', is_goalkeeper: true },
      async (payload: any) =>
        payload.is_goalkeeper !== undefined
          ? {
              data: null,
              error: { message: 'column "is_goalkeeper" of relation "mock_reporting" does not exist' },
            }
          : { data: payload, error: null }
    );

    assert.equal(result.error, null);
    assert.deepEqual(result.droppedColumns, ['is_goalkeeper']);
  });

  it('should auto-strip missing columns and retry successfully', async () => {
    let callCount = 0;
    const historyPayloads: any[] = [];

    const mockOperation = async (payload: any) => {
      callCount++;
      historyPayloads.push({ ...payload });

      if (payload.is_goalkeeper !== undefined) {
        return {
          data: null,
          error: {
            message: "Could not find the 'is_goalkeeper' column of 'mock_players' in the schema cache",
          },
        };
      }

      return {
        data: { id: 'p-1', ...payload },
        error: null,
      };
    };

    const result = await executeWithSchemaFallback<{ id: string; name: string }>(
      'mock_players',
      { name: 'Neymar', nickname: 'Ney', is_goalkeeper: true },
      mockOperation
    );

    assert.equal(result.error, null);
    assert.equal(result.data?.id, 'p-1');
    assert.equal(result.data?.name, 'Neymar');
    assert.equal(callCount, 2);
    assert.deepEqual(historyPayloads[0], { name: 'Neymar', nickname: 'Ney', is_goalkeeper: true });
    assert.deepEqual(historyPayloads[1], { name: 'Neymar', nickname: 'Ney' });
  });

  it('should auto-strip missing columns for array payloads', async () => {
    let callCount = 0;

    const mockOperation = async (payload: any[]) => {
      callCount++;
      if (payload.some((p) => p.is_goalkeeper !== undefined)) {
        return {
          data: null,
          error: {
            message: "Could not find the 'is_goalkeeper' column of 'mock_team_players' in the schema cache",
          },
        };
      }

      return {
        data: payload,
        error: null,
      };
    };

    const result = await executeWithSchemaFallback(
      'mock_team_players',
      [
        { player_id: 'p-1', is_loaned: false, is_goalkeeper: true },
        { player_id: 'p-2', is_loaned: true, is_goalkeeper: false },
      ],
      mockOperation
    );

    assert.equal(result.error, null);
    assert.equal(callCount, 2);
    assert.deepEqual(result.data, [
      { player_id: 'p-1', is_loaned: false },
      { player_id: 'p-2', is_loaned: true },
    ]);
  });
});
