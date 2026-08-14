import type { ISessionRepository } from '../../domain/repositories/ISessionRepository';
import type {
  TransferPlayerInputDTO,
  TransferPlayerOutputDTO,
} from '../dtos/TransferPlayerDTO';

export class TransferPlayerUseCase {
  constructor(private sessionRepository: ISessionRepository) {}

  public async execute(input: TransferPlayerInputDTO): Promise<TransferPlayerOutputDTO> {
    if (!input.fromTeamId || !input.toTeamId || !input.playerId) {
      throw new Error('IDs do time de origem, time de destino e jogador são obrigatórios.');
    }

    if (input.fromTeamId === input.toTeamId) {
      throw new Error('Time de origem e destino devem ser diferentes.');
    }

    await this.sessionRepository.transferPlayer(
      input.fromTeamId,
      input.toTeamId,
      input.playerId,
      input.isLoaned ?? false
    );

    return {
      success: true,
      message: 'Jogador transferido com sucesso.',
      playerId: input.playerId,
      fromTeamId: input.fromTeamId,
      toTeamId: input.toTeamId,
      isLoaned: input.isLoaned ?? false,
    };
  }
}
