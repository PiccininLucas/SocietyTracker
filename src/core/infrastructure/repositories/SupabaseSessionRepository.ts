import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin as defaultClient } from '../database/supabaseClient';
import type {
  ISessionRepository,
  CreateSessionTeamInput,
  UpdateSessionTeamInput,
} from '../../domain/repositories/ISessionRepository';
import { Session, type SessionStatus } from '../../domain/entities/Session';
import { Team, type TeamPlayer } from '../../domain/entities/Team';
import { DatabaseError } from '../database/DatabaseError';

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
  captain_id?: string | null;
  created_at: string;
  session_team_players?: TeamPlayerRow[];
}

interface TeamPlayerRow {
  player_id: string;
  is_loaned: boolean;
  is_goalkeeper?: boolean;
  is_captain?: boolean;
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

  private mapTeamPlayerToDomain(row: TeamPlayerRow, captainId?: string | null): TeamPlayer {
    return {
      playerId: row.player_id,
      isLoaned: row.is_loaned ?? false,
      isGoalkeeper: row.is_goalkeeper ?? false,
      isCaptain: captainId !== undefined ? captainId === row.player_id : (row.is_captain ?? false),
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
      this.mapTeamPlayerToDomain(tp, row.captain_id)
    );

    return new Team({
      id: row.id,
      sessionId: row.session_id,
      name: row.name,
      colorHex: row.color_hex,
      captainId: row.captain_id || null,
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

    return ((data as SessionRow[]) || []).map((row) => this.mapSessionToDomain(row));
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

  /**
   * Sessão, times e escalações numa única transação (society_create_session,
   * migração 202609220001). Com inserts separados, uma falha no meio deixava uma sessão
   * órfã que bloqueava novas tentativas para a mesma data.
   */
  public async create(session: Session, teams?: CreateSessionTeamInput[]): Promise<Session> {
    const payload = (teams ?? []).map((team) => ({
      name: team.name,
      colorHex: team.colorHex || '#333333',
      captainId: team.captainId || null,
      players: (team.players?.length ? team.players : (team.playerIds ?? [])).map((p) =>
        typeof p === 'string'
          ? { playerId: p, isGoalkeeper: false, isLoaned: false }
          : {
              playerId: p.playerId,
              isGoalkeeper: p.isGoalkeeper ?? false,
              isLoaned: p.isLoaned ?? false,
            }
      ),
    }));

    const { data, error } = await this.client.rpc('society_create_session', {
      p_date: session.sessionDate,
      p_notes: session.notes || null,
      p_duration: session.matchDurationSeconds ?? 420,
      p_teams: payload,
    });

    if (error) throw new DatabaseError(error.message, error.code);

    const created = await this.findById(data as string);
    if (!created) {
      throw new Error('Rodada criada, mas não foi possível carregá-la. Recarregue a página.');
    }
    return created;
  }

  public async updateStatus(id: string, status: SessionStatus): Promise<void> {
    const { error } = await this.client.from('sessions').update({ status }).eq('id', id);

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

    return ((data as TeamRow[]) || []).map((row) => this.mapTeamToDomain(row));
  }

  public async updateTeams(sessionId: string, teams: UpdateSessionTeamInput[]): Promise<Team[]> {
    const { error } = await this.client.rpc('society_update_teams', {
      p_session_id: sessionId,
      p_teams: teams,
    });
    if (error) throw new Error(error.message);
    return this.getTeamsBySessionId(sessionId);
  }

  public async transferPlayer(
    fromTeamId: string,
    toTeamId: string,
    playerId: string,
    isLoaned = false,
    isGoalkeeper = false
  ): Promise<void> {
    const { error } = await this.client.rpc('society_transfer_player', {
      p_from: fromTeamId,
      p_to: toTeamId,
      p_player: playerId,
      p_loaned: isLoaned,
      p_goalkeeper: isGoalkeeper,
    });
    if (error) throw new Error(error.message);
  }
}
