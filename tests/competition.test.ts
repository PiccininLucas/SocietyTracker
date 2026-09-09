import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  standings,
  headToHead,
  sequences,
  playerPerformance,
  weekRange,
  scoreFromEvents,
} from '../src/core/domain/services/CompetitionService';
import { timerNow, projectPending, applyMatchResult, type SessionCache } from '../src/components/live/matchSync';
import type {
  MatchSummary,
  MatchSummaryEvent,
} from '../src/core/domain/repositories/IMatchRepository';
const teams = [
  { id: 'a', name: 'Zulu', colorHex: '#000' },
  { id: 'b', name: 'Alfa', colorHex: '#fff' },
  { id: 'c', name: 'C', colorHex: '#333' },
  { id: 'd', name: 'D', colorHex: '#555' },
];
const player = (id: string, gk = false) => ({
  id,
  name: id,
  nickname: null,
  isCaptain: false,
  isGoalkeeper: gk,
  isLoaned: false,
  goals: 0,
  assists: 0,
});
function match(n: number, h: string, a: string, hs: number, as: number): MatchSummary {
  return {
    matchId: 'm' + n,
    sessionId: 's',
    sessionDate: '2026-09-03',
    sequence: n,
    homeTeamId: h,
    awayTeamId: a,
    homeTeamName: h,
    awayTeamName: a,
    homeTeamColor: '#000',
    awayTeamColor: '#fff',
    homeScore: hs,
    awayScore: as,
    status: 'finished',
    durationSeconds: 430,
    endReason: 'manual',
    startedAt: '2026-09-03T20:00:00Z',
    finishedAt: '2026-09-03T20:07:10Z',
    events: [],
    homePlayers: [],
    awayPlayers: [],
  };
}
test('classificação: 3/1/0, todas as colunas e confronto direto antes do nome', () => {
  const matches = [match(1, 'a', 'b', 1, 0), match(2, 'a', 'c', 0, 1), match(3, 'b', 'd', 1, 0)];
  const rows = standings(matches, teams);
  assert.ok(rows.findIndex((r) => r.teamId === 'a') < rows.findIndex((r) => r.teamId === 'b'));
  const a = rows.find((r) => r.teamId === 'a')!;
  assert.deepEqual(
    [
      a.points,
      a.played,
      a.wins,
      a.draws,
      a.losses,
      a.goalsFor,
      a.goalsAgainst,
      a.goalDifference,
      a.efficiency,
    ],
    [3, 2, 1, 0, 1, 1, 1, 0, 50]
  );
  assert.deepEqual(headToHead(matches, 'b', 'a'), {
    firstWins: 0,
    secondWins: 1,
    draws: 0,
    played: 1,
    firstGoals: 0,
    secondGoals: 1,
  });
  assert.equal(
    standings([match(4, 'a', 'b', 0, 0)], teams).find((r) => r.teamId === 'a')?.points,
    1
  );
});
test('empate triplo não cria comparador cíclico; times de outra semana mantêm identidade distinta', () => {
  const cyclic = [match(1, 'a', 'b', 1, 0), match(2, 'b', 'c', 1, 0), match(3, 'c', 'a', 1, 0)];
  const expected = standings(cyclic, teams).map((t) => t.teamId);
  assert.deepEqual(
    standings([...cyclic].reverse(), [...teams].reverse()).map((t) => t.teamId),
    expected
  );
  assert.equal(standings(cyclic, [{ id: 'new-a', name: 'Zulu', colorHex: '#000' }])[0].played, 0);
  assert.equal(headToHead(cyclic, 'new-a', 'b').played, 0);
});
test('sequências 1/2/3, derrota, empate e correção retroativa', () => {
  const games = [
    match(1, 'a', 'b', 1, 0),
    match(2, 'a', 'c', 1, 0),
    match(3, 'a', 'd', 1, 0),
    match(4, 'a', 'b', 0, 1),
    match(5, 'a', 'b', 0, 0),
  ];
  const rows = sequences(games);
  assert.deepEqual(
    rows.map((r) => r.winStreak),
    [1, 2, 3, 1, 0]
  );
  assert.deepEqual(rows[3].interrupted, ['a']);
  assert.deepEqual(rows[4].interrupted, ['b']);
  const corrected = games.map((m) => (m.sequence === 2 ? { ...m, awayScore: 1 } : m));
  assert.equal(sequences(corrected)[2].winStreak, 1);
});
test('jogadores: jogos sem gols, empréstimo entre partidas, inativos, GK e empates nos rankings', () => {
  const a = match(1, 'a', 'b', 1, 0),
    b = match(2, 'b', 'a', 0, 0);
  a.homePlayers = [player('p'), player('gk', true)];
  a.awayPlayers = [player('q')];
  b.homePlayers = [player('p'), player('q')];
  b.awayPlayers = [player('gk', true)];
  a.events = [
    {
      id: 'e',
      matchId: a.matchId,
      teamId: 'a',
      scorerId: 'p',
      assistId: null,
      isOwnGoal: false,
      eventTimeSeconds: 430,
    },
  ];
  const rows = playerPerformance(
    [a, b],
    [
      { id: 'p', name: 'p', isActive: false },
      { id: 'zero', name: 'zero', isActive: true },
    ]
  );
  const p = rows.find((p) => p.playerId === 'p')!;
  assert.deepEqual(
    [p.played, p.wins, p.draws, p.losses, p.goals, p.assists, p.contributions, p.isActive],
    [2, 1, 1, 0, 1, 0, 1, false]
  );
  assert.ok(Math.abs(p.efficiency - (4 / 6) * 100) < 1e-9);
  assert.equal(rows.find((p) => p.playerId === 'zero')?.played, 0);
  assert.equal(rows.find((p) => p.playerId === 'zero')?.efficiency, 0);
  assert.equal(rows.find((p) => p.playerId === 'gk')?.bottomCount, 0);
  assert.equal(rows.find((p) => p.playerId === 'q')?.bottomCount, 1);
  assert.equal(rows.find((p) => p.playerId === 'zero')?.goalRank, 2);
  assert.equal(rows.find((p) => p.playerId === 'q')?.goalRank, 2);
  assert.ok(rows.every((p) => p.assistRank === 1));
  const corrected = {
    ...a,
    homeScore: 0,
    awayScore: 1,
    events: [{ ...a.events[0], teamId: 'b', scorerId: 'q', assistId: null }],
  };
  assert.equal(playerPerformance([corrected, b]).find((p) => p.playerId === 'p')?.losses, 1);
  assert.equal(playerPerformance([corrected, b]).find((p) => p.playerId === 'p')?.contributions, 0);
});
test('jogos ativos não pontuam; gols contra não contam para o jogador', () => {
  const m = match(1, 'a', 'b', 0, 1);
  m.homePlayers = [player('p')];
  const own: MatchSummaryEvent = {
    id: 'e',
    matchId: m.matchId,
    teamId: 'a',
    scorerId: null,
    assistId: null,
    isOwnGoal: true,
    eventTimeSeconds: 30,
  };
  m.events = [own];
  assert.deepEqual(scoreFromEvents('a', 'b', m.events), { homeScore: 0, awayScore: 1 });
  assert.equal(playerPerformance([m])[0].goals, 0);
  assert.equal(playerPerformance([{ ...m, status: 'ongoing' }]).length, 0);
  assert.equal(
    standings([{ ...m, status: 'ongoing' }], teams).reduce((n, t) => n + t.played, 0),
    0
  );
});
test('semana cruza mês/ano sem agrupar nomes; cronômetro continua após zero e respeita pausa', () => {
  assert.deepEqual(weekRange('2026-01-01'), { start: '2025-12-29', end: '2026-01-04' });
  assert.deepEqual(timerNow({ remaining: 2, elapsed: 418, running: true, anchor: 1000 }, 5000), {
    remaining: 0,
    elapsed: 422,
  });
  assert.deepEqual(timerNow({ remaining: 10, elapsed: 5, running: false, anchor: 1000 }, 5000), {
    remaining: 10,
    elapsed: 5,
  });
});
test('exclusão confirmada remove jogo e cronômetro do cache sem perder outras pendências', () => {
  const m = match(1, 'a', 'b', 1, 0);
  const other = match(2, 'a', 'b', 0, 0);
  const cache: SessionCache = {
    version: 2, sessionId: m.sessionId, matches: [m, other],
    timers: { [m.matchId]: { remaining: 10, elapsed: 2, running: false, anchor: 0 } },
    pending: [{ action: 'remove_match', matchId: m.matchId, operationId: 'delete-op', input: {} }],
  };
  assert.equal(projectPending(cache.matches, cache.pending).length, 2);
  const updated = applyMatchResult(cache, { ...m, deletedAt: '2026-09-09T12:00:00Z' });
  assert.deepEqual(updated.matches, [other]);
  assert.deepEqual(updated.timers, {});
  assert.deepEqual(updated.pending, cache.pending);
  assert.equal(cache.matches.length, 2);
});

test('projeção local mostra gol pendente sem alterar a fonte confirmada', () => {
  const m = match(1, 'a', 'b', 0, 0);
  m.status = 'ongoing';
  m.homePlayers = [player('p')];
  const next = projectPending(
    [m],
    [
      {
        action: 'goal',
        matchId: m.matchId,
        operationId: 'op',
        input: { teamId: 'a', scorerId: 'p', assistId: null, eventTimeSeconds: 421 },
      },
    ]
  );
  assert.equal(next[0].homeScore, 1);
  assert.equal(m.homeScore, 0);
  assert.equal(m.events?.length, 0);
  const afterLostAcknowledgement = projectPending(next, [
    {
      action: 'goal',
      matchId: m.matchId,
      operationId: 'op',
      input: { teamId: 'a', scorerId: 'p' },
    },
  ]);
  assert.equal(afterLostAcknowledgement[0].homeScore, 1);
  assert.equal(afterLostAcknowledgement[0].events?.length, 1);
});
