import type { Match } from '../entities/Match';
import type { MatchEvent, MatchEventProps } from '../entities/MatchEvent';
import type { IMatchCommands } from './IMatchCommands';

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
  isUnattributed?: boolean;
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
  inferred?: boolean;
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
  deletedAt?: string;
  sequence?: number;
  lockedAt?: string | null;
  editable?: boolean;
  sessionStatus?: string;
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
  /** Atomic persistence when the backing store supports transactions. */
  executeCommand?: IMatchCommands['executeCommand'];
  findById(id: string): Promise<Match | null>;
  findBySessionId(sessionId: string): Promise<Match[]>;
  findActiveMatch(sessionId: string): Promise<Match | null>;
  create(match: Match): Promise<Match>;
  update(match: Match): Promise<Match>;
  addEvent(event: MatchEvent): Promise<MatchEvent>;
  findEventById(eventId: string): Promise<MatchEvent | null>;
  updateEvent(eventId: string, data: Partial<MatchEventProps>): Promise<void>;
  deleteEvent(eventId: string): Promise<void>;
  recalculateMatchScore(matchId: string): Promise<{ homeScore: number; awayScore: number }>;
  getEventsByMatchId(matchId: string): Promise<MatchEvent[]>;
  getLeaderboard(): Promise<LeaderboardItem[]>;
  getLeaderboardByDateRange(startDate?: string, endDate?: string): Promise<LeaderboardItem[]>;
  getMatchesSummary(sessionId?: string): Promise<MatchSummary[]>;
  getMatchById(matchId: string): Promise<MatchSummary | null>;
}
