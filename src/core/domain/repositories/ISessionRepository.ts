import type { Session, SessionStatus } from '../entities/Session';
import type { Team } from '../entities/Team';

export interface CreateSessionTeamInput {
  name: string;
  colorHex?: string;
  playerIds?: string[];
}

export interface ISessionRepository {
  findAll(): Promise<Session[]>;
  findLatest(): Promise<Session | null>;
  findById(id: string): Promise<Session | null>;
  findByDate(date: string): Promise<Session | null>;
  create(session: Session, teams?: CreateSessionTeamInput[]): Promise<Session>;
  updateStatus(id: string, status: SessionStatus): Promise<void>;
  getTeamsBySessionId(sessionId: string): Promise<Team[]>;
  addPlayerToTeam(teamId: string, playerId: string, isLoaned?: boolean): Promise<void>;
  removePlayerFromTeam(teamId: string, playerId: string): Promise<void>;
  transferPlayer(fromTeamId: string, toTeamId: string, playerId: string, isLoaned?: boolean): Promise<void>;
}
