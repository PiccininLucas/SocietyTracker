import type { IMatchRepository } from '../../domain/repositories/IMatchRepository';
import type { LeaderboardItemDTO } from '../dtos/LeaderboardDTO';

export class GetLeaderboardUseCase {
  constructor(private matchRepository: IMatchRepository) {}

  public async execute(): Promise<LeaderboardItemDTO[]> {
    const rawLeaderboard = await this.matchRepository.getLeaderboard();

    return rawLeaderboard.map((item) => {
      const totalGoals = Number(item.totalGoals) || 0;
      const totalMatchesPlayed = item.hasHistoricalTotals || item.totalMatchesPlayed === null
        ? null : Number(item.totalMatchesPlayed ?? item.totalSessionsPlayed) || 0;
      const goalsPerMatch =
        totalMatchesPlayed === null ? null : item.goalsPerMatch !== undefined && item.goalsPerMatch !== null
          ? Number(item.goalsPerMatch)
          : totalMatchesPlayed > 0
          ? Number((totalGoals / totalMatchesPlayed).toFixed(2))
          : 0;

      return {
        playerId: item.playerId,
        name: item.name,
        nickname: item.nickname,
        displayName: item.nickname || item.name,
        avatarUrl: item.avatarUrl,
        totalGoals,
        totalAssists: Number(item.totalAssists) || 0,
        totalContributions: Number(item.totalContributions) || 0,
        totalMatchesPlayed,
        totalSessionsPlayed: item.hasHistoricalTotals || item.totalSessionsPlayed === null
          ? null : Number(item.totalSessionsPlayed) || 0,
        goalsPerMatch,
        hasHistoricalTotals: item.hasHistoricalTotals,
        totalBottomCount: item.totalBottomCount,
        recordedMatchesPlayed: item.recordedMatchesPlayed,
        recordedGoalsPerMatch: item.recordedGoalsPerMatch,
      };
    });
  }
}
