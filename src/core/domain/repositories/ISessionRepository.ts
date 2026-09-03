import type { Session, SessionStatus } from '../entities/Session';
import type { Team } from '../entities/Team';

export interface CreateSessionTeamPlayerInput {
  playerId: string;
  isGoalkeeper?: boolean;
  isLoaned?: boolean;
  isCaptain?: boolean;
}

export interface CreateSessionTeamInput {
  name: string;
  colorHex?: string;
  captainId?: string | null;
  playerIds?: string[];
  players?: (string | CreateSessionTeamPlayerInput)[];
}

export interface UpdateSessionTeamPlayerInput {
  playerId: string;
  isGoalkeeper?: boolean;
  isLoaned?: boolean;
  isCaptain?: boolean;
}

export interface UpdateSessionTeamInput {
  id: string;
  name?: string;
  captainId?: string | null;
  colorHex?: string;
  players?: UpdateSessionTeamPlayerInput[];
}

export interface ISessionRepository {
  findAll(): Promise<Session[]>;
  findLatest(): Promise<Session | null>;
  findById(id: string): Promise<Session | null>;
  findByDate(date: string): Promise<Session | null>;
  create(session: Session, teams?: CreateSessionTeamInput[]): Promise<Session>;
  updateStatus(id: string, status: SessionStatus): Promise<void>;
  getTeamsBySessionId(sessionId: string): Promise<Team[]>;
  updateTeams(sessionId: string, teams: UpdateSessionTeamInput[]): Promise<Team[]>;
  addPlayerToTeam(teamId: string, playerId: string, isLoaned?: boolean, isGoalkeeper?: boolean): Promise<void>;
  removePlayerFromTeam(teamId: string, playerId: string): Promise<void>;
  transferPlayer(fromTeamId: string, toTeamId: string, playerId: string, isLoaned?: boolean, isGoalkeeper?: boolean): Promise<void>;
}
