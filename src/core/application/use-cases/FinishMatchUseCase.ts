import type { IMatchRepository } from '../../domain/repositories/IMatchRepository';
import { EntityNotFoundError } from '../../domain/errors/EntityNotFoundError';
import type { FinishMatchInput, FinishMatchOutput } from '../dtos/FinishMatchDTO';

export class FinishMatchUseCase {
  constructor(private matchRepository: IMatchRepository) {}

  public async execute(input: FinishMatchInput): Promise<FinishMatchOutput> {
    const match = await this.matchRepository.findById(input.matchId);

    if (!match) {
      throw new EntityNotFoundError('Partida', input.matchId);
    }

    if (input.durationSeconds !== undefined) {
      match.updateDuration(input.durationSeconds);
    }

    // Se houver placares fornecidos diretamente na finalização, aplica
    if (input.homeScore !== undefined && input.awayScore !== undefined) {
      match.setScores(input.homeScore, input.awayScore);
    } else {
      // Sincroniza com os eventos da partida para garantir que o placar final não seja sobrescrito com dados defasados
      try {
        const events = await this.matchRepository.getEventsByMatchId(input.matchId);
        if (events && events.length > 0) {
          const norm = (id?: string | null) => (id ? id.trim().toLowerCase() : '');
          const homeTeamId = norm(match.homeTeamId);
          const awayTeamId = norm(match.awayTeamId);

          const calcHome = events.filter((e) => {
            const tId = norm(e.teamId);
            return (!e.isOwnGoal && tId === homeTeamId) || (e.isOwnGoal && tId === awayTeamId);
          }).length;

          const calcAway = events.filter((e) => {
            const tId = norm(e.teamId);
            return (!e.isOwnGoal && tId === awayTeamId) || (e.isOwnGoal && tId === homeTeamId);
          }).length;

          match.setScores(calcHome, calcAway);
        }
      } catch {
        // Ignora erro e mantém placar atual do objeto match
      }
    }

    match.finish(input.reason || 'manual');

    const updatedMatch = await this.matchRepository.update(match);

    return {
      id: updatedMatch.id || match.id || input.matchId,
      sessionId: updatedMatch.sessionId,
      homeTeamId: updatedMatch.homeTeamId,
      awayTeamId: updatedMatch.awayTeamId,
      homeScore: updatedMatch.homeScore,
      awayScore: updatedMatch.awayScore,
      durationSeconds: updatedMatch.durationSeconds,
      endReason: updatedMatch.endReason || null,
      status: updatedMatch.status,
      finishedAt: updatedMatch.finishedAt || null,
    };
  }
}
