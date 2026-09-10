export interface LeaderboardItemDTO {
  playerId: string;
  name: string;
  nickname: string | null;
  displayName: string;
  avatarUrl: string | null;
  totalGoals: number;
  totalAssists: number;
  totalContributions: number;
  totalMatchesPlayed: number | null;
  totalSessionsPlayed: number | null;
  goalsPerMatch: number | null;
  hasHistoricalTotals?: boolean;
  totalBottomCount?: number;
  recordedMatchesPlayed?: number;
  recordedGoalsPerMatch?: number | null;
}
