export interface LeaderboardRankedItemDTO {
  rank: number;
  playerId: string;
  name: string;
  nickname: string | null;
  avatarUrl: string | null;
  value: number;
  secondaryInfo?: string;
  totalGoals: number;
  totalAssists: number;
  totalContributions: number;
  totalSessionsPlayed: number;
}

export interface GetPeriodLeaderboardInputDTO {
  type: 'all' | 'month';
  yearMonth?: string; // e.g. '2026-08'
}

export interface PeriodLeaderboardOutputDTO {
  periodType: 'all' | 'month';
  periodLabel: string;
  yearMonth?: string;
  totalPlayers: number;
  byContributions: LeaderboardRankedItemDTO[];
  byGoals: LeaderboardRankedItemDTO[];
  byAssists: LeaderboardRankedItemDTO[];
}
