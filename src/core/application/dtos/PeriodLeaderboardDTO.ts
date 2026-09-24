import type { MatchSummary } from '../../domain/repositories/IMatchRepository';
import type { HistoricalPlayerTotal } from '../../domain/entities/HistoricalPlayerTotal';

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
  totalMatchesPlayed?: number | null;
  totalSessionsPlayed: number | null;
  goalsPerMatch?: number | null;
}

export interface PreloadedLeaderboardData {
  matches: MatchSummary[];
  players: {
    id: string;
    name: string;
    nickname?: string | null;
    avatarUrl?: string | null;
    isActive?: boolean;
  }[];
  historical: HistoricalPlayerTotal[];
}

export interface GetPeriodLeaderboardInputDTO {
  type: 'all' | 'month' | 'year';
  year?: string;
  yearMonth?: string; // e.g. '2026-08'
  preloadedData?: PreloadedLeaderboardData;
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
