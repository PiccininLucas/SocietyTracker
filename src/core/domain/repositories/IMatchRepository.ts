export interface LeaderboardItem {
  playerId: string;
  name: string;
  nickname: string | null;
  avatarUrl: string | null;
  totalGoals: number;
  totalAssists: number;
  totalContributions: number;
  totalMatchesPlayed?: number | null;
  totalSessionsPlayed: number | null;
  goalsPerMatch?: number | null;
  hasHistoricalTotals?: boolean;
  totalBottomCount?: number;
  recordedMatchesPlayed?: number;
  recordedGoalsPerMatch?: number | null;
}

export interface MatchSummaryEvent {
  isUnattributed?: boolean;
  id: string;
  matchId: string;
  teamId: string;
  scorerId?: string | null;
  scorerName?: string;
  assistId?: string | null;
  assistName?: string;
  eventTimeSeconds: number;
  isOwnGoal: boolean;
}

export interface MatchPlayerSummary {
  inferred?: boolean;
  id: string;
  name: string;
  nickname: string | null;
  avatarUrl?: string | null;
  isCaptain: boolean;
  /** Congelado quando a partida começou. Use para o histórico. */
  isGoalkeeper: boolean;
  /**
   * Goleiro na escalação desta rodada, lido ao vivo. A função de goleiro vale por noite,
   * então é este campo que decide a imunidade no "Bola Murcha" — `isGoalkeeper` pode
   * estar desatualizado se a escalação foi ajustada depois da partida.
   */
  isRoundGoalkeeper?: boolean;
  isLoaned: boolean;
  goals: number;
  assists: number;
}

export interface MatchSummary {
  deletedAt?: string;
  sequence?: number;
  lockedAt?: string | null;
  editable?: boolean;
  sessionStatus?: string;
  matchId: string;
  sessionId: string;
  sessionDate: string;
  homeTeamId?: string;
  homeTeamName: string;
  homeTeamColor: string;
  homeScore: number;
  awayTeamId?: string;
  awayTeamName: string;
  awayTeamColor: string;
  awayScore: number;
  durationSeconds: number;
  endReason: string | null;
  status: 'ongoing' | 'finished';
  startedAt: string;
  finishedAt: string | null;
  events?: MatchSummaryEvent[];
  homePlayers?: MatchPlayerSummary[];
  awayPlayers?: MatchPlayerSummary[];
}

/**
 * Leitura das partidas. As escritas passam por `IMatchCommands`, que o banco aplica numa
 * transação (docs/adr/0001-transacao-sql-e-a-autoridade-das-partidas.md).
 */
export interface IMatchRepository {
  getLeaderboard(): Promise<LeaderboardItem[]>;
  getLeaderboardByDateRange(startDate?: string, endDate?: string): Promise<LeaderboardItem[]>;
  /**
   * Partidas com eventos e escalações. Sem argumentos devolve o histórico inteiro, então
   * informe `startDate`/`endDate` (YYYY-MM-DD) sempre que o recorte for conhecido — o
   * filtro acontece no banco, não em memória.
   */
  getMatchesSummary(
    sessionId?: string,
    startDate?: string,
    endDate?: string
  ): Promise<MatchSummary[]>;
  getMatchById(matchId: string): Promise<MatchSummary | null>;
}
