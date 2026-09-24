import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createDatabase, migrate } from './helpers/db';
import { SupabaseSessionRepository } from '../src/core/infrastructure/repositories/SupabaseSessionRepository.ts';
import { SetSessionStatusUseCase } from '../src/core/application/use-cases/SetSessionStatusUseCase.ts';
import { classifyError } from '../src/core/infrastructure/http/api.ts';

const uuid = () => crypto.randomUUID();

async function round(db: PGlite, date: string) {
  const sid = uuid();
  const teams = [uuid(), uuid()];
  await db.query('INSERT INTO sessions(id,session_date) VALUES($1,$2)', [sid, date]);
  for (const [i, id] of teams.entries())
    await db.query('INSERT INTO session_teams(id,session_id,name) VALUES($1,$2,$3)', [
      id,
      sid,
      'Time ' + i,
    ]);
  return { sid, teams };
}

async function command(db: PGlite, action: string, matchId: string | null, input: object) {
  const r = await db.query<{ r: { match_id: string } }>(
    'SELECT society_match_command($1,$2,$3,$4) r',
    [action, matchId, JSON.stringify(input), uuid()]
  );
  return r.rows[0].r;
}

const setStatus = (db: PGlite, sid: string, status: string | null) =>
  db.query('SELECT society_set_session_status($1,$2)', [sid, status]);

const status = async (db: PGlite, sid: string) =>
  (await db.query<{ status: string }>('SELECT status FROM sessions WHERE id=$1', [sid])).rows[0]
    .status;

describe('encerrar rodada (202609240003)', () => {
  it('recusa com partida em andamento; encerrada, não inicia outra, mas aceita correção', async () => {
    const db = await createDatabase();
    try {
      await migrate(db);
      const { sid, teams } = await round(db, '2026-09-24');
      const start = { sessionId: sid, homeTeamId: teams[0], awayTeamId: teams[1] };
      const first = await command(db, 'start', null, start);

      await assert.rejects(setStatus(db, sid, 'finished'), /^error: CONFLICT: Finalize/i);
      assert.equal(await status(db, sid), 'ongoing');

      await command(db, 'finish', first.match_id, {});
      await setStatus(db, sid, 'finished');
      assert.equal(await status(db, sid), 'finished');
      // Encerrar de novo não muda nada nem falha.
      await setStatus(db, sid, 'finished');

      await assert.rejects(command(db, 'start', null, start), /CONFLICT: Rodada encerrada/);
      // As três últimas continuam corrigíveis depois do encerramento.
      await command(db, 'score', first.match_id, { homeScore: 1 });

      await setStatus(db, sid, 'ongoing');
      assert.equal(await status(db, sid), 'ongoing');
      assert.ok((await command(db, 'start', null, start)).match_id);
    } finally {
      await db.close();
    }
  });

  it('recusa status inválido e rodada inexistente', async () => {
    const db = await createDatabase();
    try {
      await migrate(db);
      const { sid } = await round(db, '2026-09-24');
      await assert.rejects(setStatus(db, sid, 'closed'), /Status de rodada inválido/);
      await assert.rejects(setStatus(db, sid, null), /Status de rodada inválido/);
      await assert.rejects(setStatus(db, uuid(), 'finished'), /NOT_FOUND: Rodada não encontrada/);
    } finally {
      await db.close();
    }
  });

  it('a migration encerra as rodadas antigas e deixa a mais recente e a com jogo aberto', async () => {
    const db = await createDatabase();
    try {
      await migrate(db, { until: '202609240002' });
      const old = await round(db, '2026-09-03');
      const stuck = await round(db, '2026-09-10');
      const latest = await round(db, '2026-09-17');
      await command(db, 'start', null, {
        sessionId: stuck.sid,
        homeTeamId: stuck.teams[0],
        awayTeamId: stuck.teams[1],
      });
      await migrate(db, { after: '202609240002' });
      assert.equal(await status(db, old.sid), 'finished');
      assert.equal(await status(db, stuck.sid), 'ongoing');
      assert.equal(await status(db, latest.sid), 'ongoing');
    } finally {
      await db.close();
    }
  });

  it('pela API: repositório e caso de uso chegam à RPC, e a recusa vira 409/404', async () => {
    const db = await createDatabase();
    try {
      await migrate(db);
      const { sid, teams } = await round(db, '2026-09-24');
      // Cliente Supabase mínimo: só a RPC, executada no PGlite.
      const client = {
        async rpc(fn: string, args: { p_session_id: string; p_status: string }) {
          assert.equal(fn, 'society_set_session_status');
          try {
            await setStatus(db, args.p_session_id, args.p_status);
            return { data: args.p_status, error: null };
          } catch (e) {
            return { data: null, error: { message: (e as Error).message, code: 'P0001' } };
          }
        },
      } as unknown as SupabaseClient;
      const useCase = new SetSessionStatusUseCase(new SupabaseSessionRepository(client));
      await command(db, 'start', null, {
        sessionId: sid,
        homeTeamId: teams[0],
        awayTeamId: teams[1],
      });

      const conflict = await useCase
        .execute({ sessionId: sid, status: 'finished' })
        .catch((e: unknown) => e);
      assert.deepEqual(classifyError(conflict), {
        status: 409,
        message: 'Finalize a partida em andamento antes de encerrar a rodada.',
      });
      const missing = await useCase
        .execute({ sessionId: uuid(), status: 'finished' })
        .catch((e: unknown) => e);
      assert.equal(classifyError(missing).status, 404);
    } finally {
      await db.close();
    }
  });
});
