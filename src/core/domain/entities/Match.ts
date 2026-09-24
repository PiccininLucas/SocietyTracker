/**
 * Regras da partida que o cliente também precisa conhecer. Quem aplica as regras de escrita
 * (gol, fim aos 2 gols, limite de tempo, consolidação) é `society_match_command`, dentro da
 * transação do banco: ver docs/adr/0001-transacao-sql-e-a-autoridade-das-partidas.md. O
 * teste de 2 gols em tests/transactions.test.ts amarra `MAX_GOALS_FOR_VICTORY` ao SQL.
 */
export type MatchEndReason = 'two_goals' | 'time_limit' | 'manual';
export type MatchStatus = 'ongoing' | 'finished';

export const MATCH_RULES = {
  MAX_GOALS_FOR_VICTORY: 2,
  MAX_DURATION_SECONDS: 420, // 7 minutes
} as const;
