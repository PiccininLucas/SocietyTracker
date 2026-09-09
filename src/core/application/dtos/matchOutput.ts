import type { MatchSummary } from '../../domain/repositories/IMatchRepository';

/** Preserve existing DTO fields while returning the acknowledged database result. */
export function matchOutput(match: MatchSummary) {
  return {
    id: match.matchId,
    sessionId: match.sessionId,
    homeTeamId: match.homeTeamId!,
    awayTeamId: match.awayTeamId!,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    durationSeconds: match.durationSeconds,
    endReason: match.endReason,
    status: match.status,
    isFinished: match.status === 'finished',
  };
}
