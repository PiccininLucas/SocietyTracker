export interface UpdatePlayerInputDTO {
  id: string;
  name: string;
  nickname?: string | null;
  isGoalkeeper?: boolean;
}

export interface UpdatePlayerOutputDTO {
  id: string;
  name: string;
  nickname: string | null;
  avatarUrl: string | null;
  isGoalkeeper: boolean;
  isActive: boolean;
  createdAt: Date;
}
