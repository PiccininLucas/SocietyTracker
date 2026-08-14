export interface TransferPlayerInputDTO {
  sessionId?: string;
  fromTeamId: string;
  toTeamId: string;
  playerId: string;
  isLoaned?: boolean;
}

export interface TransferPlayerOutputDTO {
  success: boolean;
  message: string;
  playerId: string;
  fromTeamId: string;
  toTeamId: string;
  isLoaned: boolean;
}
