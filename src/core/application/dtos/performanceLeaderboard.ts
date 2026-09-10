import type { PlayerPerformance } from '../../domain/services/CompetitionService';
import type { LeaderboardItemDTO } from './LeaderboardDTO';

export function performanceLeaderboard(p: PlayerPerformance): LeaderboardItemDTO {
  return {
    playerId: p.playerId, name: p.name, nickname: p.nickname,
    displayName: p.nickname || p.name, avatarUrl: p.avatarUrl,
    totalGoals: p.goals, totalAssists: p.assists, totalContributions: p.contributions,
    totalMatchesPlayed: p.hasHistoricalTotals ? null : p.played,
    totalSessionsPlayed: p.hasHistoricalTotals ? null : p.sessions,
    goalsPerMatch: p.hasHistoricalTotals ? null : p.played ? Number((p.goals / p.played).toFixed(2)) : 0,
    hasHistoricalTotals: p.hasHistoricalTotals ?? false,
    totalBottomCount: p.bottomCount,
    recordedMatchesPlayed: p.played,
    recordedGoalsPerMatch: p.played ? Number(((p.recordedGoals ?? p.goals) / p.played).toFixed(2)) : null,
  };
}
