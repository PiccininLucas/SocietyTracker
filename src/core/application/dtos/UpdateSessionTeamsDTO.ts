export interface UpdateSessionTeamPlayerInputDTO {
  playerId: string;
  isGoalkeeper?: boolean;
  isLoaned?: boolean;
  isCaptain?: boolean;
}

export interface UpdateSessionTeamInputDTO {
  id: string;
  name: string;
  captainId?: string | null;
  colorHex?: string;
  players: UpdateSessionTeamPlayerInputDTO[];
}

export interface UpdateSessionTeamsInputDTO {
  sessionId: string;
  teams: UpdateSessionTeamInputDTO[];
}

export interface UpdateSessionTeamsOutputDTO {
  sessionId: string;
  teams: {
    id: string;
    sessionId: string;
    name: string;
    colorHex: string;
    captainId: string | null;
    playersCount: number;
    players: {
      id: string;
      name: string;
      nickname: string | null;
      avatarUrl: string | null;
      isGoalkeeper: boolean;
      isLoaned: boolean;
      isCaptain: boolean;
    }[];
  }[];
}
