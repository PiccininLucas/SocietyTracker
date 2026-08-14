import type { Match } from '../entities/Match';
import type { MatchEvent } from '../entities/MatchEvent';

export interface LeaderboardItem {
  playerId: string;
  name: string;
  nickname: string | null;
  avatarUrl: string | null;
  totalGoals: number;
  totalAssists: number;
  totalContributions: number;
  totalSessionsPlayed: number;
}

export interface MatchSummary {
  matchId: string;
  sessionId: string;
  sessionDate: string;
  homeTeamName: string;
  homeTeamColor: string;
  homeScore: number;
  awayTeamName: string;
  awayTeamColor: string;
  awayScore: number;
  durationSeconds: number;
  endReason: string | null;
  status: 'ongoing' | 'finished';
  startedAt: string;
  finishedAt: string | null;
}

export interface IMatchRepository {
  findById(id: string): Promise<Match | null>;
  findBySessionId(sessionId: string): Promise<Match[]>;
  findActiveMatch(sessionId: string): Promise<Match | null>;
  create(match: Match): Promise<Match>;
  update(match: Match): Promise<Match>;
  addEvent(event: MatchEvent): Promise<MatchEvent>;
  getEventsByMatchId(matchId: string): Promise<MatchEvent[]>;
  getLeaderboard(): Promise<LeaderboardItem[]>;
  getLeaderboardByDateRange(startDate?: string, endDate?: string): Promise<LeaderboardItem[]>;
  getMatchesSummary(sessionId?: string): Promise<MatchSummary[]>;
}
