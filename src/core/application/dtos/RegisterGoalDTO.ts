export interface RegisterGoalInput {
  matchId: string;
  teamId: string;
  scorerId?: string | null;
  assistId?: string | null;
  eventTimeSeconds?: number;
  isOwnGoal?: boolean;
}

export interface RegisterGoalOutput {
  match: {
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
  };
  event: {
    id?: string;
    matchId: string;
    teamId: string;
    scorerId?: string | null;
    assistId?: string | null;
    eventTimeSeconds: number;
    isOwnGoal: boolean;
  };
  isMatchFinished: boolean;
  matchEndReason?: string | null;
}
