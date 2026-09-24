import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDatabase, migrate, BASELINE_VERSION } from './helpers/db';
import {
  standings,
  headToHead,
  playerPerformance,
  sequences,
} from '../src/core/domain/services/CompetitionService';
import type { MatchSummary } from '../src/core/domain/repositories/IMatchRepository';
import { MATCH_RULES } from '../src/core/domain/entities/Match';
const uuid = () => crypto.randomUUID();
async function setup(applyMigration = true) {
  const db = await createDatabase();
  // Só a baseline: os dados abaixo imitam um banco anterior às migrations versionadas.
  await migrate(db, { until: BASELINE_VERSION });
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
  if (applyMigration) await migrate(db, { after: BASELINE_VERSION });
  async function command(
    action: string,
    mid: string | null,
    input: Record<string, unknown>,
    operationId = uuid()
  ) {
    const result = await db.query<{
      result: { match_id: string; event_id: string; deleted_match?: MatchSummary };
    }>('SELECT society_match_command($1,$2,$3,$4) result', [
      action,
      mid,
      JSON.stringify(input),
      operationId,
    ]);
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

test('exclusão preserva auditoria, remove estatísticas, resiste a retries e permite novo jogo', async () => {
  const { db, sid, teams, players, command, snapshot } = await setup();
  try {
    const start = { sessionId: sid, homeTeamId: teams[0], awayTeamId: teams[1] };
    const first = await command('start', null, start);
    const goal = await command('goal', first.match_id, {
      teamId: teams[0],
      scorerId: players[0],
      assistId: players[1],
    });
    await command('finish', first.match_id, {});
    assert.equal(
      playerPerformance(await snapshot()).find((p) => p.playerId === players[0])?.goals,
      1
    );
    const op = uuid();
    const removed = await command('remove_match', first.match_id, {}, op);
    assert.ok(removed.deleted_match?.deletedAt);
    assert.deepEqual(await command('remove_match', first.match_id, {}, op), removed);
    assert.deepEqual(await command('remove_match', first.match_id, {}), removed);
    assert.deepEqual(await snapshot(), []);
    assert.deepEqual(playerPerformance(await snapshot()), []);
    assert.equal(
      (await db.query('SELECT * FROM match_events WHERE id=$1', [goal.event_id])).rows.length,
      1
    );
    await assert.rejects(command('finish', first.match_id, {}), /Partida apagada/);
    await assert.rejects(command('score', first.match_id, { homeScore: 1 }), /Partida apagada/);
    await assert.rejects(
      db.query('DELETE FROM match_events WHERE id=$1', [goal.event_id]),
      /Partida apagada/
    );
    const second = await command('start', null, start);
    assert.equal((await snapshot())[0].sequence, 2);
    await command('remove_match', second.match_id, {});
    const third = await command('start', null, start);
    assert.equal((await snapshot())[0].sequence, 3);
    assert.equal((await snapshot())[0].matchId, third.match_id);
    await db.exec(await readFile('supabase/migrations/202609090002_delete_match.sql', 'utf8'));
    assert.equal((await snapshot()).length, 1);
  } finally {
    await db.close();
  }
});

test('apagar partida recente não desbloqueia consolidada e recalcula a competição', async () => {
  const { db, sid, teams, command, snapshot } = await setup();
  try {
    const ids: string[] = [];
    for (let i = 0; i < 4; i++) {
      const m = await command('start', null, {
        sessionId: sid,
        homeTeamId: teams[0],
        awayTeamId: teams[1],
      });
      ids.push(m.match_id);
      await command('score', m.match_id, { homeScore: 1 });
      await command('finish', m.match_id, {});
    }
    await assert.rejects(command('remove_match', ids[0], {}), /MATCH_LOCKED/);
    await command('remove_match', ids[3], {});
    const remaining = await snapshot();
    assert.equal(remaining.length, 3);
    assert.ok(remaining.find((m) => m.matchId === ids[0])?.lockedAt);
    assert.equal(playerPerformance(remaining)[0].played, 3);
    assert.equal(
      standings(
        remaining,
        teams.map((id, i) => ({ id, name: 'Time ' + i, colorHex: '#000' }))
      )[0].points,
      9
    );
    assert.equal(headToHead(remaining, teams[0], teams[1]).played, 3);
    assert.equal(sequences(remaining).at(-1)?.winStreak, 3);
    await assert.rejects(command('remove_match', ids[0], {}), /MATCH_LOCKED/);
  } finally {
    await db.close();
  }
});

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
    // O id da partida é a chave do start: o mesário offline já conhece o id antes da
    // resposta e enfileira gols e finalização para ele.
    assert.equal(first.match_id, startOp);
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
    // O cliente projeta o fim da partida com a mesma constante; se o SQL mudar o limite,
    // este teste acusa a divergência.
    assert.equal(m.homeScore, MATCH_RULES.MAX_GOALS_FOR_VICTORY);
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

test('empréstimo de jogador no gol adiciona participante como emprestado na partida', async () => {
  const { db, sid, teams, players, command, snapshot } = await setup();
  try {
    // Partida entre time 0 e time 1
    const m = await command('start', null, {
      sessionId: sid,
      homeTeamId: teams[0],
      awayTeamId: teams[1],
    });

    // Jogador 4 pertence ao time 2 (time de fora)
    const loanedPlayerId = players[4];
    const originalHomePlayer = players[0];

    // Marca gol para o time 0, com autor sendo o jogador emprestado (players[4]) e assistência de players[0]
    await command('goal', m.match_id, {
      teamId: teams[0],
      scorerId: loanedPlayerId,
      assistId: originalHomePlayer,
      isOwnGoal: false,
      loanPlayerIds: [loanedPlayerId],
    });

    const matches = await snapshot();
    assert.equal(matches[0].homeScore, 1);

    // Jogador emprestado deve constar em homePlayers com isLoaned = true
    const loanedParticipant = matches[0].homePlayers?.find((p) => p.id === loanedPlayerId);
    assert.ok(
      loanedParticipant,
      'Jogador emprestado deve estar listado nos jogadores do time na partida'
    );
    assert.equal(loanedParticipant.isLoaned, true);
    assert.equal(loanedParticipant.goals, 1);

    // O time de origem do jogador não deve perder o jogador na rodada base (apenas na partida específica)
    const resOrig = await db.query<{ session_team_id: string }>(
      'SELECT session_team_id FROM session_team_players WHERE player_id=$1',
      [loanedPlayerId]
    );
    assert.equal(resOrig.rows[0].session_team_id, teams[2]);
  } finally {
    await db.close();
  }
});

test('finalizar com placar corrigido no mesmo comando persiste o placar novo', async () => {
  const { db, sid, teams, players, command, snapshot } = await setup();
  try {
    const match = await command('start', null, {
      sessionId: sid,
      homeTeamId: teams[0],
      awayTeamId: teams[1],
    });
    await command('goal', match.match_id, { teamId: teams[0], scorerId: players[0] });
    assert.equal((await snapshot())[0].homeScore, 1);

    // Mesário corrige 1x0 -> 1x1 E finaliza no mesmo PATCH. Antes desta correção o ramo
    // que aplica o placar era exclusivo de p_action='score', então a partida era
    // encerrada 1x0 e a API ainda respondia 200.
    await command('finish', match.match_id, {
      homeScore: 1,
      awayScore: 1,
      durationSeconds: 420,
      status: 'finished',
    });

    const [finished] = await snapshot();
    assert.equal(finished.homeScore, 1);
    assert.equal(finished.awayScore, 1);
    assert.equal(finished.status, 'finished');
  } finally {
    await db.close();
  }
});

test('finalizar sem placar no payload não altera o placar existente', async () => {
  const { db, sid, teams, players, command, snapshot } = await setup();
  try {
    const match = await command('start', null, {
      sessionId: sid,
      homeTeamId: teams[0],
      awayTeamId: teams[1],
    });
    await command('goal', match.match_id, { teamId: teams[0], scorerId: players[0] });
    await command('finish', match.match_id, { durationSeconds: 300 });

    const [finished] = await snapshot();
    assert.equal(finished.homeScore, 1);
    assert.equal(finished.awayScore, 0);
    assert.equal(finished.status, 'finished');
  } finally {
    await db.close();
  }
});

test('motivo do encerramento distingue 2 gols, fim de tempo e encerramento antecipado', async () => {
  const { db, sid, teams, players, command } = await setup();
  const reason = async (id: string) =>
    (await db.query<{ end_reason: string }>('SELECT end_reason FROM matches WHERE id=$1', [id]))
      .rows[0].end_reason;
  try {
    const start = { sessionId: sid, homeTeamId: teams[0], awayTeamId: teams[1] };

    // 1. Regra dos dois gols: encerra sozinha no servidor.
    const a = await command('start', null, start);
    await command('goal', a.match_id, { teamId: teams[0], scorerId: players[0] });
    await command('goal', a.match_id, { teamId: teams[0], scorerId: players[1] });
    assert.equal(await reason(a.match_id), 'two_goals');

    // 2. Cronômetro zerado e mesário encerra: o caso normal da pelada.
    const b = await command('start', null, start);
    await command('goal', b.match_id, { teamId: teams[0], scorerId: players[0] });
    await command('finish', b.match_id, { durationSeconds: 420 });
    assert.equal(await reason(b.match_id), 'time_limit');

    // 3. Encerrada antes do tempo (abandono, lesão): segue sendo 'manual'.
    const c = await command('start', null, start);
    await command('finish', c.match_id, { durationSeconds: 90 });
    assert.equal(await reason(c.match_id), 'manual');
  } finally {
    await db.close();
  }
});

test('snapshot com recorte de datas filtra no SQL e convive com a função antiga', async () => {
  const { db, sid, teams, players, command } = await setup();
  const ranged = async (start?: string, end?: string) =>
    (
      await db.query<{ d: { sessionDate: string }[] }>(
        'SELECT society_matches_snapshot_ranged(NULL,$1,$2) d',
        [start ?? null, end ?? null]
      )
    ).rows[0].d ?? [];
  try {
    const m = await command('start', null, {
      sessionId: sid,
      homeTeamId: teams[0],
      awayTeamId: teams[1],
    });
    await command('goal', m.match_id, { teamId: teams[0], scorerId: players[0] });
    // A rodada do setup é 2026-09-03.
    assert.equal((await ranged()).length, 1);
    assert.equal((await ranged('2026-09-01', '2026-09-30')).length, 1);
    assert.equal((await ranged('2026-09-04')).length, 0, 'início depois da rodada exclui');
    assert.equal((await ranged(undefined, '2026-09-02')).length, 0, 'fim antes da rodada exclui');
    assert.equal((await ranged('2026-10-01', '2026-10-31')).length, 0, 'outro mês exclui');

    // A função de 1 argumento continua existindo e sem ambiguidade — reaplicar uma
    // migração antiga a recria, e foi assim que a troca de assinatura quebrou o app.
    await db.exec(await readFile('supabase/migrations/202609090002_delete_match.sql', 'utf8'));
    const legacy = await db.query<{ d: unknown[] }>('SELECT society_matches_snapshot($1) d', [sid]);
    assert.equal(legacy.rows[0].d.length, 1);
    assert.equal((await ranged('2026-09-01', '2026-09-30')).length, 1);
  } finally {
    await db.close();
  }
});

test('is_captain existe, é preenchido a partir de captain_id e não diverge dele', async () => {
  const { db, sid, teams, players } = await setup();
  try {
    await db.query('UPDATE session_teams SET captain_id=$1 WHERE id=$2', [players[0], teams[0]]);
    // Backfill da migração roda uma vez; aqui simulamos uma edição posterior pela RPC.
    await db.query('SELECT society_update_teams($1,$2)', [
      sid,
      JSON.stringify([
        {
          id: teams[0],
          captainId: players[1],
          players: [
            { playerId: players[0], isGoalkeeper: false },
            { playerId: players[1], isGoalkeeper: true },
          ],
        },
      ]),
    ]);

    const rows = await db.query<{ player_id: string; is_captain: boolean }>(
      'SELECT player_id, is_captain FROM session_team_players WHERE session_team_id=$1 ORDER BY player_id',
      [teams[0]]
    );
    const marcado = rows.rows.filter((r) => r.is_captain).map((r) => r.player_id);
    assert.deepEqual(marcado, [players[1]], 'só o capitão de captain_id fica marcado');

    const team = await db.query<{ captain_id: string }>(
      'SELECT captain_id FROM session_teams WHERE id=$1',
      [teams[0]]
    );
    assert.equal(team.rows[0].captain_id, players[1], 'captain_id segue sendo a fonte');
  } finally {
    await db.close();
  }
});

test('snapshot expõe isRoundGoalkeeper vindo da escalação, não do retrato da partida', async () => {
  const { db, sid, teams, players, command, snapshot } = await setup();
  try {
    // players[1] é goleiro do time 0 no setup; players[0] não é.
    const m = await command('start', null, {
      sessionId: sid,
      homeTeamId: teams[0],
      awayTeamId: teams[1],
    });
    await command('goal', m.match_id, { teamId: teams[0], scorerId: players[0] });
    await command('finish', m.match_id, { durationSeconds: 420 });

    // A escalação muda depois da partida ENCERRADA: o retrato congela, a escalação não.
    // (Com partida em andamento o trigger society_roster_participation propaga a mudança
    // para o retrato, o que é o comportamento desejado enquanto o jogo corre.)
    await db.query('UPDATE session_team_players SET is_goalkeeper=TRUE WHERE player_id=$1', [
      players[0],
    ]);

    const [match] = await snapshot();
    const p0 = match.homePlayers?.find((p) => p.id === players[0]);
    assert.ok(p0);
    assert.equal(p0.isGoalkeeper, false, 'retrato da partida preserva o que era verdade');
    assert.equal(p0.isRoundGoalkeeper, true, 'escalação da rodada manda para a regra da noite');
  } finally {
    await db.close();
  }
});

test('society_create_session cria sessão, times e escalações numa transação só', async () => {
  const { db, players } = await setup();
  try {
    const teams = [
      {
        name: 'Time Azul',
        colorHex: '#1d4ed8',
        captainId: players[0],
        players: [
          { playerId: players[0], isGoalkeeper: false },
          { playerId: players[1], isGoalkeeper: true },
        ],
      },
      { name: 'Time Verde', players: [{ playerId: players[2] }, { playerId: players[3] }] },
      { name: 'Time Preto', players: [{ playerId: players[4], isLoaned: true }] },
    ];
    const r = await db.query<{ id: string }>('SELECT society_create_session($1,$2,$3,$4) id', [
      '2026-09-24',
      '  ',
      480,
      JSON.stringify(teams),
    ]);
    const sid = r.rows[0].id;

    const session = await db.query<{ notes: string | null; match_duration_seconds: number }>(
      'SELECT notes, match_duration_seconds FROM sessions WHERE id=$1',
      [sid]
    );
    assert.equal(session.rows[0].notes, null, 'observação em branco vira NULL');
    assert.equal(session.rows[0].match_duration_seconds, 480);

    const rows = await db.query<{
      name: string;
      color_hex: string;
      player_id: string;
      is_goalkeeper: boolean;
      is_loaned: boolean;
      is_captain: boolean;
    }>(
      `SELECT st.name, st.color_hex, stp.player_id, stp.is_goalkeeper, stp.is_loaned, stp.is_captain
         FROM session_teams st JOIN session_team_players stp ON stp.session_team_id=st.id
        WHERE st.session_id=$1`,
      [sid]
    );
    assert.equal(rows.rows.length, 5);
    const byPlayer = new Map(rows.rows.map((row) => [row.player_id, row]));
    assert.equal(byPlayer.get(players[0])?.is_captain, true, 'is_captain derivado de captainId');
    assert.equal(byPlayer.get(players[1])?.is_captain, false);
    assert.equal(byPlayer.get(players[1])?.is_goalkeeper, true);
    assert.equal(byPlayer.get(players[4])?.is_loaned, true);
    assert.equal(byPlayer.get(players[2])?.color_hex, '#333333', 'cor padrão quando não vem');
  } finally {
    await db.close();
  }
});

test('society_create_session não deixa rodada pela metade quando algo falha', async () => {
  const { db, players } = await setup();
  const count = async () =>
    (
      await db.query<{ n: number }>(
        "SELECT count(*)::int n FROM sessions WHERE session_date='2026-09-24'"
      )
    ).rows[0].n;
  try {
    // O jogador repetido só é detectado depois de a sessão e os times terem sido inseridos.
    await assert.rejects(
      db.query('SELECT society_create_session($1,$2,$3,$4)', [
        '2026-09-24',
        null,
        420,
        JSON.stringify([
          { name: 'A', players: [{ playerId: players[0] }] },
          { name: 'B', players: [{ playerId: players[0] }] },
          { name: 'C', players: [] },
        ]),
      ]),
      /dois times/
    );
    assert.equal(await count(), 0, 'rollback completo: nenhuma sessão órfã');

    // Jogador inexistente (FK) no último time também desfaz tudo.
    await assert.rejects(
      db.query('SELECT society_create_session($1,$2,$3,$4)', [
        '2026-09-24',
        null,
        420,
        JSON.stringify([
          { name: 'A', players: [{ playerId: players[0] }] },
          { name: 'B', players: [{ playerId: crypto.randomUUID() }] },
        ]),
      ])
    );
    assert.equal(await count(), 0);

    // E a data continua livre para a tentativa correta.
    await db.query('SELECT society_create_session($1,$2,$3,$4)', [
      '2026-09-24',
      null,
      420,
      JSON.stringify([{ name: 'A', players: [{ playerId: players[0] }] }]),
    ]);
    assert.equal(await count(), 1);
  } finally {
    await db.close();
  }
});

test('society_create_session recusa data repetida como CONFLICT e valida a duração', async () => {
  const { db } = await setup();
  try {
    // setup() já criou a rodada de 03/09/2026.
    await assert.rejects(
      db.query('SELECT society_create_session($1,$2,$3,$4)', ['2026-09-03', null, 420, '[]']),
      (e: Error & { code?: string }) => {
        assert.match(e.message, /^CONFLICT: Já existe uma rodada em 03\/09\/2026/);
        assert.equal(e.code, 'P0001');
        return true;
      }
    );
    await assert.rejects(
      db.query('SELECT society_create_session($1,$2,$3,$4)', ['2026-09-24', null, 5, '[]']),
      /entre 1 e 60 minutos/
    );
    // SECURITY DEFINER: só a service_role (servidor, atrás do PIN) pode chamar.
    for (const role of ['anon', 'authenticated']) {
      const r = await db.query<{ ok: boolean }>(
        "SELECT has_function_privilege($1, 'society_create_session(date,text,integer,jsonb)', 'EXECUTE') ok",
        [role]
      );
      assert.equal(r.rows[0].ok, false, role + ' não pode criar rodada pela API pública');
    }
  } finally {
    await db.close();
  }
});

test('RPCs de escrita só podem ser chamadas pela service_role', async () => {
  const { db } = await setup();
  try {
    const writers = [
      'society_match_command(text,uuid,jsonb,uuid)',
      'society_update_teams(uuid,jsonb)',
      'society_transfer_player(uuid,uuid,uuid,boolean,boolean)',
      'society_create_session(date,text,integer,jsonb)',
    ];
    // createDatabase() já concede EXECUTE a anon e authenticated em toda função nova, como
    // os default privileges do Supabase: sem os REVOKE das migrations, o teste falha.
    const expected = { anon: false, authenticated: false, service_role: true };
    for (const fn of writers) {
      for (const [role, allowed] of Object.entries(expected)) {
        const r = await db.query<{ ok: boolean }>(
          "SELECT has_function_privilege($1, $2, 'EXECUTE') ok",
          [role, fn]
        );
        assert.equal(r.rows[0].ok, allowed, role + ' em ' + fn);
      }
    }
  } finally {
    await db.close();
  }
});

test('society_match_command_with_match devolve, na mesma chamada, a súmula que a escrita deixou', async () => {
  const { db, sid, teams, players, snapshot } = await setup();
  type Result = {
    match_id: string;
    event_id: string | null;
    match?: MatchSummary | null;
    deleted_match?: MatchSummary;
  };
  async function run(
    action: string,
    mid: string | null,
    input: Record<string, unknown>,
    operationId = uuid()
  ) {
    const r = await db.query<{ data: Result }>(
      'SELECT society_match_command_with_match($1,$2,$3,$4) data',
      [action, mid, JSON.stringify(input), operationId]
    );
    return r.rows[0].data;
  }
  const current = async (id: string) => (await snapshot()).find((m) => m.matchId === id);
  try {
    const start = await run('start', null, {
      sessionId: sid,
      homeTeamId: teams[0],
      awayTeamId: teams[1],
    });
    const id = start.match_id;
    assert.deepEqual(start.match, await current(id));

    const goalOp = uuid();
    const goalInput = { teamId: teams[0], scorerId: players[0], assistId: players[1] };
    const goal = await run('goal', id, goalInput, goalOp);
    assert.equal(goal.event_id, goalOp);
    assert.equal(goal.match?.homeScore, 1);
    assert.deepEqual(goal.match, await current(id));
    // Replay: mesma chave, mesmo resultado, sem gol a mais.
    assert.deepEqual(await run('goal', id, goalInput, goalOp), goal);

    const edit = await run('edit', id, { ...goalInput, eventId: goalOp, assistId: null });
    assert.equal(edit.match?.events?.[0].assistId, null);
    assert.deepEqual(edit.match, await current(id));

    const score = await run('score', id, { homeScore: 1, awayScore: 1 });
    assert.equal(score.match?.awayScore, 1);
    assert.deepEqual(score.match, await current(id));

    const del = await run('delete', id, { eventId: goalOp });
    assert.deepEqual(del.match, await current(id));

    const finish = await run('finish', id, { durationSeconds: 300 });
    assert.equal(finish.match?.status, 'finished');
    assert.deepEqual(finish.match, await current(id));

    const second = await run('start', null, {
      sessionId: sid,
      homeTeamId: teams[2],
      awayTeamId: teams[3],
    });
    const removed = await run('remove_match', second.match_id, {});
    assert.ok(removed.deleted_match?.deletedAt);
    assert.equal(removed.match, undefined);

    const lost = await db.query<{ data: MatchSummary | null }>(
      'SELECT society_match_snapshot($1) data',
      [second.match_id]
    );
    assert.equal(lost.rows[0].data, null);
    const kept = await db.query<{ data: MatchSummary | null }>(
      'SELECT society_match_snapshot($1) data',
      [id]
    );
    assert.deepEqual(kept.rows[0].data, await current(id));
  } finally {
    await db.close();
  }
});
