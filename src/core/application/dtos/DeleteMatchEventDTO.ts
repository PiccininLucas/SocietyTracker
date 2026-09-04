export interface DeleteMatchEventInput {
  matchId: string;
  eventId: string;
}

export interface DeleteMatchEventOutput {
  matchId: string;
  eventId: string;
  homeScore: number;
  awayScore: number;
}
