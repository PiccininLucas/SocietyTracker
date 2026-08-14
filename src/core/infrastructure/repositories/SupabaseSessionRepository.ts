import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as defaultClient } from '../database/supabaseClient';
import type {
  ISessionRepository,
  CreateSessionTeamInput,
} from '../../domain/repositories/ISessionRepository';
import { Session, type SessionStatus } from '../../domain/entities/Session';
import { Team, type TeamPlayer } from '../../domain/entities/Team';

interface SessionRow {
  id: string;
  session_date: string;
  status: SessionStatus;
  notes: string | null;
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
  id: string;
  session_team_id: string;
  player_id: string;
  is_loaned: boolean;
  players?: {
    name: string;
    nickname: string | null;
    avatar_url: string | null;
  } | null;
}

export class SupabaseSessionRepository implements ISessionRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || defaultClient;
  }

  private mapTeamToDomain(row: TeamRow): Team {
    const players: TeamPlayer[] = (row.session_team_players || []).map((tp) => ({
      playerId: tp.player_id,
      isLoaned: tp.is_loaned,
      player: tp.players
        ? {
            name: tp.players.name,
            nickname: tp.players.nickname,
            avatarUrl: tp.players.avatar_url,
          }
        : undefined,
    }));

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
      teams,
      createdAt: new Date(row.created_at),
    });
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
    const { data: sessionData, error: sessionError } = await this.client
      .from('sessions')
      .insert({
        session_date: session.sessionDate,
        status: session.status,
        notes: session.notes || null,
      })
      .select('*')
      .single();

    if (sessionError) {
      throw new Error(`Erro ao criar sessão: ${sessionError.message}`);
    }

    const createdSessionId = sessionData.id as string;
    const createdTeams: Team[] = [];

    // 2. Criar os times e vincular jogadores se fornecidos
    if (teams && teams.length > 0) {
      for (const teamInput of teams) {
        const { data: teamData, error: teamError } = await this.client
          .from('session_teams')
          .insert({
            session_id: createdSessionId,
            name: teamInput.name,
            color_hex: teamInput.colorHex || '#333333',
          })
          .select('*')
          .single();

        if (teamError) {
          throw new Error(`Erro ao criar time '${teamInput.name}': ${teamError.message}`);
        }

        const teamPlayers: TeamPlayer[] = [];

        if (teamInput.playerIds && teamInput.playerIds.length > 0) {
          const playerRows = teamInput.playerIds.map((playerId) => ({
            session_team_id: teamData.id,
            player_id: playerId,
            is_loaned: false,
          }));

          const { error: playersError } = await this.client
            .from('session_team_players')
            .insert(playerRows);

          if (playersError) {
            throw new Error(`Erro ao vincular jogadores ao time '${teamInput.name}': ${playersError.message}`);
          }

          teamPlayers.push(...teamInput.playerIds.map((pid) => ({ playerId: pid, isLoaned: false })));
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

  public async addPlayerToTeam(teamId: string, playerId: string, isLoaned = false): Promise<void> {
    const { error } = await this.client
      .from('session_team_players')
      .upsert({
        session_team_id: teamId,
        player_id: playerId,
        is_loaned: isLoaned,
      }, { onConflict: 'session_team_id,player_id' });

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
    isLoaned = false
  ): Promise<void> {
    // Remove do time anterior
    await this.removePlayerFromTeam(fromTeamId, playerId);
    // Adiciona no novo time
    await this.addPlayerToTeam(toTeamId, playerId, isLoaned);
  }
}
