import type { PlayerPerformance } from '../../domain/services/CompetitionService';
import type { LeaderboardItemDTO } from './LeaderboardDTO';

/**
 * Número de **partidas** jogadas — os mini-jogos, tipicamente 8 a 12 por noite.
 *
 * Nunca cai para `totalSessionsPlayed`, que conta **rodadas** (uma por quinta). São
 * métricas diferentes, e substituir uma pela outra inflava o G/J em cerca de 5x: um
 * jogador com 15 partidas em 3 rodadas aparecia como "3 jogos • 2.33 G/J" em vez de
 * "15 jogos • 0.47 G/J". Quando o total não é conhecido o valor é `null`, e a UI mostra
 * o campo como indisponível em vez de um número errado.
 */
export function resolveMatchesPlayed(item: {
  hasHistoricalTotals?: boolean | null;
  totalMatchesPlayed?: number | string | null;
}): number | null {
  if (item.hasHistoricalTotals) return null;
  if (item.totalMatchesPlayed === null || item.totalMatchesPlayed === undefined) return null;
  return Number(item.totalMatchesPlayed) || 0;
}

export function performanceLeaderboard(p: PlayerPerformance): LeaderboardItemDTO {
  return {
    playerId: p.playerId, name: p.name, nickname: p.nickname,
    displayName: p.nickname || p.name, avatarUrl: p.avatarUrl,
    totalGoals: p.goals, totalAssists: p.assists, totalContributions: p.contributions,
    totalMatchesPlayed: p.hasHistoricalTotals ? null : p.played,
    totalSessionsPlayed: p.hasHistoricalTotals ? null : p.sessions,
    goalsPerMatch: p.hasHistoricalTotals ? null : p.played ? Number((p.goals / p.played).toFixed(2)) : 0,
    hasHistoricalTotals: p.hasHistoricalTotals ?? false,
    totalBottomCount: p.bottomCount,
    recordedMatchesPlayed: p.played,
    recordedGoalsPerMatch: p.played ? Number(((p.recordedGoals ?? p.goals) / p.played).toFixed(2)) : null,
  };
}
