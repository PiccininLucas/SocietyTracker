export interface LeaderboardItemDTO {
  playerId: string;
  name: string;
  nickname: string | null;
  displayName: string;
  avatarUrl: string | null;
  totalGoals: number;
  totalAssists: number;
  totalContributions: number;
  totalSessionsPlayed: number;
}
