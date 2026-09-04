export interface UpdateMatchEventInput {
  matchId: string;
  eventId: string;
  teamId?: string;
  scorerId?: string | null;
  assistId?: string | null;
  isOwnGoal?: boolean;
}

export interface UpdateMatchEventOutput {
  eventId: string;
  matchId: string;
  homeScore: number;
  awayScore: number;
}
