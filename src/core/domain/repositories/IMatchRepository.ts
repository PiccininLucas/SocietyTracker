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
  totalMatchesPlayed?: number;
  totalSessionsPlayed: number;
  goalsPerMatch?: number;
}

export interface MatchSummaryEvent {
  id: string;
  matchId: string;
  teamId: string;
  scorerId?: string | null;
  scorerName?: string;
  assistId?: string | null;
  assistName?: string;
  eventTimeSeconds: number;
  isOwnGoal: boolean;
}

export interface MatchPlayerSummary {
  id: string;
  name: string;
  nickname: string | null;
  avatarUrl?: string | null;
  isCaptain: boolean;
  isGoalkeeper: boolean;
  isLoaned: boolean;
  goals: number;
  assists: number;
}

export interface MatchSummary {
  matchId: string;
  sessionId: string;
  sessionDate: string;
  homeTeamId?: string;
  homeTeamName: string;
  homeTeamColor: string;
  homeScore: number;
  awayTeamId?: string;
  awayTeamName: string;
  awayTeamColor: string;
  awayScore: number;
  durationSeconds: number;
  endReason: string | null;
  status: 'ongoing' | 'finished';
  startedAt: string;
  finishedAt: string | null;
  events?: MatchSummaryEvent[];
  homePlayers?: MatchPlayerSummary[];
  awayPlayers?: MatchPlayerSummary[];
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
  getMatchById(matchId: string): Promise<MatchSummary | null>;
}
