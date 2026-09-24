import { createServer } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { createDatabase, migrate } from '../helpers/db';
import type { APIContext } from 'astro';
import { matchCommand, json, apiError } from '../../src/core/infrastructure/http/matchApi';
import type { MatchCommand } from '../../src/core/domain/repositories/IMatchCommands';
import type { MatchSummary } from '../../src/core/domain/repositories/IMatchRepository';
import { sid, teams, rounds } from './data';
import { GetPeriodLeaderboardUseCase } from '../../src/core/application/use-cases/GetPeriodLeaderboardUseCase';
import type { IMatchRepository } from '../../src/core/domain/repositories/IMatchRepository';
import { playerPerformance } from '../../src/core/domain/services/CompetitionService';
const db = await createDatabase();
await migrate(db);
for (const round of [{ id: sid, sessionDate: '2026-09-03', teams }, ...Object.values(rounds)]) {
  await db.query('INSERT INTO sessions(id,session_date) VALUES($1,$2)', [
    round.id,
    round.sessionDate,
  ]);
  for (const t of round.teams) {
    await db.query('INSERT INTO session_teams(id,session_id,name,color_hex) VALUES($1,$2,$3,$4)', [
      t.id,
      round.id,
      t.name,
      t.colorHex,
    ]);
    for (const p of t.players) {
      await db.query('INSERT INTO players(id,name) VALUES($1,$2) ON CONFLICT DO NOTHING', [
        p.id,
        p.name,
      ]);
      await db.query(
        'INSERT INTO session_team_players(session_team_id,player_id,is_goalkeeper) VALUES($1,$2,$3)',
        [t.id, p.id, p.isGoalkeeper]
      );
    }
  }
}
/** Partidas de uma rodada; `null` devolve todas as rodadas. */
async function snapshot(sessionId: string | null = sid) {
  const r = await db.query<{ data: MatchSummary[] }>('SELECT society_matches_snapshot($1) data', [
    sessionId,
  ]);
  return r.rows[0].data;
}
const reportRepository = {
  async getLeaderboardByDateRange(start?: string, end?: string) {
    return playerPerformance(
      (await snapshot()).filter(
        (m) => (!start || m.sessionDate >= start) && (!end || m.sessionDate <= end)
      ),
      teams.flatMap((t) => t.players.map((p) => ({ ...p, isActive: true })))
    ).map((p) => ({
      playerId: p.playerId,
      name: p.name,
      nickname: p.nickname,
      avatarUrl: p.avatarUrl,
      totalGoals: p.goals,
      totalAssists: p.assists,
      totalContributions: p.contributions,
      totalMatchesPlayed: p.played,
      totalSessionsPlayed: p.sessions,
    }));
  },
} as IMatchRepository;
const repository = {
  async executeCommand(command: MatchCommand) {
    const r = await db.query<{
      data: { match_id: string; event_id: string; deleted_match?: MatchSummary };
    }>('SELECT society_match_command($1,$2,$3,$4) data', [
      command.action,
      command.matchId ?? null,
      JSON.stringify(command.input),
      command.operationId,
    ]);
    return {
      match:
        r.rows[0].data.deleted_match ??
        (await snapshot(null)).find((m) => m.matchId === r.rows[0].data.match_id)!,
      eventId: r.rows[0].data.event_id,
    };
  },
};
const server = await createServer({
  configFile: false,
  oxc: { jsx: { runtime: 'automatic' } },
  plugins: [
    {
      name: 'test-api',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith('/api/')) return next();
          try {
            const path = new URL(req.url, 'http://127.0.0.1:4322').pathname;
            let response: Response;
            const parts = path.split('/');
            if (path === '/api/auth/status') response = json({ isAuthenticated: true });
            else if (path === '/api/reports/period') {
              const query = new URL(req.url, 'http://127.0.0.1:4322').searchParams;
              response = json(
                await new GetPeriodLeaderboardUseCase(reportRepository).execute({
                  type: query.get('type') === 'year' ? 'year' : 'all',
                  year: query.get('year') ?? undefined,
                })
              );
            } else if (path === '/api/sessions') response = json({ id: sid, teams });
            else if (path.includes('/sessions/')) response = json(await snapshot(parts[3]));
            else if (req.method === 'GET')
              response = json((await snapshot(null)).find((m) => m.matchId === parts[3]));
            else {
              const chunks: Buffer[] = [];
              for await (const chunk of req) chunks.push(Buffer.from(chunk));
              const request = new Request('http://127.0.0.1:4322' + path, {
                method: req.method,
                headers: {
                  'Content-Type': 'application/json',
                  'Idempotency-Key': String(req.headers['idempotency-key'] ?? crypto.randomUUID()),
                },
                ...(req.method === 'DELETE' ? {} : { body: Buffer.concat(chunks).toString() }),
              });
              const action =
                parts[3] === 'start'
                  ? 'start'
                  : parts[4] === 'goals'
                    ? 'goal'
                    : parts[4] === 'finish'
                      ? 'finish'
                      : parts[4] === 'events'
                        ? req.method === 'DELETE'
                          ? 'delete'
                          : 'edit'
                        : req.method === 'DELETE'
                          ? 'remove_match'
                          : 'score';
              response = await matchCommand(
                { request, params: { id: parts[3], eventId: parts[5] } } as unknown as APIContext,
                action,
                repository
              );
            }
            res.statusCode = response.status;
            response.headers.forEach((v, k) => res.setHeader(k, v));
            res.end(await response.text());
          } catch (e) {
            const r = apiError(e);
            res.statusCode = r.status;
            res.setHeader('Content-Type', 'application/json');
            res.end(await r.text());
          }
        });
      },
    },
    tailwindcss(),
  ],
  server: { host: '127.0.0.1', port: 4322 },
  appType: 'spa',
});
await server.listen();
