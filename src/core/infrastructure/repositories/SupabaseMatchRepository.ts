import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../database/supabaseClient';
import { DatabaseError } from '../database/DatabaseError';
import type {
  IMatchRepository,
  MatchSummary,
  LeaderboardItem,
} from '../../domain/repositories/IMatchRepository';
import type {
  IMatchCommands,
  MatchCommand,
  MatchCommandResult,
} from '../../domain/repositories/IMatchCommands';
import { playerPerformance } from '../../domain/services/CompetitionService';
import { SupabasePlayerRepository } from './SupabasePlayerRepository';
import { SupabaseHistoricalRepository } from './SupabaseHistoricalRepository';
import { historicalTotalsForPeriod } from '../../domain/entities/HistoricalPlayerTotal';
import { performanceLeaderboard } from '../../application/dtos/performanceLeaderboard';

export class SupabaseMatchRepository implements IMatchRepository, IMatchCommands {
  constructor(private readonly client: SupabaseClient = supabaseAdmin) {}
  async getMatchesSummary(
    sessionId?: string,
    startDate?: string,
    endDate?: string
  ): Promise<MatchSummary[]> {
    // `_ranged` e não `society_matches_snapshot`: a função antiga tem assinatura de 1
    // argumento e continua existindo, porque as migrações deste projeto são reaplicáveis
    // e recriá-la geraria sobrecarga ambígua. Ver 202609210006.
    const { data, error } = await this.client.rpc('society_matches_snapshot_ranged', {
      p_session_id: sessionId ?? null,
      p_start_date: startDate ?? null,
      p_end_date: endDate ?? null,
    });
    if (error)
      throw new DatabaseError(
        'Falha ao ler partidas. Verifique a migração 202609090001: ' + error.message,
        error.code
      );
    return data as MatchSummary[];
  }
  async getMatchById(id: string): Promise<MatchSummary | null> {
    const { data, error } = await this.client
      .from('matches')
      .select('session_id')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new DatabaseError(error.message, error.code);
    if (!data) return null;
    return (await this.getMatchesSummary(data.session_id)).find((m) => m.matchId === id) ?? null;
  }
  async executeCommand(command: MatchCommand): Promise<MatchCommandResult> {
    const { data, error } = await this.client.rpc('society_match_command', {
      p_action: command.action,
      p_match_id: command.matchId ?? null,
      p_input: command.input,
      p_operation_id: command.operationId,
    });
    if (error) throw new DatabaseError(error.message, error.code);
    const result = data as { match_id: string; event_id?: string; deleted_match?: MatchSummary };
    const match = result.deleted_match ?? (await this.getMatchById(result.match_id));
    if (!match)
      throw new Error(
        'Partida salva, mas não foi possível carregar a confirmação. Tente novamente.'
      );
    return { match, eventId: result.event_id };
  }
  async getLeaderboard() {
    return this.getLeaderboardByDateRange();
  }
  async getLeaderboardByDateRange(start?: string, end?: string): Promise<LeaderboardItem[]> {
    // O recorte vai para o SQL. Antes trazíamos o histórico inteiro e filtrávamos aqui,
    // descartando em memória quase tudo o que o banco acabara de serializar.
    const [matches, players, historical] = await Promise.all([
      this.getMatchesSummary(undefined, start, end),
      new SupabasePlayerRepository(this.client).findAll(),
      new SupabaseHistoricalRepository(this.client).findAll(),
    ]);
    return playerPerformance(
      matches,
      players.map((p) => ({
        id: p.id!,
        name: p.name,
        nickname: p.nickname,
        avatarUrl: p.avatarUrl,
        isActive: p.isActive,
      })),
      historicalTotalsForPeriod(historical, start, end)
    ).map(performanceLeaderboard);
  }
}
