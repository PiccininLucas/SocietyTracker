import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as defaultClient } from '../database/supabaseClient';
import type {
  IMatchRepository,
  LeaderboardItem,
  MatchSummary,
} from '../../domain/repositories/IMatchRepository';
import { Match, type MatchEndReason, type MatchStatus } from '../../domain/entities/Match';
import { MatchEvent } from '../../domain/entities/MatchEvent';

interface MatchRow {
  id: string;
  session_id: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number;
  away_score: number;
  duration_seconds: number;
  end_reason: MatchEndReason | null;
  status: MatchStatus;
  started_at: string;
  finished_at: string | null;
}

interface MatchEventRow {
  id: string;
  match_id: string;
  team_id: string;
  scorer_id: string | null;
  assist_id: string | null;
  event_time_seconds: number;
  is_own_goal: boolean;
  created_at: string;
}

interface LeaderboardRow {
  player_id: string;
  name: string;
  nickname: string | null;
  avatar_url: string | null;
  total_goals: number;
  total_assists: number;
  total_contributions: number;
  total_sessions_played: number;
}

interface MatchSummaryRow {
  match_id: string;
  session_id: string;
  session_date: string;
  home_team_name: string;
  home_team_color: string;
  home_score: number;
  away_team_name: string;
  away_team_color: string;
  away_score: number;
  duration_seconds: number;
  end_reason: string | null;
  status: 'ongoing' | 'finished';
  started_at: string;
  finished_at: string | null;
}

export class SupabaseMatchRepository implements IMatchRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || defaultClient;
  }

  private mapMatchToDomain(row: MatchRow): Match {
    return new Match({
      id: row.id,
      sessionId: row.session_id,
      homeTeamId: row.home_team_id,
      awayTeamId: row.away_team_id,
      homeScore: row.home_score,
      awayScore: row.away_score,
      durationSeconds: row.duration_seconds,
      endReason: row.end_reason,
      status: row.status,
      startedAt: new Date(row.started_at),
      finishedAt: row.finished_at ? new Date(row.finished_at) : null,
    });
  }

  private mapEventToDomain(row: MatchEventRow): MatchEvent {
    return new MatchEvent({
      id: row.id,
      matchId: row.match_id,
      teamId: row.team_id,
      scorerId: row.scorer_id,
      assistId: row.assist_id,
      eventTimeSeconds: row.event_time_seconds,
      isOwnGoal: row.is_own_goal,
      createdAt: new Date(row.created_at),
    });
  }

  public async findById(id: string): Promise<Match | null> {
    const { data, error } = await this.client
      .from('matches')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Erro ao buscar partida por ID (${id}): ${error.message}`);
    }

    if (!data) return null;

    return this.mapMatchToDomain(data as MatchRow);
  }

  public async findBySessionId(sessionId: string): Promise<Match[]> {
    const { data, error } = await this.client
      .from('matches')
      .select('*')
      .eq('session_id', sessionId)
      .order('started_at', { ascending: true });

    if (error) {
      throw new Error(`Erro ao buscar partidas da sessão (${sessionId}): ${error.message}`);
    }

    return (data as MatchRow[] || []).map((row) => this.mapMatchToDomain(row));
  }

  public async findActiveMatch(sessionId: string): Promise<Match | null> {
    const { data, error } = await this.client
      .from('matches')
      .select('*')
      .eq('session_id', sessionId)
      .eq('status', 'ongoing')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Erro ao buscar partida ativa: ${error.message}`);
    }

    if (!data) return null;

    return this.mapMatchToDomain(data as MatchRow);
  }

  public async create(match: Match): Promise<Match> {
    const { data, error } = await this.client
      .from('matches')
      .insert({
        session_id: match.sessionId,
        home_team_id: match.homeTeamId,
        away_team_id: match.awayTeamId,
        home_score: match.homeScore,
        away_score: match.awayScore,
        duration_seconds: match.durationSeconds,
        end_reason: match.endReason || null,
        status: match.status,
        started_at: match.startedAt ? match.startedAt.toISOString() : new Date().toISOString(),
        finished_at: match.finishedAt ? match.finishedAt.toISOString() : null,
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Erro ao criar partida: ${error.message}`);
    }

    return this.mapMatchToDomain(data as MatchRow);
  }

  public async update(match: Match): Promise<Match> {
    if (!match.id) {
      throw new Error('ID da partida é obrigatório para atualização.');
    }

    const { data, error } = await this.client
      .from('matches')
      .update({
        home_score: match.homeScore,
        away_score: match.awayScore,
        duration_seconds: match.durationSeconds,
        end_reason: match.endReason || null,
        status: match.status,
        finished_at: match.finishedAt ? match.finishedAt.toISOString() : null,
      })
      .eq('id', match.id)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Erro ao atualizar partida (${match.id}): ${error.message}`);
    }

    return this.mapMatchToDomain(data as MatchRow);
  }

  public async addEvent(event: MatchEvent): Promise<MatchEvent> {
    const { data, error } = await this.client
      .from('match_events')
      .insert({
        match_id: event.matchId,
        team_id: event.teamId,
        scorer_id: event.scorerId || null,
        assist_id: event.assistId || null,
        event_time_seconds: event.eventTimeSeconds,
        is_own_goal: event.isOwnGoal,
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Erro ao registrar evento de jogo: ${error.message}`);
    }

    return this.mapEventToDomain(data as MatchEventRow);
  }

  public async getEventsByMatchId(matchId: string): Promise<MatchEvent[]> {
    const { data, error } = await this.client
      .from('match_events')
      .select('*')
      .eq('match_id', matchId)
      .order('event_time_seconds', { ascending: true });

    if (error) {
      throw new Error(`Erro ao buscar eventos da partida (${matchId}): ${error.message}`);
    }

    return (data as MatchEventRow[] || []).map((row) => this.mapEventToDomain(row));
  }

  public async getLeaderboard(): Promise<LeaderboardItem[]> {
    const { data, error } = await this.client
      .from('vw_player_leaderboard')
      .select('*');

    if (error) {
      throw new Error(`Erro ao buscar classificação: ${error.message}`);
    }

    return (data as LeaderboardRow[] || []).map((row) => ({
      playerId: row.player_id,
      name: row.name,
      nickname: row.nickname,
      avatarUrl: row.avatar_url,
      totalGoals: row.total_goals,
      totalAssists: row.total_assists,
      totalContributions: row.total_contributions,
      totalSessionsPlayed: row.total_sessions_played,
    }));
  }

  public async getMatchesSummary(sessionId?: string): Promise<MatchSummary[]> {
    let query = this.client.from('vw_matches_summary').select('*');

    if (sessionId) {
      query = query.eq('session_id', sessionId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erro ao buscar resumo das partidas: ${error.message}`);
    }

    return (data as MatchSummaryRow[] || []).map((row) => ({
      matchId: row.match_id,
      sessionId: row.session_id,
      sessionDate: row.session_date,
      homeTeamName: row.home_team_name,
      homeTeamColor: row.home_team_color,
      homeScore: row.home_score,
      awayTeamName: row.away_team_name,
      awayTeamColor: row.away_team_color,
      awayScore: row.away_score,
      durationSeconds: row.duration_seconds,
      endReason: row.end_reason,
      status: row.status,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
    }));
  }
}
