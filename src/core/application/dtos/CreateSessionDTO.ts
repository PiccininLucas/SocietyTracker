export interface CreateSessionTeamPlayerInputDTO {
  playerId: string;
  isGoalkeeper?: boolean;
}

export interface CreateSessionTeamInputDTO {
  name: string;
  colorHex?: string;
  playerIds?: string[];
  players?: (string | CreateSessionTeamPlayerInputDTO)[];
}

export interface CreateSessionInputDTO {
  sessionDate: string;
  notes?: string | null;
  teams?: CreateSessionTeamInputDTO[];
}

export interface CreatedTeamOutputDTO {
  id: string;
  sessionId: string;
  name: string;
  colorHex: string;
  playersCount: number;
}

export interface CreateSessionOutputDTO {
  id: string;
  sessionDate: string;
  status: 'ongoing' | 'finished';
  notes: string | null;
  teams: CreatedTeamOutputDTO[];
  createdAt: Date;
}
