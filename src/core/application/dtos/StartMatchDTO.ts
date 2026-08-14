export interface StartMatchInput {
  sessionId: string;
  homeTeamId: string;
  awayTeamId: string;
}

export interface StartMatchOutput {
  id: string;
  sessionId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  durationSeconds: number;
  status: 'ongoing' | 'finished';
  startedAt: Date;
}
