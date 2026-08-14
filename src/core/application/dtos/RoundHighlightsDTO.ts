import type { PlayerRoundStats, RoundHighlights } from '../../domain/services/RoundHighlightsService';

export interface GetRoundHighlightsInputDTO {
  sessionId?: string;
  date?: string;
}

export interface RoundSummaryPlayerDTO extends PlayerRoundStats {
  rank: number;
}

export interface RoundHighlightsOutputDTO {
  sessionId: string;
  sessionDate: string;
  status: string;
  totalMatches: number;
  totalGoals: number;
  highlights: RoundHighlights;
  players: RoundSummaryPlayerDTO[];
}
