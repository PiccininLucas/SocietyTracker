import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as defaultClient } from '../database/supabaseClient';
import type {
  ISessionRepository,
  CreateSessionTeamInput,
} from '../../domain/repositories/ISessionRepository';
import { Session, type SessionStatus } from '../../domain/entities/Session';
import { Team, type TeamPlayer } from '../../domain/entities/Team';
import { executeWithSchemaFallback } from '../database/schemaResilience';

interface SessionRow {
  id: string;
  session_date: string;
  status: SessionStatus;
  notes: string | null;
  match_duration_seconds?: number;
  created_at: string;
  session_teams?: TeamRow[];
}

interface TeamRow {
  id: string;
  session_id: string;
  name: string;
  color_hex: string;
  created_at: string;
  session_team_players?: TeamPlayerRow[];
}

interface TeamPlayerRow {
  player_id: string;
  is_loaned: boolean;
  is_goalkeeper?: boolean;
  players?: {
    name: string;
    nickname: string | null;
    avatar_url: string | null;
  };
}

export class SupabaseSessionRepository implements ISessionRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || defaultClient;
  }

  private mapTeamPlayerToDomain(row: TeamPlayerRow): TeamPlayer {
    return {
      playerId: row.player_id,
      isLoaned: row.is_loaned ?? false,
      isGoalkeeper: row.is_goalkeeper ?? false,
      player: row.players
        ? {
            name: row.players.name,
            nickname: row.players.nickname,
            avatarUrl: row.players.avatar_url,
          }
        : undefined,
    };
  }

  private mapTeamToDomain(row: TeamRow): Team {
    const players: TeamPlayer[] = (row.session_team_players || []).map((tp) =>
      this.mapTeamPlayerToDomain(tp)
    );

    return new Team({
      id: row.id,
      sessionId: row.session_id,
      name: row.name,
      colorHex: row.color_hex,
      players,
      createdAt: new Date(row.created_at),
    });
  }

  private mapSessionToDomain(row: SessionRow): Session {
    const teams = (row.session_teams || []).map((t) => this.mapTeamToDomain(t));

    return new Session({
      id: row.id,
      sessionDate: row.session_date,
      status: row.status,
      notes: row.notes,
      matchDurationSeconds: row.match_duration_seconds ?? 420,
      teams,
      createdAt: new Date(row.created_at),
    });
  }

  public async findAll(): Promise<Session[]> {
    const { data, error } = await this.client
      .from('sessions')
      .select('*, session_teams(*, session_team_players(*, players(name, nickname, avatar_url)))')
      .order('session_date', { ascending: false });

    if (error) {
      throw new Error(`Erro ao listar sessões: ${error.message}`);
    }

    return (data as SessionRow[] || []).map((row) => this.mapSessionToDomain(row));
  }

  public async findLatest(): Promise<Session | null> {
    const { data, error } = await this.client
      .from('sessions')
      .select('*, session_teams(*, session_team_players(*, players(name, nickname, avatar_url)))')
      .order('session_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Erro ao buscar última sessão: ${error.message}`);
    }

    if (!data) return null;

    return this.mapSessionToDomain(data as SessionRow);
  }

  public async findById(id: string): Promise<Session | null> {
    const { data, error } = await this.client
      .from('sessions')
      .select('*, session_teams(*, session_team_players(*, players(name, nickname, avatar_url)))')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Erro ao buscar sessão por ID (${id}): ${error.message}`);
    }

    if (!data) return null;

    return this.mapSessionToDomain(data as SessionRow);
  }

  public async findByDate(date: string): Promise<Session | null> {
    const { data, error } = await this.client
      .from('sessions')
      .select('*, session_teams(*, session_team_players(*, players(name, nickname, avatar_url)))')
      .eq('session_date', date)
      .maybeSingle();

    if (error) {
      throw new Error(`Erro ao buscar sessão por data (${date}): ${error.message}`);
    }

    if (!data) return null;

    return this.mapSessionToDomain(data as SessionRow);
  }

  public async create(session: Session, teams?: CreateSessionTeamInput[]): Promise<Session> {
    // 1. Criar sessão
    const { data: sessionData, error: sessionError } = await executeWithSchemaFallback<SessionRow>(
      'sessions',
      {
        session_date: session.sessionDate,
        status: session.status,
        notes: session.notes || null,
        match_duration_seconds: session.matchDurationSeconds ?? 420,
      },
      (cleanPayload) =>
        this.client.from('sessions').insert(cleanPayload).select('*').single()
    );

    if (sessionError || !sessionData) {
      throw new Error(`Erro ao criar sessão: ${sessionError?.message}`);
    }

    const createdSessionId = sessionData.id as string;
    const createdTeams: Team[] = [];

    // 2. Criar os times e vincular jogadores se fornecidos
    if (teams && teams.length > 0) {
      for (const teamInput of teams) {
        const { data: teamData, error: teamError } = await executeWithSchemaFallback<TeamRow>(
          'session_teams',
          {
            session_id: createdSessionId,
            name: teamInput.name,
            color_hex: teamInput.colorHex || '#333333',
          },
          (cleanPayload) =>
            this.client.from('session_teams').insert(cleanPayload).select('*').single()
        );

        if (teamError || !teamData) {
          throw new Error(`Erro ao criar time '${teamInput.name}': ${teamError?.message}`);
        }

        const teamPlayers: TeamPlayer[] = [];

        if (teamInput.players && teamInput.players.length > 0) {
          const normalized = teamInput.players.map((p) =>
            typeof p === 'string'
              ? { playerId: p, isGoalkeeper: false, isLoaned: false }
              : { playerId: p.playerId, isGoalkeeper: p.isGoalkeeper ?? false, isLoaned: p.isLoaned ?? false }
          );

          const playerRows = normalized.map((p) => ({
            session_team_id: teamData.id,
            player_id: p.playerId,
            is_loaned: p.isLoaned,
            is_goalkeeper: p.isGoalkeeper,
          }));

          const { error: playersError } = await executeWithSchemaFallback(
            'session_team_players',
            playerRows,
            (cleanPayload) => this.client.from('session_team_players').insert(cleanPayload)
          );

          if (playersError) {
            throw new Error(`Erro ao vincular jogadores ao time '${teamInput.name}': ${playersError.message}`);
          }

          teamPlayers.push(
            ...normalized.map((p) => ({
              playerId: p.playerId,
              isLoaned: p.isLoaned,
              isGoalkeeper: p.isGoalkeeper,
            }))
          );
        } else if (teamInput.playerIds && teamInput.playerIds.length > 0) {
          const playerRows = teamInput.playerIds.map((playerId) => ({
            session_team_id: teamData.id,
            player_id: playerId,
            is_loaned: false,
            is_goalkeeper: false,
          }));

          const { error: playersError } = await executeWithSchemaFallback(
            'session_team_players',
            playerRows,
            (cleanPayload) => this.client.from('session_team_players').insert(cleanPayload)
          );

          if (playersError) {
            throw new Error(`Erro ao vincular jogadores ao time '${teamInput.name}': ${playersError.message}`);
          }

          teamPlayers.push(
            ...teamInput.playerIds.map((pid) => ({
              playerId: pid,
              isLoaned: false,
              isGoalkeeper: false,
            }))
          );
        }

        createdTeams.push(
          new Team({
            id: teamData.id,
            sessionId: createdSessionId,
            name: teamData.name,
            colorHex: teamData.color_hex,
            players: teamPlayers,
            createdAt: new Date(teamData.created_at),
          })
        );
      }
    }

    return new Session({
      id: createdSessionId,
      sessionDate: sessionData.session_date,
      status: sessionData.status,
      notes: sessionData.notes,
      matchDurationSeconds: sessionData.match_duration_seconds ?? session.matchDurationSeconds ?? 420,
      teams: createdTeams,
      createdAt: new Date(sessionData.created_at),
    });
  }

  public async updateStatus(id: string, status: SessionStatus): Promise<void> {
    const { error } = await this.client
      .from('sessions')
      .update({ status })
      .eq('id', id);

    if (error) {
      throw new Error(`Erro ao atualizar status da sessão (${id}): ${error.message}`);
    }
  }

  public async getTeamsBySessionId(sessionId: string): Promise<Team[]> {
    const { data, error } = await this.client
      .from('session_teams')
      .select('*, session_team_players(*, players(name, nickname, avatar_url))')
      .eq('session_id', sessionId);

    if (error) {
      throw new Error(`Erro ao buscar times da sessão (${sessionId}): ${error.message}`);
    }

    return (data as TeamRow[] || []).map((row) => this.mapTeamToDomain(row));
  }

  public async addPlayerToTeam(
    teamId: string,
    playerId: string,
    isLoaned = false,
    isGoalkeeper = false
  ): Promise<void> {
    const payload = {
      session_team_id: teamId,
      player_id: playerId,
      is_loaned: isLoaned,
      is_goalkeeper: isGoalkeeper,
    };

    const { error } = await executeWithSchemaFallback(
      'session_team_players',
      payload,
      (cleanPayload) =>
        this.client
          .from('session_team_players')
          .upsert(cleanPayload, { onConflict: 'session_team_id,player_id' })
    );

    if (error) {
      throw new Error(`Erro ao adicionar jogador ao time: ${error.message}`);
    }
  }

  public async removePlayerFromTeam(teamId: string, playerId: string): Promise<void> {
    const { error } = await this.client
      .from('session_team_players')
      .delete()
      .eq('session_team_id', teamId)
      .eq('player_id', playerId);

    if (error) {
      throw new Error(`Erro ao remover jogador do time: ${error.message}`);
    }
  }

  public async transferPlayer(
    fromTeamId: string,
    toTeamId: string,
    playerId: string,
    isLoaned = false,
    isGoalkeeper = false
  ): Promise<void> {
    // Remove do time anterior
    await this.removePlayerFromTeam(fromTeamId, playerId);
    // Adiciona no novo time
    await this.addPlayerToTeam(toTeamId, playerId, isLoaned, isGoalkeeper);
  }
}
