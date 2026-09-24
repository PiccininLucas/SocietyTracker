import { MATCH_RULES } from '../../core/domain/entities/Match';

export interface LivePlayer {
  id: string;
  name: string;
  nickname?: string | null;
  avatarUrl?: string | null;
  isLoaned?: boolean;
  isGoalkeeper?: boolean;
  isCaptain?: boolean;
  originalTeamId?: string;
}

export interface LiveTeam {
  id: string;
  sessionId?: string;
  name: string;
  colorHex: string;
  captainId?: string | null;
  players: LivePlayer[];
}

// Fonte única: a regra vive no domínio. Antes havia uma cópia literal aqui, que podia
// divergir de MATCH_RULES sem que nada acusasse.
export const DEFAULT_MATCH_DURATION_SECONDS = MATCH_RULES.MAX_DURATION_SECONDS;
export const MAX_GOALS_FOR_VICTORY = MATCH_RULES.MAX_GOALS_FOR_VICTORY;
