import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import {
  standings,
  playerPerformance,
  sequences,
} from '../src/core/domain/services/CompetitionService';
import type { MatchSummary } from '../src/core/domain/repositories/IMatchRepository';
const uuid = () => crypto.randomUUID();
async function setup(applyMigration = true) {
  const db = new PGlite();
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;');
  const schema = (await readFile('society-tracker-specs/04_DATABASE_SCHEMA.sql', 'utf8')).replace(
    'CREATE EXTENSION IF NOT EXISTS "pgcrypto";',
    ''
  );
  await db.exec(schema);
  const sid = uuid(),
    teams = [uuid(), uuid(), uuid(), uuid()],
    players = Array.from({ length: 8 }, uuid);
  await db.query("INSERT INTO sessions(id,session_date) VALUES($1,'2026-09-03')", [sid]);
  for (let i = 0; i < 4; i++) {
    await db.query('INSERT INTO session_teams(id,session_id,name) VALUES($1,$2,$3)', [
      teams[i],
      sid,
      'Time ' + i,
    ]);
    for (let j = 0; j < 2; j++) {
      const id = players[i * 2 + j];
      await db.query('INSERT INTO players(id,name) VALUES($1,$2)', [id, 'Jogador ' + (i * 2 + j)]);
      await db.query(
        'INSERT INTO session_team_players(session_team_id,player_id,is_goalkeeper) VALUES($1,$2,$3)',
        [teams[i], id, j === 1]
      );
    }
  }
  const migration = await readFile('supabase/migrations/202609090001_match_integrity.sql', 'utf8');
  if (applyMigration) await db.exec(migration);
  async function command(
    action: string,
    mid: string | null,
    input: Record<string, unknown>,
    operationId = uuid()
  ) {
    const result = await db.query<{ result: { match_id: string; event_id: string } }>(
      'SELECT society_match_command($1,$2,$3,$4) result',
      [action, mid, JSON.stringify(input), operationId]
    );
    return result.rows[0].result;
  }
  async function snapshot() {
    const r = await db.query<{ data: MatchSummary[] }>('SELECT society_matches_snapshot($1) data', [
      sid,
    ]);
    return r.rows[0].data;
  }
  return { db, sid, teams, players, command, snapshot, migration };
}

test('legado com autor removido mantém a assistência e exige remoção explícita do lance', async () => {
  const { db, sid, teams, players, command, snapshot, migration } = await setup(false);
  try {
    const mid = uuid();
    await db.query(
      "INSERT INTO matches(id,session_id,home_team_id,away_team_id,home_score,status,finished_at,end_reason) VALUES($1,$2,$3,$4,1,'finished',now(),'manual')",
      [mid, sid, teams[0], teams[1]]
    );
    await db.query(
      'INSERT INTO match_events(match_id,team_id,scorer_id,assist_id) VALUES($1,$2,$3,$4)',
      [mid, teams[0], players[0], players[1]]
    );
    await db.query('DELETE FROM players WHERE id=$1', [players[0]]);
    await db.exec(migration);
    const saved = (await snapshot())[0];
    assert.equal(saved.homeScore, 1);
    assert.equal(saved.events?.[0].scorerId, null);
    assert.equal(playerPerformance([saved]).find((p) => p.playerId === players[1])?.assists, 1);
    await assert.rejects(command('score', mid, { homeScore: 0 }), /Remova o gol/);
    await command('delete', mid, { eventId: saved.events![0].id });
    assert.equal((await snapshot())[0].homeScore, 0);
  } finally {
    await db.close();
  }
});
test('transações: zero não encerra, dois gols encerram, retries e bloqueio são consistentes', async () => {
  const f = await setup();
  const { db, sid, teams, players, command, snapshot } = f;
  try {
    const startOp = uuid();
    const start = { sessionId: sid, homeTeamId: teams[0], awayTeamId: teams[1] };
    const first = await command('start', null, start, startOp);
    assert.equal((await command('start', null, start, startOp)).match_id, first.match_id);
    await assert.rejects(command('start', null, start), /CONFLICT/);
    const goal = {
      teamId: teams[0],
      scorerId: players[0],
      assistId: players[1],
      eventTimeSeconds: 421,
    };
    const op = uuid();
    const event = await command('goal', first.match_id, goal, op);
    assert.equal(event.event_id, op);
    await command('goal', first.match_id, goal, op);
    assert.equal((await snapshot())[0].status, 'ongoing');
    assert.equal((await snapshot())[0].events?.length, 1);
    await command('goal', first.match_id, { ...goal, assistId: null });
    let m = (await snapshot())[0];
    assert.equal(m.status, 'finished');
    assert.equal(m.endReason, 'two_goals');
    assert.equal(m.homeScore, 2);
    const finishedAt = m.finishedAt;
    await command('finish', m.matchId, { homeScore: 99 });
    m = (await snapshot())[0];
    assert.equal(m.homeScore, 2);
    assert.equal(m.finishedAt, finishedAt);
    await command('edit', m.matchId, {
      eventId: event.event_id,
      teamId: teams[0],
      scorerId: players[1],
      assistId: null,
    });
    assert.equal(
      (await snapshot())[0].events?.find((e) => e.id === event.event_id)?.assistId,
      null
    );
    for (let i = 0; i < 3; i++) {
      const next = await command('start', null, start);
      await command('finish', next.match_id, { durationSeconds: 430 });
    }
    const all = await snapshot();
    assert.equal(all.length, 4);
    assert.ok(all.find((m) => m.matchId === first.match_id)?.lockedAt);
    await assert.rejects(
      command('delete', first.match_id, { eventId: event.event_id }),
      /MATCH_LOCKED/
    );
    await assert.rejects(command('score', first.match_id, { homeScore: 0 }), /MATCH_LOCKED/);
    await assert.rejects(
      db.query('DELETE FROM match_events WHERE id=$1', [event.event_id]),
      /MATCH_LOCKED/
    );
    await assert.rejects(
      command('delete', all[0].matchId, { eventId: event.event_id }),
      /não pertence/
    );
    assert.equal(playerPerformance(all).find((p) => p.playerId === players[0])?.played, 4);
    assert.equal(
      standings(
        all,
        teams.map((id, i) => ({ id, name: 'Time ' + i, colorHex: '#333' }))
      )[0].points,
      6
    );
    assert.equal(sequences(all)[0].winStreak, 1);
  } finally {
    await db.close();
  }
});

