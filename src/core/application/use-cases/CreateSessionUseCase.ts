import type { ISessionRepository } from '../../domain/repositories/ISessionRepository';
import { Session, assertValidRoundFormat } from '../../domain/entities/Session';
import { DomainError } from '../../domain/errors/DomainError';
import type { CreateSessionInputDTO, CreateSessionOutputDTO } from '../dtos/CreateSessionDTO';

export class CreateSessionUseCase {
  constructor(private sessionRepository: ISessionRepository) {}

  public async execute(input: CreateSessionInputDTO): Promise<CreateSessionOutputDTO> {
    if (!input.sessionDate || input.sessionDate.trim() === '') {
      throw new DomainError('Data da rodada é obrigatória.');
    }

    assertValidRoundFormat(input.teams);

    const session = new Session({
      sessionDate: input.sessionDate.trim(),
      status: 'ongoing',
      notes: input.notes?.trim() || null,
      matchDurationSeconds: input.matchDurationSeconds,
    });

    const created = await this.sessionRepository.create(session, input.teams);

    return {
      id: created.id || '',
      sessionDate: created.sessionDate,
      status: created.status,
      notes: created.notes || null,
      matchDurationSeconds: created.matchDurationSeconds,
      teams: created.teams.map((t) => ({
        id: t.id || '',
        sessionId: t.sessionId,
        name: t.name,
        colorHex: t.colorHex,
        captainId: t.captainId || null,
        playersCount: t.players.length,
      })),
      createdAt: created.createdAt || new Date(),
    };
  }
}
