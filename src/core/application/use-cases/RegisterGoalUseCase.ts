import type { IMatchRepository } from '../../domain/repositories/IMatchRepository';
import { MatchEvent } from '../../domain/entities/MatchEvent';
import { EntityNotFoundError } from '../../domain/errors/EntityNotFoundError';
import type { RegisterGoalInput, RegisterGoalOutput } from '../dtos/RegisterGoalDTO';

export class RegisterGoalUseCase {
  constructor(private matchRepository: IMatchRepository) {}

  public async execute(input: RegisterGoalInput): Promise<RegisterGoalOutput> {
    const match = await this.matchRepository.findById(input.matchId);

    if (!match) {
      throw new EntityNotFoundError('Partida', input.matchId);
    }

    if (match.homeTeamId !== input.teamId && match.awayTeamId !== input.teamId) {
      throw new Error('O time informado não pertence a esta partida.');
    }

    // Cria a entidade do evento (valida regras de scorer / assist / own goal)
    const event = new MatchEvent({
      matchId: input.matchId,
      teamId: input.teamId,
      scorerId: input.scorerId,
      assistId: input.assistId,
      eventTimeSeconds: input.eventTimeSeconds ?? match.durationSeconds,
      isOwnGoal: input.isOwnGoal ?? false,
    });

    // Registra o gol na entidade da partida (aplica regra dos 2 gols)
    const result = match.registerGoal(input.teamId, input.eventTimeSeconds);

    // Persiste o evento e a partida atualizada
    const savedEvent = await this.matchRepository.addEvent(event);
    const updatedMatch = await this.matchRepository.update(match);

    return {
      match: {
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
      },
      event: {
        id: savedEvent.id,
        matchId: savedEvent.matchId,
        teamId: savedEvent.teamId,
        scorerId: savedEvent.scorerId,
        assistId: savedEvent.assistId,
        eventTimeSeconds: savedEvent.eventTimeSeconds,
        isOwnGoal: savedEvent.isOwnGoal,
      },
      isMatchFinished: updatedMatch.isFinished,
      matchEndReason: updatedMatch.endReason,
    };
  }
}
