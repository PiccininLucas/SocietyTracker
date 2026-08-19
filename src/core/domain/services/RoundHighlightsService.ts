export interface PlayerRoundStats {
  playerId: string;
  name: string;
  nickname?: string | null;
  avatarUrl?: string | null;
  teamName?: string;
  teamColor?: string;
  isGoalkeeper: boolean;
  goals: number;
  assists: number;
  contributions: number; // goals + assists
}

export interface RoundHighlights {
  topScorers: string[];     // Nomes com empate permitido
  topAssisters: string[];   // Nomes com empate permitido
  mvps: string[];           // Nomes com maior G+A
  bottomPlayers: string[];  // Apenas jogadores de LINHA com 0 G e 0 A ("Bola Murcha")
}

export class RoundHighlightsService {
  public static calculate(stats: PlayerRoundStats[]): RoundHighlights {
    if (!stats || stats.length === 0) {
      return { topScorers: [], topAssisters: [], mvps: [], bottomPlayers: [] };
    }

    const maxGoals = Math.max(...stats.map((s) => s.goals));
    const maxAssists = Math.max(...stats.map((s) => s.assists));
    const maxContributions = Math.max(...stats.map((s) => s.contributions));

    return {
      topScorers: maxGoals > 0 ? stats.filter((s) => s.goals === maxGoals).map((s) => s.name) : [],
      topAssisters: maxAssists > 0 ? stats.filter((s) => s.assists === maxAssists).map((s) => s.name) : [],
      mvps: maxContributions > 0 ? stats.filter((s) => s.contributions === maxContributions).map((s) => s.name) : [],
      // REGRA: Apenas jogadores de LINHA (não goleiros) entram no Bola Murcha
      bottomPlayers: stats
        .filter((s) => !s.isGoalkeeper && s.goals === 0 && s.assists === 0)
        .map((s) => s.name),
    };
  }
}
