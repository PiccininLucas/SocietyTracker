import type { IMatchRepository } from '../../domain/repositories/IMatchRepository';
import { EntityNotFoundError } from '../../domain/errors/EntityNotFoundError';
import type { UpdateMatchScoreInput, UpdateMatchScoreOutput } from '../dtos/UpdateMatchScoreDTO';

export class UpdateMatchScoreUseCase {
  constructor(private matchRepository: IMatchRepository) {}

  public async execute(input: UpdateMatchScoreInput): Promise<UpdateMatchScoreOutput> {
    const match = await this.matchRepository.findById(input.matchId);

    if (!match) {
      throw new EntityNotFoundError('Partida', input.matchId);
    }

    if (input.homeScore !== undefined || input.awayScore !== undefined) {
      const nextHome = input.homeScore !== undefined ? input.homeScore : match.homeScore;
      const nextAway = input.awayScore !== undefined ? input.awayScore : match.awayScore;
      match.setScores(nextHome, nextAway);
    }

    if (input.durationSeconds !== undefined) {
      match.updateDuration(input.durationSeconds);
    }

    if (input.status === 'finished') {
      match.finish(input.endReason || match.endReason || 'manual');
    }

    const updatedMatch = await this.matchRepository.update(match);

    return {
      id: updatedMatch.id || match.id || input.matchId,
      sessionId: updatedMatch.sessionId,
      homeTeamId: updatedMatch.homeTeamId,
      awayTeamId: updatedMatch.awayTeamId,
      homeScore: updatedMatch.homeScore,
      awayScore: updatedMatch.awayScore,
      durationSeconds: updatedMatch.durationSeconds,
      endReason: updatedMatch.endReason,
      status: updatedMatch.status,
      isFinished: updatedMatch.isFinished,
    };
  }
}
