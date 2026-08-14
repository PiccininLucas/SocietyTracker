import { InvalidGoalEventError } from '../errors/InvalidGoalEventError';

export interface MatchEventProps {
  id?: string;
  matchId: string;
  teamId: string;
  scorerId?: string | null;
  assistId?: string | null;
  eventTimeSeconds?: number;
  isOwnGoal?: boolean;
  createdAt?: Date;
}

export class MatchEvent {
  private props: MatchEventProps;

  constructor(props: MatchEventProps) {
    if (!props.matchId) {
      throw new Error('ID da partida é obrigatório.');
    }
    if (!props.teamId) {
      throw new Error('ID do time é obrigatório.');
    }

    const isOwnGoal = props.isOwnGoal ?? false;

    if (!isOwnGoal && !props.scorerId) {
      throw new InvalidGoalEventError('Gol normal exige a identificação do autor do gol (scorerId).');
    }

    if (isOwnGoal && props.assistId) {
      throw new InvalidGoalEventError('Gol contra não pode ter assistência.');
    }

    if (props.scorerId && props.assistId && props.scorerId === props.assistId) {
      throw new InvalidGoalEventError('O autor do gol não pode ser o mesmo da assistência.');
    }

    this.props = {
      ...props,
      scorerId: props.scorerId ?? null,
      assistId: props.assistId ?? null,
      eventTimeSeconds: props.eventTimeSeconds ?? 0,
      isOwnGoal,
      createdAt: props.createdAt ?? new Date(),
    };
  }

  get id(): string | undefined {
    return this.props.id;
  }

  get matchId(): string {
    return this.props.matchId;
  }

  get teamId(): string {
    return this.props.teamId;
  }

  get scorerId(): string | null | undefined {
    return this.props.scorerId;
  }

  get assistId(): string | null | undefined {
    return this.props.assistId;
  }

  get eventTimeSeconds(): number {
    return this.props.eventTimeSeconds ?? 0;
  }

  get isOwnGoal(): boolean {
    return !!this.props.isOwnGoal;
  }

  get createdAt(): Date | undefined {
    return this.props.createdAt;
  }

  get state(): Readonly<MatchEventProps> {
    return this.props;
  }
}
