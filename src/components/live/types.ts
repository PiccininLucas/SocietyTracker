export interface LivePlayer {
  id: string;
  name: string;
  nickname?: string | null;
  avatarUrl?: string | null;
  isLoaned?: boolean;
  isGoalkeeper?: boolean;
  originalTeamId?: string;
}

export interface LiveTeam {
  id: string;
  sessionId?: string;
  name: string;
  colorHex: string;
  players: LivePlayer[];
}

export interface LiveMatchEvent {
  id?: string;
  clientEventId: string;
  matchId: string;
  teamId: string;
  scorerId?: string | null;
  assistId?: string | null;
  eventTimeSeconds: number;
  isOwnGoal: boolean;
  scorerName?: string;
  assistName?: string;
  teamName?: string;
  createdAt: string;
}

export type MatchEndReason = 'two_goals' | 'time_limit' | 'manual';
export type MatchStatus = 'ongoing' | 'finished';

export interface LiveMatchState {
  id: string;
  sessionId: string;
  homeTeam: LiveTeam;
  awayTeam: LiveTeam;
  allSessionTeams?: LiveTeam[];
  homeScore: number;
  awayScore: number;
  secondsRemaining: number; // countdown from 420 to 0
  durationSeconds: number; // elapsed time
  status: MatchStatus;
  endReason?: MatchEndReason | null;
  events: LiveMatchEvent[];
  isTimerRunning: boolean;
  startedAt: string;
  finishedAt?: string | null;
  lastSavedAt?: string;
}

export interface ActiveMatchStorageSchema {
  version: number;
  match: LiveMatchState;
  pendingSyncEvents: LiveMatchEvent[];
  savedAt: string;
}

export const ACTIVE_MATCH_STORAGE_KEY = 'society_active_match_state';
export const DEFAULT_MATCH_DURATION_SECONDS = 420; // 7 minutes
export const MAX_GOALS_FOR_VICTORY = 2;
