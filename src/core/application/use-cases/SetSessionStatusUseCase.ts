import type { SessionStatus } from '../../domain/entities/Session';
import type { ISessionRepository } from '../../domain/repositories/ISessionRepository';

export interface SetSessionStatusInputDTO {
  sessionId: string;
  status: SessionStatus;
}

/**
 * Encerra ou reabre a rodada. A regra (sem partida em andamento para encerrar; rodada
 * encerrada não aceita partida nova) vive na transação SQL, como as da partida: ver
 * `202609240003_close_session.sql` e o ADR 0001.
 */
export class SetSessionStatusUseCase {
  constructor(private sessionRepository: ISessionRepository) {}

  public async execute(input: SetSessionStatusInputDTO): Promise<SetSessionStatusInputDTO> {
    await this.sessionRepository.updateStatus(input.sessionId, input.status);
    return { sessionId: input.sessionId, status: input.status };
  }
}