test('migração preserva placar legado, autoria e escalações e pode ser reaplicada', async () => {
  const { db, sid, teams, players, command, snapshot, migration } = await setup(false);
  try {
    const mid = uuid();
    await db.query(
      "INSERT INTO matches(id,session_id,home_team_id,away_team_id,home_score,status,finished_at,end_reason) VALUES($1,$2,$3,$4,3,'finished',now(),'manual')",
      [mid, sid, teams[0], teams[1]]
    );
    await db.query(
      'INSERT INTO match_events(match_id,team_id,scorer_id,assist_id) VALUES($1,$2,$3,$4)',
      [mid, teams[0], players[0], players[1]]
    );
    await db.exec(migration);
    const initial = (await snapshot())[0];
    assert.equal(initial.homeScore, 3);
    assert.equal(initial.events?.filter((e) => e.isUnattributed).length, 2);
    assert.ok(initial.homePlayers?.every((p) => p.inferred));
    const original = initial.events!.find((e) => !e.isUnattributed)!;
    assert.equal(original.scorerId, players[0]);
    assert.equal(original.assistId, players[1]);
    await command('delete', mid, { eventId: initial.events!.find((e) => e.isUnattributed)!.id });
    await db.query('INSERT INTO session_team_players(session_team_id,player_id) VALUES($1,$2)', [
      teams[0],
      players[4],
    ]);
    const corrected = await snapshot();
    await db.exec(migration);
    assert.deepEqual(await snapshot(), corrected);
    const audit = await db.query<{ original_home_score: number }>(
      'SELECT original_home_score FROM society_migration_audit WHERE match_id=$1',
      [mid]
    );
    assert.equal(audit.rows[0].original_home_score, 3);
  } finally {
    await db.close();
  }
});

