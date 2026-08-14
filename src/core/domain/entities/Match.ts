import { MatchAlreadyFinishedError } from '../errors/MatchAlreadyFinishedError';

export type MatchEndReason = 'two_goals' | 'time_limit' | 'manual';
export type MatchStatus = 'ongoing' | 'finished';

export const MATCH_RULES = {
  MAX_GOALS_FOR_VICTORY: 2,
  MAX_DURATION_SECONDS: 420, // 7 minutes
} as const;

export interface MatchProps {
  id?: string;
  sessionId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore?: number;
  awayScore?: number;
  durationSeconds?: number;
  endReason?: MatchEndReason | null;
  status?: MatchStatus;
  startedAt?: Date;
  finishedAt?: Date | null;
}

export class Match {
  private props: MatchProps;

  constructor(props: MatchProps) {
    if (!props.sessionId) {
      throw new Error('ID da sessão é obrigatório.');
    }
    if (!props.homeTeamId || !props.awayTeamId) {
      throw new Error('Times mandante e visitante são obrigatórios.');
    }
    if (props.homeTeamId === props.awayTeamId) {
      throw new Error('O time mandante e visitante não podem ser o mesmo.');
    }

    this.props = {
      ...props,
      homeScore: props.homeScore ?? 0,
      awayScore: props.awayScore ?? 0,
      durationSeconds: props.durationSeconds ?? 0,
      endReason: props.endReason ?? null,
      status: props.status ?? 'ongoing',
      startedAt: props.startedAt ?? new Date(),
      finishedAt: props.finishedAt ?? null,
    };
  }

  get id(): string | undefined {
    return this.props.id;
  }

  get sessionId(): string {
    return this.props.sessionId;
  }

  get homeTeamId(): string {
    return this.props.homeTeamId;
  }

  get awayTeamId(): string {
    return this.props.awayTeamId;
  }

  get homeScore(): number {
    return this.props.homeScore ?? 0;
  }

  get awayScore(): number {
    return this.props.awayScore ?? 0;
  }

  get durationSeconds(): number {
    return this.props.durationSeconds ?? 0;
  }

  get endReason(): MatchEndReason | null | undefined {
    return this.props.endReason;
  }

  get status(): MatchStatus {
    return this.props.status ?? 'ongoing';
  }

  get isFinished(): boolean {
    return this.props.status === 'finished';
  }

  get startedAt(): Date | undefined {
    return this.props.startedAt;
  }

  get finishedAt(): Date | null | undefined {
    return this.props.finishedAt;
  }

  public registerGoal(teamId: string, currentDurationSeconds?: number): { finished: boolean; reason?: MatchEndReason } {
    if (this.isFinished) {
      throw new MatchAlreadyFinishedError('Partida já encerrada.');
    }

    if (currentDurationSeconds !== undefined) {
      this.updateDuration(currentDurationSeconds);
      if (this.isFinished) {
        return { finished: true, reason: this.props.endReason || 'time_limit' };
      }
    }

    if (teamId === this.props.homeTeamId) {
      this.props.homeScore = (this.props.homeScore ?? 0) + 1;
    } else if (teamId === this.props.awayTeamId) {
      this.props.awayScore = (this.props.awayScore ?? 0) + 1;
    } else {
      throw new Error('Time informado não pertence a esta partida.');
    }

    // Regra de Vitória: 2 gols
    if (
      (this.props.homeScore ?? 0) >= MATCH_RULES.MAX_GOALS_FOR_VICTORY ||
      (this.props.awayScore ?? 0) >= MATCH_RULES.MAX_GOALS_FOR_VICTORY
    ) {
      this.finish('two_goals');
      return { finished: true, reason: 'two_goals' };
    }

    return { finished: false };
  }

  public updateDuration(seconds: number): void {
    if (this.isFinished) return;
    this.props.durationSeconds = seconds;

    if (seconds >= MATCH_RULES.MAX_DURATION_SECONDS) {
      this.finish('time_limit');
    }
  }

  public handleTimeExpired(): void {
    if (!this.isFinished) {
      this.props.durationSeconds = MATCH_RULES.MAX_DURATION_SECONDS;
      this.finish('time_limit');
    }
  }

  public finish(reason: MatchEndReason = 'manual'): void {
    if (this.isFinished) return;
    this.props.status = 'finished';
    this.props.endReason = reason;
    this.props.finishedAt = new Date();
  }

  get state(): Readonly<MatchProps> {
    return this.props;
  }
}
