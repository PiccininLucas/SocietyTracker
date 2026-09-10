import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { playerPerformance } from '../src/core/domain/services/CompetitionService';
import { historicalTotalsForPeriod, type HistoricalPlayerTotal } from '../src/core/domain/entities/HistoricalPlayerTotal';
import { performanceLeaderboard } from '../src/core/application/dtos/performanceLeaderboard';
import { GetLeaderboardUseCase } from '../src/core/application/use-cases/GetLeaderboardUseCase';
import { GetPeriodLeaderboardUseCase } from '../src/core/application/use-cases/GetPeriodLeaderboardUseCase';
import type { IMatchRepository, MatchSummary } from '../src/core/domain/repositories/IMatchRepository';

const historical: HistoricalPlayerTotal[] = [
  { playerId: 'p', sourceName: 'Antigo', season: 2026, throughDate: '2026-09-03', goals: 41, assists: 23, bottomCount: 3 },
];
const registered = [{ id: 'p', name: 'Antigo', isActive: false }, { id: 'q', name: 'Novo', isActive: true }];
function match(date: string, goal = true): MatchSummary {
  return {
    matchId: date, sessionId: date, sessionDate: date,
    homeTeamId: 'h', awayTeamId: 'a', homeTeamName: 'H', awayTeamName: 'A', homeTeamColor: '#000', awayTeamColor: '#fff',
    homeScore: goal ? 1 : 0, awayScore: 0, status: 'finished', durationSeconds: 420,
    endReason: 'manual', startedAt: date + 'T20:00:00Z', finishedAt: date + 'T20:07:00Z',
    homePlayers: ['p', 'q'].map(id => ({ id, name: id, nickname: null, isCaptain: false,
      isGoalkeeper: false, isLoaned: false, goals: 0, assists: 0 })), awayPlayers: [],
    events: goal ? [{ id: date, matchId: date, teamId: 'h', scorerId: 'p', assistId: 'q', isOwnGoal: false, eventTimeSeconds: 10 }] : [],
  };
}

test('totais até o corte não duplicam gols, assistências ou bola murcha; médias usam somente registros', async () => {
  const matches = [match('2026-08-27', false), match('2026-09-03'), match('2026-09-10'), match('2026-09-17', false)];
  const rows = playerPerformance(matches, registered, historical);
  const p = rows.find(r => r.playerId === 'p')!;
  assert.deepEqual([p.goals, p.assists, p.contributions, p.bottomCount, p.played, p.recordedGoals], [42, 23, 65, 4, 4, 2]);
  assert.equal(p.isActive, false);
  // A player without a snapshot retains all recorded events in the same period.
  assert.equal(rows.find(r => r.playerId === 'q')?.assists, 2);
  const dto = performanceLeaderboard(p);
  assert.deepEqual([dto.totalMatchesPlayed, dto.totalSessionsPlayed, dto.goalsPerMatch], [null, null, null]);
  assert.equal(dto.recordedGoalsPerMatch, 0.5);
  const repo = {
    getLeaderboard: async () => [dto], getLeaderboardByDateRange: async () => [dto],
  } as unknown as IMatchRepository;
  assert.equal((await new GetLeaderboardUseCase(repo).execute())[0].totalMatchesPlayed, null);
  const report = await new GetPeriodLeaderboardUseCase(repo).execute({ type: 'all' });
  assert.equal(report.byGoals[0].goalsPerMatch, null);
  assert.equal(report.byGoals[0].secondaryInfo, undefined);
  assert.equal(report.byAssists[0].secondaryInfo, undefined);
});

test('snapshot entra apenas em períodos que o contêm por inteiro e mantém jogador sem jogos', () => {
  assert.equal(historicalTotalsForPeriod(historical, '2026-01-01', '2026-12-31').length, 1);
  assert.equal(historicalTotalsForPeriod(historical).length, 1);
  assert.equal(historicalTotalsForPeriod(historical, '2026-09-01', '2026-09-30').length, 0);
  assert.equal(historicalTotalsForPeriod(historical, '2026-01-01', '2026-09-02').length, 0);
  assert.equal(historicalTotalsForPeriod(historical, '2027-01-01', '2027-12-31').length, 0);
  const only = performanceLeaderboard(playerPerformance([], registered, historical).find(p => p.playerId === 'p')!);
  assert.equal(only.totalGoals, 41);
  assert.equal(only.recordedGoalsPerMatch, null);
  assert.equal(only.totalMatchesPlayed, null);
  // Do not suppress last year's matches for a 2026 snapshot.
  assert.equal(playerPerformance([match('2025-12-25')], registered, historical)[0].goals, 42);
});

test('importação SQL concilia 39 jogadores, preserva vínculos e rejeita conflitos sem gravações parciais', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE TABLE players(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, nickname text, is_active boolean DEFAULT true);
      CREATE TABLE society_schema_versions(version text PRIMARY KEY);`);
    const migration = await readFile('supabase/migrations/202609100001_historical_totals.sql', 'utf8');
    const sql = await readFile('supabase/imports/2026_ate_03_09.sql', 'utf8');
    await db.exec(migration);
    await db.exec(migration);
    const original = (await db.query<{ id: string }>("INSERT INTO players(name,nickname,is_active) VALUES ('João','Chitão',false) RETURNING id")).rows[0].id;
    await db.exec(sql);
    const sums = (await db.query(`SELECT count(*)::int players, sum(goals)::int goals, sum(assists)::int assists,
      sum(bottom_count)::int bottom FROM historical_player_totals`)).rows[0];
    assert.deepEqual(sums, { players: 39, goals: 357, assists: 258, bottom: 16 });
    assert.equal((await db.query<{player_id: string}>("SELECT player_id FROM historical_player_totals WHERE source_name='Chitao'")).rows[0].player_id, original);
    assert.equal((await db.query<{is_active: boolean}>('SELECT is_active FROM players WHERE id=$1', [original])).rows[0].is_active, false);
    await db.query("UPDATE players SET nickname='Renomeado' WHERE id=$1", [original]);
    await db.exec(sql);
    assert.equal((await db.query<{n: number}>('SELECT count(*)::int n FROM players')).rows[0].n, 39);
    assert.equal((await db.query<{n: number}>('SELECT count(*)::int n FROM historical_player_totals')).rows[0].n, 39);
    await assert.rejects(db.exec(sql.replace("('Chitao',60,37,23,0)", "('Chitao',61,38,23,0)")), /histórico diferente/);
    await db.exec('ROLLBACK');
    assert.equal((await db.query<{goals: number}>("SELECT goals FROM historical_player_totals WHERE source_name='Chitao'")).rows[0].goals, 37);
    await db.exec('DELETE FROM historical_player_totals; DELETE FROM players;');
    await db.exec("INSERT INTO players(name) VALUES ('Chitão'), ('Chitao');");
    await assert.rejects(db.exec(sql), /Mais de um cadastro/);
    await db.exec('ROLLBACK');
    assert.equal((await db.query<{n: number}>('SELECT count(*)::int n FROM historical_player_totals')).rows[0].n, 0);
    assert.equal((await db.query<{n: number}>('SELECT count(*)::int n FROM players')).rows[0].n, 2);
    const privileges = (await db.query(`SELECT has_table_privilege('anon','historical_player_totals','INSERT') AS insert,
      has_table_privilege('authenticated','historical_player_totals','UPDATE') AS update,
      has_table_privilege('anon','historical_player_totals','SELECT') AS read`)).rows[0];
    assert.deepEqual(privileges, { insert: false, update: false, read: true });
  } finally { await db.close(); }
});
