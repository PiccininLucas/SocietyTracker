export interface CreatePlayerInputDTO {
  name: string;
  nickname?: string | null;
  avatarUrl?: string | null;
  isActive?: boolean;
}

export interface CreatePlayerOutputDTO {
  id: string;
  name: string;
  nickname: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: Date;
}
