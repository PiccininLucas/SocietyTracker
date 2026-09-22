import { Team } from './Team';

export type SessionStatus = 'ongoing' | 'finished';

/**
 * Formato da rodada. Fonte única — a aplicação, a UI e os testes derivam daqui.
 *
 * A pelada é 3 ou 4 times de até 6 jogadores, com teto de 24 por rodada. O cheio é
 * 4 × 6 = 24; com 3 times o máximo é 18. Times incompletos acontecem (alguém falta), por
 * isso 6 é teto e não obrigação — mas um time vazio não pode entrar em campo.
 */
export const ROUND_RULES = {
  MIN_TEAMS: 3,
  MAX_TEAMS: 4,
  MAX_PLAYERS_PER_TEAM: 6,
  MAX_PLAYERS_PER_ROUND: 24,
  MIN_PLAYERS_PER_TEAM: 1,
} as const;

export interface RoundTeamShape {
  name?: string;
  playerIds?: string[];
  /** Os DTOs aceitam tanto o id cru quanto o objeto com `playerId`. */
  players?: (string | { playerId?: string })[];
}

/** Ids dos jogadores de um time, aceitando as formas que os DTOs usam. */
function teamPlayerIds(team: RoundTeamShape): string[] {
  if (team.playerIds?.length) return team.playerIds.filter(Boolean);
  return (team.players ?? [])
    .map((p) => (typeof p === 'string' ? p : p?.playerId))
    .filter((id): id is string => !!id);
}

/**
 * Valida o formato da rodada. Lança com mensagem pronta para a UI.
 *
 * Roda na camada de aplicação, não só no navegador: a validação do `TeamBuilderIsland`
 * é conveniência, e a API é a fronteira que de fato precisa segurar.
 */
export function assertValidRoundFormat(teams: RoundTeamShape[] | undefined): void {
  const list = teams ?? [];

  if (list.length < ROUND_RULES.MIN_TEAMS || list.length > ROUND_RULES.MAX_TEAMS) {
    throw new Error(
      `A rodada deve ter ${ROUND_RULES.MIN_TEAMS} ou ${ROUND_RULES.MAX_TEAMS} times (recebido: ${list.length}).`
    );
  }

  const naming = (team: RoundTeamShape, index: number) => team.name?.trim() || `Time ${index + 1}`;

  const overfull = list
    .map((t, i) => ({ nome: naming(t, i), n: teamPlayerIds(t).length }))
    .filter((t) => t.n > ROUND_RULES.MAX_PLAYERS_PER_TEAM);
  if (overfull.length) {
    throw new Error(
      `Cada time pode ter no máximo ${ROUND_RULES.MAX_PLAYERS_PER_TEAM} jogadores. ` +
        `Acima do limite: ${overfull.map((t) => `${t.nome} (${t.n})`).join(', ')}.`
    );
  }

  const empty = list
    .map((t, i) => ({ nome: naming(t, i), n: teamPlayerIds(t).length }))
    .filter((t) => t.n < ROUND_RULES.MIN_PLAYERS_PER_TEAM);
  if (empty.length) {
    throw new Error(
      `Todo time precisa de pelo menos um jogador. Sem jogadores: ${empty
        .map((t) => t.nome)
        .join(', ')}.`
    );
  }

  const ids = list.flatMap(teamPlayerIds);
  if (ids.length > ROUND_RULES.MAX_PLAYERS_PER_ROUND) {
    throw new Error(
      `A rodada comporta no máximo ${ROUND_RULES.MAX_PLAYERS_PER_ROUND} jogadores (recebido: ${ids.length}).`
    );
  }

  const repeated = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
  if (repeated.length) {
    throw new Error(`Um jogador não pode estar em dois times da mesma rodada.`);
  }
}

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
