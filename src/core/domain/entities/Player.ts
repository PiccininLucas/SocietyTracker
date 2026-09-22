export interface PlayerProps {
  id?: string;
  name: string;
  nickname?: string | null;
  avatarUrl?: string | null;
  isGoalkeeper?: boolean;
  isActive?: boolean;
  createdAt?: Date;
}

export class Player {
  private props: PlayerProps;

  constructor(props: PlayerProps) {
    if (!props.name || props.name.trim().length === 0) {
      throw new Error('Nome do jogador é obrigatório.');
    }

    this.props = {
      ...props,
      name: props.name.trim(),
      nickname: props.nickname ? props.nickname.trim() : null,
      avatarUrl: props.avatarUrl || null,
      isGoalkeeper: props.isGoalkeeper ?? false,
      isActive: props.isActive ?? true,
      createdAt: props.createdAt ?? new Date(),
    };
  }

  get id(): string | undefined {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get nickname(): string | null | undefined {
    return this.props.nickname;
  }

  get displayName(): string {
    return this.props.nickname || this.props.name;
  }

  get avatarUrl(): string | null | undefined {
    return this.props.avatarUrl;
  }

  get isGoalkeeper(): boolean {
    return !!this.props.isGoalkeeper;
  }

  get isActive(): boolean {
    return !!this.props.isActive;
  }

  get createdAt(): Date | undefined {
    return this.props.createdAt;
  }

  /**
   * Atualização parcial: um campo `undefined` significa "não informado" e é preservado.
   * Para limpar o apelido é preciso enviar `null` (ou string vazia) explicitamente —
   * antes, omitir o campo apagava o apelido do atleta sem possibilidade de recuperação.
   */
  public updateInfo(name?: string, nickname?: string | null, isGoalkeeper?: boolean): void {
    if (name !== undefined) {
      if (name.trim().length === 0) {
        throw new Error('Nome do jogador é obrigatório.');
      }
      this.props.name = name.trim();
    }

    if (nickname !== undefined) {
      const trimmed = nickname?.trim();
      this.props.nickname = trimmed ? trimmed : null;
    }

    if (typeof isGoalkeeper === 'boolean') {
      this.props.isGoalkeeper = isGoalkeeper;
    }
  }

  get state(): Readonly<PlayerProps> {
    return this.props;
  }
}