test('falhas fazem rollback integral, transferências não reescrevem a participação e times novos têm IDs próprios', async () => {
  const { db, sid, teams, players, command, snapshot } = await setup();
  try {
    const input = { sessionId: sid, homeTeamId: teams[0], awayTeamId: teams[1] };
    const mid = (await command('start', null, input)).match_id;
    const op = uuid();
    await assert.rejects(
      command('goal', mid, { teamId: teams[0], scorerId: players[0], assistId: players[7] }, op),
      /não participou/
    );
    assert.equal((await snapshot())[0].events?.length, 0);
    assert.equal(
      (await db.query('SELECT * FROM match_operations WHERE operation_id=$1', [op])).rows.length,
      0
    );
    await assert.rejects(
      db.query('SELECT society_transfer_player($1,$2,$3,true,false)', [
        teams[0],
        teams[1],
        players[0],
      ]),
      /adversário/
    );
    assert.equal(
      (
        await db.query(
          'SELECT * FROM session_team_players WHERE session_team_id=$1 AND player_id=$2',
          [teams[0], players[0]]
        )
      ).rows.length,
      1
    );
    await command('goal', mid, { teamId: teams[0], scorerId: players[0] }, op);
    await assert.rejects(
      command('goal', mid, { teamId: teams[0], scorerId: players[1] }, op),
      /reutilizado/
    );
    await command('finish', mid, {});
    await db.query('SELECT society_transfer_player($1,$2,$3,true,false)', [
      teams[0],
      teams[1],
      players[0],
    ]);
    const next = (await command('start', null, input)).match_id;
    await command('finish', next, {});
    const matches = await snapshot();
    assert.ok(
      matches.find((m) => m.matchId === mid)?.homePlayers?.some((p) => p.id === players[0])
    );
    assert.ok(
      matches.find((m) => m.matchId === next)?.awayPlayers?.some((p) => p.id === players[0])
    );
    const nextSession = uuid(),
      nextHome = uuid(),
      nextAway = uuid();
    await db.query("INSERT INTO sessions(id,session_date) VALUES($1,'2026-09-10')", [nextSession]);
    await db.query(
      "INSERT INTO session_teams(id,session_id,name) VALUES($1,$3,'Time 0'),($2,$3,'Time 1')",
      [nextHome, nextAway, nextSession]
    );
    const nextWeek = (
      await command('start', null, {
        sessionId: nextSession,
        homeTeamId: nextHome,
        awayTeamId: nextAway,
      })
    ).match_id;
    await command('finish', nextWeek, {});
    assert.equal((await snapshot()).length, 2);
    assert.equal(
      (await snapshot()).every((m) => !m.lockedAt),
      true
    );
  } finally {
    await db.close();
  }
});

test('migração aborta sem descartar partidas simultâneas do legado', async () => {
  const { db, sid, teams, migration } = await setup(false);
  try {
    await db.query(
      'INSERT INTO matches(session_id,home_team_id,away_team_id) VALUES($1,$2,$3),($1,$2,$3)',
      [sid, teams[0], teams[1]]
    );
    await assert.rejects(db.exec(migration), /partidas simultâneas/);
    await db.exec('ROLLBACK');
    assert.equal((await db.query('SELECT * FROM matches')).rows.length, 2);
    assert.equal(
      (
        await db.query(
          "SELECT column_name FROM information_schema.columns WHERE table_name='matches' AND column_name='locked_at'"
        )
      ).rows.length,
      0
    );
  } finally {
    await db.close();
  }
});
test('gol contra, placar sem autoria, exclusão até zero e estatísticas históricas', async () => {
  const { db, sid, teams, players, command, snapshot } = await setup();
  try {
    const m = await command('start', null, {
      sessionId: sid,
      homeTeamId: teams[0],
      awayTeamId: teams[1],
    });
    const g = await command('goal', m.match_id, { teamId: teams[0], isOwnGoal: true });
    assert.equal((await snapshot())[0].awayScore, 1);
    await command('delete', m.match_id, { eventId: g.event_id });
    assert.equal((await snapshot())[0].awayScore, 0);
    await command('score', m.match_id, { homeScore: 1, awayScore: 0 });
    assert.equal((await snapshot())[0].events?.[0].isUnattributed, true);
    await command('finish', m.match_id, { durationSeconds: 430, homeScore: 20 });
    const before = await snapshot();
    await db.query('DELETE FROM session_team_players WHERE player_id=$1', [players[0]]);
    await db.query('INSERT INTO session_team_players(session_team_id,player_id) VALUES($1,$2)', [
      teams[2],
      players[0],
    ]);
    await db.query('UPDATE players SET is_active=FALSE WHERE id=$1', [players[0]]);
    const after = await snapshot();
    assert.deepEqual(after[0].homePlayers, before[0].homePlayers);
    const stats = playerPerformance(after);
    assert.equal(stats.find((p) => p.playerId === players[0])?.efficiency, 100);
    assert.equal(stats.find((p) => p.playerId === players[0])?.bottomCount, 1);
    assert.equal(stats.find((p) => p.playerId === players[1])?.bottomCount, 0);
    await command('score', m.match_id, { homeScore: 0 });
    assert.ok(
      Math.abs(
        playerPerformance(await snapshot()).find((p) => p.playerId === players[0])!.efficiency -
          100 / 3
      ) < 1e-9
    );
  } finally {
    await db.close();
  }
});
