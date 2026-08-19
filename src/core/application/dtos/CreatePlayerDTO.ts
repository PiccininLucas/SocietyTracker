export interface CreatePlayerInputDTO {
  name: string;
  nickname?: string | null;
  avatarUrl?: string | null;
  isGoalkeeper?: boolean;
  isActive?: boolean;
}

export interface CreatePlayerOutputDTO {
  id: string;
  name: string;
  nickname: string | null;
  avatarUrl: string | null;
  isGoalkeeper: boolean;
  isActive: boolean;
  createdAt: Date;
}
