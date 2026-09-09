import type { IMatchRepository } from '../../domain/repositories/IMatchRepository';
import { EntityNotFoundError } from '../../domain/errors/EntityNotFoundError';
import { InvalidGoalEventError } from '../../domain/errors/InvalidGoalEventError';
import type { UpdateMatchEventInput, UpdateMatchEventOutput } from '../dtos/UpdateMatchEventDTO';

export class UpdateMatchEventUseCase {
  constructor(private matchRepository: IMatchRepository) {}

  public async execute(input: UpdateMatchEventInput): Promise<UpdateMatchEventOutput> {
    if (this.matchRepository.executeCommand) {
      const { match } = await this.matchRepository.executeCommand({
        action: 'edit',
        matchId: input.matchId,
        operationId: crypto.randomUUID(),
        input: { ...input },
      });
      return {
        eventId: input.eventId,
        matchId: input.matchId,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
      };
    }

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

    const isOwnGoal = input.isOwnGoal ?? false;

    if (!isOwnGoal && !input.scorerId) {
      throw new InvalidGoalEventError(
        'Gol normal exige a identificação do autor do gol (scorerId).'
      );
    }

    if (isOwnGoal && input.assistId) {
      throw new InvalidGoalEventError('Gol contra não pode ter assistência.');
    }

    if (input.scorerId && input.assistId && input.scorerId === input.assistId) {
      throw new InvalidGoalEventError('O autor do gol não pode ser o mesmo da assistência.');
    }

    if (input.teamId) {
      const norm = (id?: string | null) => (id ? id.trim().toLowerCase() : '');
      const homeId = norm(match.homeTeamId);
      const awayId = norm(match.awayTeamId);
      const inputTeamId = norm(input.teamId);

      if (homeId !== inputTeamId && awayId !== inputTeamId) {
        throw new Error('O time informado não pertence a esta partida.');
      }
    }

    await this.matchRepository.updateEvent(input.eventId, {
      teamId: input.teamId,
      scorerId: isOwnGoal ? null : input.scorerId || null,
      assistId: isOwnGoal ? null : input.assistId || null,
      isOwnGoal,
    });

    const scores = await this.matchRepository.recalculateMatchScore(input.matchId);

    return {
      eventId: input.eventId,
      matchId: input.matchId,
      homeScore: scores.homeScore,
      awayScore: scores.awayScore,
    };
  }
}
