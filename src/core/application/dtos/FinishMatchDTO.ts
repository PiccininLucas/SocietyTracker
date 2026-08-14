import type { MatchEndReason } from '../../domain/entities/Match';

export interface FinishMatchInput {
  matchId: string;
  durationSeconds?: number;
  reason?: MatchEndReason;
}

export interface FinishMatchOutput {
  id: string;
  sessionId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  durationSeconds: number;
  endReason: MatchEndReason | null;
  status: 'ongoing' | 'finished';
  finishedAt: Date | null;
}
