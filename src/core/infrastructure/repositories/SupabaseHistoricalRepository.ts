import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../database/supabaseClient';
import type { HistoricalPlayerTotal } from '../../domain/entities/HistoricalPlayerTotal';

export class SupabaseHistoricalRepository {
  constructor(private readonly client: SupabaseClient = supabaseAdmin) {}

  async findAll(): Promise<HistoricalPlayerTotal[]> {
    const { data, error } = await this.client.from('historical_player_totals')
      .select('player_id,source_name,season,through_date,goals,assists,bottom_count')
      .order('season', { ascending: false }).order('goals', { ascending: false });
    // Allow deployment before the additive migration. Other failures remain visible.
    if (error?.code === '42P01' || error?.code === 'PGRST205') return [];
    if (error) throw new Error(`Não foi possível carregar os totais antigos: ${error.message}`);
    return (data ?? []).map((r) => ({
      playerId: r.player_id, sourceName: r.source_name, season: r.season,
      throughDate: r.through_date, goals: r.goals, assists: r.assists, bottomCount: r.bottom_count,
    }));
  }
}
