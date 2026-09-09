import { matchOutput } from '../dtos/matchOutput';
import type { IMatchRepository } from '../../domain/repositories/IMatchRepository';
import { MatchEvent } from '../../domain/entities/MatchEvent';
import { EntityNotFoundError } from '../../domain/errors/EntityNotFoundError';
import type { RegisterGoalInput, RegisterGoalOutput } from '../dtos/RegisterGoalDTO';

export class RegisterGoalUseCase {
  constructor(private matchRepository: IMatchRepository) {}

  public async execute(input: RegisterGoalInput): Promise<RegisterGoalOutput> {
    if (this.matchRepository.executeCommand) {
      const { match, eventId } = await this.matchRepository.executeCommand({
        action: 'goal',
        matchId: input.matchId,
        operationId: crypto.randomUUID(),
        input: { ...input },
      });
      const event = match.events?.find((e) => e.id === eventId);
      if (!event) throw new Error('Gol salvo, mas a confirmação não pôde ser carregada.');
      return {
        match: matchOutput(match),
        event,
        isMatchFinished: match.status === 'finished',
        matchEndReason: match.endReason,
      };
    }

    const match = await this.matchRepository.findById(input.matchId);

    if (!match) {
      throw new EntityNotFoundError('Partida', input.matchId);
    }

    const norm = (id?: string | null) => (id ? id.trim().toLowerCase() : '');
    const homeId = norm(match.homeTeamId);
    const awayId = norm(match.awayTeamId);
    const inputTeamId = norm(input.teamId);

    if (homeId !== inputTeamId && awayId !== inputTeamId) {
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

    // Registra o gol na entidade da partida (aplica regra dos 2 gols, trata gol contra e permite jogos finalizados se solicitado)
    match.registerGoal(
      input.teamId,
      input.eventTimeSeconds,
      input.isOwnGoal ?? false,
      input.allowFinished ?? true
    );

    // Persiste o evento e a partida atualizada
    const savedEvent = await this.matchRepository.addEvent(event);
    const updatedMatch = await this.matchRepository.update(match);

    if (this.matchRepository.recalculateMatchScore) {
      try {
        await this.matchRepository.recalculateMatchScore(input.matchId);
      } catch {
        // Recálculo seguro não-bloqueante
      }
    }

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
