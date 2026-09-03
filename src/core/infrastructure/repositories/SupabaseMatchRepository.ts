import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin as defaultClient } from '../database/supabaseClient';
import type {
  IMatchRepository,
  LeaderboardItem,
  MatchSummary,
  MatchSummaryEvent,
  MatchPlayerSummary,
} from '../../domain/repositories/IMatchRepository';
import { Match, type MatchEndReason, type MatchStatus } from '../../domain/entities/Match';
import { MatchEvent } from '../../domain/entities/MatchEvent';
import { executeWithSchemaFallback } from '../database/schemaResilience';

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
  total_matches_played?: number;
  total_sessions_played?: number;
  goals_per_match?: number;
}

interface MatchSummaryRow {
  match_id: string;
  session_id: string;
  session_date: string;
  home_team_id?: string;
  home_team_name: string;
  home_team_color: string;
  home_score: number;
  away_team_id?: string;
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
    const payload = {
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
    };

    const { data, error } = await executeWithSchemaFallback<MatchRow>(
      'matches',
      payload,
      (cleanPayload) =>
        this.client.from('matches').insert(cleanPayload).select('*').single()
    );

    if (error || !data) {
      throw new Error(`Erro ao criar partida: ${error?.message}`);
    }

    return this.mapMatchToDomain(data as MatchRow);
  }

  public async update(match: Match): Promise<Match> {
    if (!match.id) {
      throw new Error('ID da partida é obrigatório para atualização.');
    }

    const payload = {
      home_score: match.homeScore,
      away_score: match.awayScore,
      duration_seconds: match.durationSeconds,
      end_reason: match.endReason || null,
      status: match.status,
      finished_at: match.finishedAt ? match.finishedAt.toISOString() : null,
    };

    const { data, error } = await executeWithSchemaFallback<MatchRow>(
      'matches',
      payload,
      (cleanPayload) =>
        this.client.from('matches').update(cleanPayload).eq('id', match.id).select('*').single()
    );

    if (error || !data) {
      throw new Error(`Erro ao atualizar partida (${match.id}): ${error?.message}`);
    }

    return this.mapMatchToDomain(data as MatchRow);
  }

  public async addEvent(event: MatchEvent): Promise<MatchEvent> {
    const payload = {
      match_id: event.matchId,
      team_id: event.teamId,
      scorer_id: event.scorerId || null,
      assist_id: event.assistId || null,
      event_time_seconds: event.eventTimeSeconds,
      is_own_goal: event.isOwnGoal,
    };

    const { data, error } = await executeWithSchemaFallback<MatchEventRow>(
      'match_events',
      payload,
      (cleanPayload) =>
        this.client.from('match_events').insert(cleanPayload).select('*').single()
    );

    if (error || !data) {
      throw new Error(`Erro ao registrar evento de jogo: ${error?.message}`);
    }

    // Sincroniza o placar recalculado diretamente na tabela matches
    await this.syncMatchScoresFromEvents(event.matchId);

    return this.mapEventToDomain(data as MatchEventRow);
  }

  private async syncMatchScoresFromEvents(matchId: string): Promise<void> {
    try {
      const { data: matchData } = await this.client
        .from('matches')
        .select('home_team_id, away_team_id')
        .eq('id', matchId)
        .maybeSingle();

      if (!matchData) return;

      const norm = (id?: string | null) => (id ? id.trim().toLowerCase() : '');
      const homeTeamId = norm(matchData.home_team_id);
      const awayTeamId = norm(matchData.away_team_id);

      const { data: eventsData } = await this.client
        .from('match_events')
        .select('team_id, is_own_goal')
        .eq('match_id', matchId);

      const events = eventsData || [];
      const homeScore = events.filter((e: any) => {
        const tId = norm(e.team_id);
        return (!e.is_own_goal && tId === homeTeamId) || (e.is_own_goal && tId === awayTeamId);
      }).length;

      const awayScore = events.filter((e: any) => {
        const tId = norm(e.team_id);
        return (!e.is_own_goal && tId === awayTeamId) || (e.is_own_goal && tId === homeTeamId);
      }).length;

      await executeWithSchemaFallback(
        'matches',
        { home_score: homeScore, away_score: awayScore },
        (cleanPayload) => this.client.from('matches').update(cleanPayload).eq('id', matchId)
      );
    } catch {
      // Falha não-bloqueante
    }
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

    return (data as LeaderboardRow[] || []).map((row) => {
      const goals = Number(row.total_goals) || 0;
      const matchesPlayed = Number(row.total_matches_played ?? row.total_sessions_played) || 0;
      const goalsPerMatch =
        row.goals_per_match !== undefined && row.goals_per_match !== null
          ? Number(row.goals_per_match)
          : matchesPlayed > 0
          ? Number((goals / matchesPlayed).toFixed(2))
          : 0;

      return {
        playerId: row.player_id,
        name: row.name,
        nickname: row.nickname,
        avatarUrl: row.avatar_url,
        totalGoals: goals,
        totalAssists: Number(row.total_assists) || 0,
        totalContributions: Number(row.total_contributions) || 0,
        totalMatchesPlayed: matchesPlayed,
        totalSessionsPlayed: Number(row.total_sessions_played) || 0,
        goalsPerMatch,
      };
    });
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
      .select('id, session_id, home_team_id, away_team_id, status, match_events(id, scorer_id, assist_id, is_own_goal)')
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
        matchIds: Set<string>;
      }
    >();

    const playerTeamsMap = new Map<string, Set<string>>();

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
            matchIds: new Set<string>(),
          });
        }
        playerMap.get(p.id)!.sessionIds.add(team.session_id);

        if (!playerTeamsMap.has(p.id)) {
          playerTeamsMap.set(p.id, new Set<string>());
        }
        playerTeamsMap.get(p.id)!.add(team.id);
      }
    }

    for (const match of matchRows || []) {
      const isFinished = !match.status || match.status === 'finished';
      if (isFinished) {
        for (const [playerId, teamIds] of playerTeamsMap.entries()) {
          if (teamIds.has(match.home_team_id) || teamIds.has(match.away_team_id)) {
            playerMap.get(playerId)?.matchIds.add(match.id);
          }
        }
      }

      for (const ev of (match as any).match_events || []) {
        if (ev.scorer_id && !ev.is_own_goal && playerMap.has(ev.scorer_id)) {
          playerMap.get(ev.scorer_id)!.totalGoals += 1;
        }
        if (ev.assist_id && playerMap.has(ev.assist_id)) {
          playerMap.get(ev.assist_id)!.totalAssists += 1;
        }
      }
    }

    const result: LeaderboardItem[] = Array.from(playerMap.values()).map((p) => {
      const totalMatches = p.matchIds.size;
      const goalsPerMatch = totalMatches > 0 ? Number((p.totalGoals / totalMatches).toFixed(2)) : 0;
      return {
        playerId: p.playerId,
        name: p.name,
        nickname: p.nickname,
        avatarUrl: p.avatarUrl,
        totalGoals: p.totalGoals,
        totalAssists: p.totalAssists,
        totalContributions: p.totalGoals + p.totalAssists,
        totalMatchesPlayed: totalMatches,
        totalSessionsPlayed: p.sessionIds.size,
        goalsPerMatch,
      };
    });

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

  private async enrichMatchSummaries(rows: MatchSummaryRow[]): Promise<MatchSummary[]> {
    const matchIds = rows.map((r) => r.match_id);

    // Mapeamentos para enriquecimento com eventos e IDs dos times
    const matchTeamMap = new Map<string, { homeTeamId: string; awayTeamId: string }>();
    const eventsByMatch = new Map<string, MatchSummaryEvent[]>();

    if (matchIds.length > 0) {
      // 1. Buscar os IDs dos times na tabela matches para garantir correspondência exata
      try {
        const { data: matchesTableData } = await this.client
          .from('matches')
          .select('id, home_team_id, away_team_id')
          .in('id', matchIds);

        for (const m of (matchesTableData || [])) {
          matchTeamMap.set(m.id, { homeTeamId: m.home_team_id, awayTeamId: m.away_team_id });
        }
      } catch {
        // Fallback silencioso caso ocorra restrição de acesso
      }

      // 2. Buscar eventos das partidas (match_events)
      try {
        const { data: eventsData } = await this.client
          .from('match_events')
          .select('*')
          .in('match_id', matchIds)
          .order('event_time_seconds', { ascending: true });

        const playerIds = new Set<string>();
        for (const ev of (eventsData || [])) {
          if (ev.scorer_id) playerIds.add(ev.scorer_id);
          if (ev.assist_id) playerIds.add(ev.assist_id);
        }

        // 3. Buscar nomes e apelidos dos jogadores participantes
        const playerMap = new Map<string, { name: string; nickname: string | null }>();
        if (playerIds.size > 0) {
          const { data: playersData } = await this.client
            .from('players')
            .select('id, name, nickname')
            .in('id', Array.from(playerIds));

          for (const p of (playersData || [])) {
            playerMap.set(p.id, { name: p.name, nickname: p.nickname });
          }
        }

        // 4. Montar os eventos resumidos para cada partida
        for (const ev of (eventsData || [])) {
          const scorer = ev.scorer_id ? playerMap.get(ev.scorer_id) : null;
          const assist = ev.assist_id ? playerMap.get(ev.assist_id) : null;
          const scorerName = ev.is_own_goal
            ? 'Gol Contra'
            : (scorer?.nickname || scorer?.name || 'Jogador');
          const assistName = assist ? (assist.nickname || assist.name || undefined) : undefined;

          const summaryEvent: MatchSummaryEvent = {
            id: ev.id,
            matchId: ev.match_id,
            teamId: ev.team_id,
            scorerId: ev.scorer_id,
            scorerName,
            assistId: ev.assist_id,
            assistName,
            eventTimeSeconds: ev.event_time_seconds ?? 0,
            isOwnGoal: !!ev.is_own_goal,
          };

          if (!eventsByMatch.has(ev.match_id)) {
            eventsByMatch.set(ev.match_id, []);
          }
          eventsByMatch.get(ev.match_id)!.push(summaryEvent);
        }
      } catch {
        // Se a busca de eventos falhar, continua com eventos vazios
      }
    }

    // 5. Buscar escalações de todos os times envolvidos nas partidas
    const allTeamIds = new Set<string>();
    for (const row of rows) {
      if (row.home_team_id) allTeamIds.add(row.home_team_id);
      if (row.away_team_id) allTeamIds.add(row.away_team_id);
    }
    for (const [, info] of matchTeamMap.entries()) {
      if (info.homeTeamId) allTeamIds.add(info.homeTeamId);
      if (info.awayTeamId) allTeamIds.add(info.awayTeamId);
    }

    const teamCaptainMap = new Map<string, string>();
    interface TeamPlayerEntry {
      playerId: string;
      name: string;
      nickname: string | null;
      avatarUrl?: string | null;
      isCaptain: boolean;
      isGoalkeeper: boolean;
      isLoaned: boolean;
    }
    const teamPlayersMap = new Map<string, TeamPlayerEntry[]>();

    if (allTeamIds.size > 0) {
      const teamIdList = Array.from(allTeamIds);

      // Buscar capitães cadastrados nos times
      try {
        const { data: teamsData } = await this.client
          .from('session_teams')
          .select('id, captain_id')
          .in('id', teamIdList);

        for (const t of (teamsData || [])) {
          if (t.captain_id) teamCaptainMap.set(t.id, t.captain_id);
        }
      } catch {
        // Fallback silencioso
      }

      // Buscar elenco dos times da sessão
      try {
        const { data: stpData } = await this.client
          .from('session_team_players')
          .select('session_team_id, player_id, is_loaned, is_goalkeeper, is_captain, players(id, name, nickname, avatar_url)')
          .in('session_team_id', teamIdList);

        for (const item of (stpData || [])) {
          const p = (item as any).players;
          if (!p) continue;
          const teamId = item.session_team_id;
          if (!teamPlayersMap.has(teamId)) {
            teamPlayersMap.set(teamId, []);
          }
          const isCaptain = !!(item.is_captain || (teamCaptainMap.get(teamId) === item.player_id));
          teamPlayersMap.get(teamId)!.push({
            playerId: item.player_id,
            name: p.name,
            nickname: p.nickname || null,
            avatarUrl: p.avatar_url || null,
            isCaptain,
            isGoalkeeper: !!item.is_goalkeeper,
            isLoaned: !!item.is_loaned,
          });
        }
      } catch {
        // Fallback caso a coluna is_captain não esteja presente no schema remoto
        try {
          const { data: stpDataFallback } = await this.client
            .from('session_team_players')
            .select('session_team_id, player_id, is_loaned, is_goalkeeper, players(id, name, nickname, avatar_url)')
            .in('session_team_id', teamIdList);

          for (const item of (stpDataFallback || [])) {
            const p = (item as any).players;
            if (!p) continue;
            const teamId = item.session_team_id;
            if (!teamPlayersMap.has(teamId)) {
              teamPlayersMap.set(teamId, []);
            }
            const isCaptain = teamCaptainMap.get(teamId) === item.player_id;
            teamPlayersMap.get(teamId)!.push({
              playerId: item.player_id,
              name: p.name,
              nickname: p.nickname || null,
              avatarUrl: p.avatar_url || null,
              isCaptain,
              isGoalkeeper: !!item.is_goalkeeper,
              isLoaned: !!item.is_loaned,
            });
          }
        } catch {
          // Ignora se não for possível obter atletas
        }
      }
    }

    return rows.map((row) => {
      const teamInfo = matchTeamMap.get(row.match_id);
      const matchEvents = eventsByMatch.get(row.match_id) || [];

      const norm = (id?: string | null) => (id ? id.trim().toLowerCase() : '');
      const homeTeamId = norm(teamInfo?.homeTeamId || row.home_team_id);
      const awayTeamId = norm(teamInfo?.awayTeamId || row.away_team_id);

      // Recalcula o placar a partir dos eventos reais da partida (fonte da verdade)
      const calculatedHomeScore = matchEvents.filter((e) => {
        const tId = norm(e.teamId);
        return (!e.isOwnGoal && tId === homeTeamId) || (e.isOwnGoal && tId === awayTeamId);
      }).length;

      const calculatedAwayScore = matchEvents.filter((e) => {
        const tId = norm(e.teamId);
        return (!e.isOwnGoal && tId === awayTeamId) || (e.isOwnGoal && tId === homeTeamId);
      }).length;

      const homeScore = matchEvents.length > 0 ? calculatedHomeScore : (row.home_score ?? 0);
      const awayScore = matchEvents.length > 0 ? calculatedAwayScore : (row.away_score ?? 0);

      // Função auxiliar para montar a lista de atletas de um time com suas estatísticas nesta partida
      const buildMatchPlayers = (teamIdStr: string): MatchPlayerSummary[] => {
        if (!teamIdStr) return [];
        // Busca elenco pelo id exato ou normalizado
        let roster: TeamPlayerEntry[] = [];
        for (const [tId, pList] of teamPlayersMap.entries()) {
          if (norm(tId) === norm(teamIdStr)) {
            roster = pList;
            break;
          }
        }

        return roster.map((p) => {
          const pId = norm(p.playerId);
          const goals = matchEvents.filter((e) => norm(e.scorerId) === pId && !e.isOwnGoal).length;
          const assists = matchEvents.filter((e) => norm(e.assistId) === pId && !e.isOwnGoal).length;

          return {
            id: p.playerId,
            name: p.name,
            nickname: p.nickname,
            avatarUrl: p.avatarUrl,
            isCaptain: p.isCaptain,
            isGoalkeeper: p.isGoalkeeper,
            isLoaned: p.isLoaned,
            goals,
            assists,
          };
        });
      };

      const rawHomeId = teamInfo?.homeTeamId || row.home_team_id;
      const rawAwayId = teamInfo?.awayTeamId || row.away_team_id;

      return {
        matchId: row.match_id,
        sessionId: row.session_id,
        sessionDate: row.session_date,
        homeTeamId: rawHomeId,
        homeTeamName: row.home_team_name,
        homeTeamColor: row.home_team_color,
        homeScore,
        awayTeamId: rawAwayId,
        awayTeamName: row.away_team_name,
        awayTeamColor: row.away_team_color,
        awayScore,
        durationSeconds: row.duration_seconds ?? 0,
        endReason: row.end_reason,
        status: row.status,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
        events: matchEvents,
        homePlayers: buildMatchPlayers(rawHomeId || ''),
        awayPlayers: buildMatchPlayers(rawAwayId || ''),
      };
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

    return this.enrichMatchSummaries((data as MatchSummaryRow[] || []));
  }

  public async getMatchById(matchId: string): Promise<MatchSummary | null> {
    const { data, error } = await this.client
      .from('vw_matches_summary')
      .select('*')
      .eq('match_id', matchId)
      .maybeSingle();

    if (error) {
      throw new Error(`Erro ao buscar resumo da partida (${matchId}): ${error.message}`);
    }

    if (data) {
      const summaries = await this.enrichMatchSummaries([data as MatchSummaryRow]);
      return summaries[0] || null;
    }

    // Fallback: se não encontrado na view, busca diretamente na tabela matches
    const { data: matchData } = await this.client
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .maybeSingle();

    if (!matchData) return null;

    const { data: sData } = await this.client
      .from('sessions')
      .select('session_date')
      .eq('id', matchData.session_id)
      .maybeSingle();

    const { data: htData } = await this.client
      .from('session_teams')
      .select('name, color_hex')
      .eq('id', matchData.home_team_id)
      .maybeSingle();

    const { data: atData } = await this.client
      .from('session_teams')
      .select('name, color_hex')
      .eq('id', matchData.away_team_id)
      .maybeSingle();

    const row: MatchSummaryRow = {
      match_id: matchData.id,
      session_id: matchData.session_id,
      session_date: sData?.session_date || '',
      home_team_id: matchData.home_team_id,
      home_team_name: htData?.name || 'Mandante',
      home_team_color: htData?.color_hex || '#333333',
      home_score: matchData.home_score,
      away_team_id: matchData.away_team_id,
      away_team_name: atData?.name || 'Visitante',
      away_team_color: atData?.color_hex || '#333333',
      away_score: matchData.away_score,
      duration_seconds: matchData.duration_seconds,
      end_reason: matchData.end_reason,
      status: matchData.status,
      started_at: matchData.started_at,
      finished_at: matchData.finished_at,
    };

    const summaries = await this.enrichMatchSummaries([row]);
    return summaries[0] || null;
  }
}
