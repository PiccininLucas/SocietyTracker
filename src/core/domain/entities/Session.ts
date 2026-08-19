import { Team } from './Team';

export type SessionStatus = 'ongoing' | 'finished';

export interface SessionProps {
  id?: string;
  sessionDate: string; // YYYY-MM-DD
  status?: SessionStatus;
  notes?: string | null;
  matchDurationSeconds?: number;
  teams?: Team[];
  createdAt?: Date;
}

export class Session {
  private props: SessionProps;

  constructor(props: SessionProps) {
    if (!props.sessionDate || props.sessionDate.trim().length === 0) {
      throw new Error('Data da sessão é obrigatória.');
    }

    this.props = {
      ...props,
      sessionDate: props.sessionDate.trim(),
      status: props.status ?? 'ongoing',
      notes: props.notes ?? null,
      matchDurationSeconds: props.matchDurationSeconds ?? 420,
      teams: props.teams ? [...props.teams] : [],
      createdAt: props.createdAt ?? new Date(),
    };
  }

  get id(): string | undefined {
    return this.props.id;
  }

  get sessionDate(): string {
    return this.props.sessionDate;
  }

  get status(): SessionStatus {
    return this.props.status ?? 'ongoing';
  }

  get notes(): string | null | undefined {
    return this.props.notes;
  }

  get matchDurationSeconds(): number {
    return this.props.matchDurationSeconds ?? 420;
  }

  get teams(): Team[] {
    return this.props.teams ?? [];
  }

  get isFinished(): boolean {
    return this.props.status === 'finished';
  }

  get createdAt(): Date | undefined {
    return this.props.createdAt;
  }

  public finish(): void {
    this.props.status = 'finished';
  }

  public reopen(): void {
    this.props.status = 'ongoing';
  }

  public addTeam(team: Team): void {
    if (!this.props.teams) {
      this.props.teams = [];
    }
    this.props.teams.push(team);
  }

  get state(): Readonly<SessionProps> {
    return this.props;
  }
}
