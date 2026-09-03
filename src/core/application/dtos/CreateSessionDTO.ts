export interface CreateSessionTeamPlayerInputDTO {
  playerId: string;
  isGoalkeeper?: boolean;
  isCaptain?: boolean;
}

export interface CreateSessionTeamInputDTO {
  name: string;
  colorHex?: string;
  captainId?: string | null;
  playerIds?: string[];
  players?: (string | CreateSessionTeamPlayerInputDTO)[];
}

export interface CreateSessionInputDTO {
  sessionDate: string;
  notes?: string | null;
  matchDurationSeconds?: number;
  teams?: CreateSessionTeamInputDTO[];
}

export interface CreatedTeamOutputDTO {
  id: string;
  sessionId: string;
  name: string;
  colorHex: string;
  captainId?: string | null;
  playersCount: number;
}

export interface CreateSessionOutputDTO {
  id: string;
  sessionDate: string;
  status: 'ongoing' | 'finished';
  notes: string | null;
  matchDurationSeconds: number;
  teams: CreatedTeamOutputDTO[];
  createdAt: Date;
}
