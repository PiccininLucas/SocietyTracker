import type { ISessionRepository } from '../../domain/repositories/ISessionRepository';
import type { IMatchRepository } from '../../domain/repositories/IMatchRepository';
import {
  RoundHighlightsService,
  type PlayerRoundStats,
} from '../../domain/services/RoundHighlightsService';
import type {
  GetRoundHighlightsInputDTO,
  RoundHighlightsOutputDTO,
} from '../dtos/RoundHighlightsDTO';
export class GetRoundHighlightsUseCase {
  constructor(
    private sessionRepo: ISessionRepository,
    private matchRepo: IMatchRepository
  ) {}
  async execute(input?: GetRoundHighlightsInputDTO): Promise<RoundHighlightsOutputDTO | null> {
    const session = input?.sessionId
      ? await this.sessionRepo.findById(input.sessionId)
      : input?.date
        ? await this.sessionRepo.findByDate(input.date)
        : await this.sessionRepo.findLatest();
    if (!session?.id) return null;
    const matches = (await this.matchRepo.getMatchesSummary(session.id)).filter(
      (m) => m.status === 'finished'
    );
    // Identifica goleiros oficiais a partir dos elencos escalados na sessão
    const officialGoalkeepers = new Set<string>();
    if (session.teams && session.teams.length > 0) {
      for (const team of session.teams) {
        for (const tp of team.players) {
          if (tp.isGoalkeeper) {
            officialGoalkeepers.add(tp.playerId);
          }
        }
      }
    }

    const rows = new Map<string, PlayerRoundStats>();
    for (const m of matches) {
      for (const [players, name, color] of [
        [m.homePlayers ?? [], m.homeTeamName, m.homeTeamColor],
        [m.awayPlayers ?? [], m.awayTeamName, m.awayTeamColor],
      ] as const) {
        for (const p of players) {
          if (!rows.has(p.id)) {
            const isGk =
              officialGoalkeepers.size > 0
                ? officialGoalkeepers.has(p.id)
                : (p.isGoalkeeper ?? false);
            rows.set(p.id, {
              playerId: p.id,
              name: p.name,
              nickname: p.nickname,
              avatarUrl: p.avatarUrl,
              teamName: name,
              teamColor: color,
              isGoalkeeper: isGk,
              goals: 0,
              assists: 0,
              contributions: 0,
            });
          }
        }
      }
      for (const e of m.events ?? []) {
        if (e.isOwnGoal) continue;
        if (e.scorerId && rows.has(e.scorerId)) rows.get(e.scorerId)!.goals++;
        if (e.assistId && rows.has(e.assistId)) rows.get(e.assistId)!.assists++;
      }
    }
    const stats = [...rows.values()]
      .map((r) => ({ ...r, contributions: r.goals + r.assists }))
      .sort(
        (a, b) =>
          b.contributions - a.contributions ||
          b.goals - a.goals ||
          a.name.localeCompare(b.name, 'pt-BR')
      );
    return {
      sessionId: session.id,
      sessionDate: session.sessionDate,
      status: session.status,
      totalMatches: matches.length,
      totalGoals: matches.reduce((n, m) => n + m.homeScore + m.awayScore, 0),
      highlights: RoundHighlightsService.calculate(stats),
      players: stats.map((p) => ({
        ...p,
        rank: 1 + stats.filter((o) => o.contributions > p.contributions).length,
      })),
    };
  }
}
