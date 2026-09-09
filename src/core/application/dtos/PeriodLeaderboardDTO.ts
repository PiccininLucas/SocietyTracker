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
  totalMatchesPlayed?: number;
  totalSessionsPlayed: number;
  goalsPerMatch?: number;
}

export interface GetPeriodLeaderboardInputDTO {
  type: 'all' | 'month' | 'year';
  year?: string;
  yearMonth?: string; // e.g. '2026-08'
}

export interface PeriodLeaderboardOutputDTO {
  periodType: 'all' | 'month' | 'year';
  year?: string;
  periodLabel: string;
  yearMonth?: string;
  totalPlayers: number;
  byContributions: LeaderboardRankedItemDTO[];
  byGoals: LeaderboardRankedItemDTO[];
  byAssists: LeaderboardRankedItemDTO[];
}
