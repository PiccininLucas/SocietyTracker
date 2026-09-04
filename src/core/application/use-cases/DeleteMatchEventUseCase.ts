import type { IMatchRepository } from '../../domain/repositories/IMatchRepository';
import { EntityNotFoundError } from '../../domain/errors/EntityNotFoundError';
import type { DeleteMatchEventInput, DeleteMatchEventOutput } from '../dtos/DeleteMatchEventDTO';

export class DeleteMatchEventUseCase {
  constructor(private matchRepository: IMatchRepository) {}

  public async execute(input: DeleteMatchEventInput): Promise<DeleteMatchEventOutput> {
    if (!input.matchId) {
      throw new Error('ID da partida é obrigatório.');
    }
    if (!input.eventId) {
      throw new Error('ID do evento é obrigatório.');
    }

    const match = await this.matchRepository.findById(input.matchId);
    if (!match) {
      throw new EntityNotFoundError('Partida', input.matchId);
    }

    await this.matchRepository.deleteEvent(input.eventId);

    const scores = await this.matchRepository.recalculateMatchScore(input.matchId);

    return {
      matchId: input.matchId,
      eventId: input.eventId,
      homeScore: scores.homeScore,
      awayScore: scores.awayScore,
    };
  }
}
