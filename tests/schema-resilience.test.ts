import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractMissingColumn,
  executeWithSchemaFallback,
} from '../src/core/infrastructure/database/schemaResilience.ts';

describe('Schema Resilience & Auto Migration Fallback', () => {
  it('should correctly extract missing column name from PostgREST errors', () => {
    const err1 = "Could not find the 'is_goalkeeper' column of 'players' in the schema cache";
    assert.equal(extractMissingColumn(err1), 'is_goalkeeper');

    const err2 = 'column "is_loaned" of relation "session_team_players" does not exist';
    assert.equal(extractMissingColumn(err2), 'is_loaned');

    assert.equal(extractMissingColumn('Other unrelated database error'), null);
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
