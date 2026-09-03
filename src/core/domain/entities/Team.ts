export interface TeamPlayer {
  playerId: string;
  isLoaned?: boolean;
  isGoalkeeper?: boolean;
  isCaptain?: boolean;
  player?: {
    name: string;
    nickname?: string | null;
    avatarUrl?: string | null;
  };
}

export interface TeamProps {
  id?: string;
  sessionId: string;
  name: string;
  colorHex?: string;
  captainId?: string | null;
  players?: TeamPlayer[];
  createdAt?: Date;
}

export class Team {
  private props: TeamProps;

  constructor(props: TeamProps) {
    if (!props.sessionId) {
      throw new Error('ID da sessão é obrigatório.');
    }
    if (!props.name || props.name.trim().length === 0) {
      throw new Error('Nome do time é obrigatório.');
    }

    this.props = {
      ...props,
      name: props.name.trim(),
      colorHex: props.colorHex || '#333333',
      captainId: props.captainId ?? null,
      players: props.players ? [...props.players] : [],
      createdAt: props.createdAt ?? new Date(),
    };
  }

  get id(): string | undefined {
    return this.props.id;
  }

  get sessionId(): string {
    return this.props.sessionId;
  }

  get name(): string {
    return this.props.name;
  }

  get colorHex(): string {
    return this.props.colorHex || '#333333';
  }

  get captainId(): string | undefined {
    return this.props.captainId || undefined;
  }

  get players(): TeamPlayer[] {
    return this.props.players ?? [];
  }

  public setCaptain(captainId: string | null, captainNameOrNickname?: string): void {
    this.props.captainId = captainId;
    if (captainNameOrNickname && captainNameOrNickname.trim()) {
      this.props.name = `Time ${captainNameOrNickname.trim()}`;
    }
  }

  public addPlayer(playerId: string, isLoaned = false, isGoalkeeper = false, isCaptain = false): void {
    if (!this.props.players) {
      this.props.players = [];
    }
    if (!this.props.players.some((p) => p.playerId === playerId)) {
      this.props.players.push({ playerId, isLoaned, isGoalkeeper, isCaptain });
    }
  }

  public removePlayer(playerId: string): void {
    if (!this.props.players) return;
    this.props.players = this.props.players.filter((p) => p.playerId !== playerId);
    if (this.props.captainId === playerId) {
      this.props.captainId = null;
    }
  }

  get state(): Readonly<TeamProps> {
    return this.props;
  }
}
