import type { MatchEndReason, MatchStatus } from '../../domain/entities/Match';

export interface UpdateMatchScoreInput {
  matchId: string;
  homeScore?: number;
  awayScore?: number;
  status?: MatchStatus;
  endReason?: MatchEndReason | null;
  durationSeconds?: number;
}

export interface UpdateMatchScoreOutput {
  id: string;
  sessionId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  durationSeconds: number;
  endReason?: string | null;
  status: 'ongoing' | 'finished';
  isFinished: boolean;
}
