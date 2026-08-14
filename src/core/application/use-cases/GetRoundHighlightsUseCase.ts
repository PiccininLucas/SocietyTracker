import type { ISessionRepository } from '../../domain/repositories/ISessionRepository';
import type { IMatchRepository } from '../../domain/repositories/IMatchRepository';
import {
  RoundHighlightsService,
  type PlayerRoundStats,
} from '../../domain/services/RoundHighlightsService';
import type {
  GetRoundHighlightsInputDTO,
  RoundHighlightsOutputDTO,
  RoundSummaryPlayerDTO,
} from '../dtos/RoundHighlightsDTO';

export class GetRoundHighlightsUseCase {
  constructor(
    private sessionRepo: ISessionRepository,
    private matchRepo: IMatchRepository
  ) {}

  public async execute(
    input?: GetRoundHighlightsInputDTO
  ): Promise<RoundHighlightsOutputDTO | null> {
    let session = null;

    if (input?.sessionId) {
      session = await this.sessionRepo.findById(input.sessionId);
    } else if (input?.date) {
      session = await this.sessionRepo.findByDate(input.date);
    } else {
      session = await this.sessionRepo.findLatest();
    }

    if (!session || !session.id) {
      return null;
    }

    // 1. Mapear todos os jogadores presentes nos times daquela sessão
    const playerStatsMap = new Map<string, PlayerRoundStats>();

    for (const team of session.teams) {
      for (const tp of team.players) {
        if (!playerStatsMap.has(tp.playerId)) {
          playerStatsMap.set(tp.playerId, {
            playerId: tp.playerId,
            name: tp.player?.name || 'Jogador',
            nickname: tp.player?.nickname || null,
            avatarUrl: tp.player?.avatarUrl || null,
            teamName: team.name,
            teamColor: team.colorHex,
            goals: 0,
            assists: 0,
            contributions: 0,
          });
        }
      }
    }

    // 2. Buscar todas as partidas da sessão e seus eventos
    const matches = await this.matchRepo.findBySessionId(session.id);
    let totalGoals = 0;

    for (const match of matches) {
      if (!match.id) continue;
      const events = await this.matchRepo.getEventsByMatchId(match.id);

      for (const ev of events) {
        if (ev.scorerId && !ev.isOwnGoal) {
          totalGoals++;
          const scorer = playerStatsMap.get(ev.scorerId);
          if (scorer) {
            scorer.goals += 1;
          }
        }

        if (ev.assistId) {
          const assister = playerStatsMap.get(ev.assistId);
          if (assister) {
            assister.assists += 1;
          }
        }
      }
    }

    // 3. Atualizar participações (G+A)
    const statsList: PlayerRoundStats[] = Array.from(playerStatsMap.values()).map((p) => ({
      ...p,
      contributions: p.goals + p.assists,
    }));

    // 4. Calcular Destaques da Rodada via Domínio Puro
    const highlights = RoundHighlightsService.calculate(statsList);

    // 5. Ordenar tabela do dia: G+A desc, Gols desc, Assists desc, Nome asc
    const sortedStats = [...statsList].sort((a, b) => {
      if (b.contributions !== a.contributions) {
        return b.contributions - a.contributions;
      }
      if (b.goals !== a.goals) {
        return b.goals - a.goals;
      }
      if (b.assists !== a.assists) {
        return b.assists - a.assists;
      }
      return a.name.localeCompare(b.name);
    });

    const rankedPlayers: RoundSummaryPlayerDTO[] = sortedStats.map((p, index) => ({
      ...p,
      rank: index + 1,
    }));

    return {
      sessionId: session.id,
      sessionDate: session.sessionDate,
      status: session.status,
      totalMatches: matches.length,
      totalGoals,
      highlights,
      players: rankedPlayers,
    };
  }
}
