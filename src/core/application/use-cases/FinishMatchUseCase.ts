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
