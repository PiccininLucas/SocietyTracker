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

  public async getLeaderboardByDateRange(
    startDate?: string,
    endDate?: string
  ): Promise<LeaderboardItem[]> {
    if (!startDate && !endDate) {
      return this.getLeaderboard();
    }

    let sessionQuery = this.client.from('sessions').select('id, session_date');
    if (startDate) {
      sessionQuery = sessionQuery.gte('session_date', startDate);
    }
    if (endDate) {
      sessionQuery = sessionQuery.lte('session_date', endDate);
    }

    const { data: sessionRows, error: sErr } = await sessionQuery;
    if (sErr) {
      throw new Error(`Erro ao buscar sessões do período: ${sErr.message}`);
    }

    if (!sessionRows || sessionRows.length === 0) {
      return [];
    }

    const sessionIds = sessionRows.map((s: any) => s.id);

    const { data: teamRows, error: tErr } = await this.client
      .from('session_teams')
      .select('id, session_id, session_team_players(player_id, players(id, name, nickname, avatar_url, is_active))')
      .in('session_id', sessionIds);

    if (tErr) {
      throw new Error(`Erro ao buscar escalações do período: ${tErr.message}`);
    }

    const { data: matchRows, error: mErr } = await this.client
      .from('matches')
      .select('id, session_id, match_events(id, scorer_id, assist_id, is_own_goal)')
      .in('session_id', sessionIds);

    if (mErr) {
      throw new Error(`Erro ao buscar partidas do período: ${mErr.message}`);
    }

    const playerMap = new Map<
      string,
      {
        playerId: string;
        name: string;
        nickname: string | null;
        avatarUrl: string | null;
        totalGoals: number;
        totalAssists: number;
        sessionIds: Set<string>;
      }
    >();

    for (const team of teamRows || []) {
      for (const stp of team.session_team_players || []) {
        const p = (stp as any).players;
        if (!p) continue;
        if (!playerMap.has(p.id)) {
          playerMap.set(p.id, {
            playerId: p.id,
            name: p.name,
            nickname: p.nickname || null,
            avatarUrl: p.avatar_url || null,
            totalGoals: 0,
            totalAssists: 0,
            sessionIds: new Set<string>(),
          });
        }
        playerMap.get(p.id)!.sessionIds.add(team.session_id);
      }
    }

    for (const match of matchRows || []) {
      for (const ev of (match as any).match_events || []) {
        if (ev.scorer_id && !ev.is_own_goal && playerMap.has(ev.scorer_id)) {
          playerMap.get(ev.scorer_id)!.totalGoals += 1;
        }
        if (ev.assist_id && playerMap.has(ev.assist_id)) {
          playerMap.get(ev.assist_id)!.totalAssists += 1;
        }
      }
    }

    const result: LeaderboardItem[] = Array.from(playerMap.values()).map((p) => ({
      playerId: p.playerId,
      name: p.name,
      nickname: p.nickname,
      avatarUrl: p.avatarUrl,
      totalGoals: p.totalGoals,
      totalAssists: p.totalAssists,
      totalContributions: p.totalGoals + p.totalAssists,
      totalSessionsPlayed: p.sessionIds.size,
    }));

    return result.sort((a, b) => {
      if (b.totalContributions !== a.totalContributions) {
        return b.totalContributions - a.totalContributions;
      }
      if (b.totalGoals !== a.totalGoals) {
        return b.totalGoals - a.totalGoals;
      }
      if (b.totalAssists !== a.totalAssists) {
        return b.totalAssists - a.totalAssists;
      }
      return a.name.localeCompare(b.name);
    });
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
