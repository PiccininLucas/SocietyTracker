import type { IMatchRepository } from '../../domain/repositories/IMatchRepository';
import type { LeaderboardItemDTO } from '../dtos/LeaderboardDTO';

export class GetLeaderboardUseCase {
  constructor(private matchRepository: IMatchRepository) {}

  public async execute(): Promise<LeaderboardItemDTO[]> {
    const rawLeaderboard = await this.matchRepository.getLeaderboard();

    return rawLeaderboard.map((item) => ({
      playerId: item.playerId,
      name: item.name,
      nickname: item.nickname,
      displayName: item.nickname || item.name,
      avatarUrl: item.avatarUrl,
      totalGoals: Number(item.totalGoals) || 0,
      totalAssists: Number(item.totalAssists) || 0,
      totalContributions: Number(item.totalContributions) || 0,
      totalSessionsPlayed: Number(item.totalSessionsPlayed) || 0,
    }));
  }
}
