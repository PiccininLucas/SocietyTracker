import type { ISessionRepository } from '../../domain/repositories/ISessionRepository';
import { Session } from '../../domain/entities/Session';
import type {
  CreateSessionInputDTO,
  CreateSessionOutputDTO,
} from '../dtos/CreateSessionDTO';

export class CreateSessionUseCase {
  constructor(private sessionRepository: ISessionRepository) {}

  public async execute(input: CreateSessionInputDTO): Promise<CreateSessionOutputDTO> {
    if (!input.sessionDate || input.sessionDate.trim() === '') {
      throw new Error('Data da rodada é obrigatória.');
    }

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
        playersCount: t.players.length,
      })),
      createdAt: created.createdAt || new Date(),
    };
  }
}
