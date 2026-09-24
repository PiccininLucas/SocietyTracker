import { DomainError } from '../../domain/errors/DomainError';
import { EntityNotFoundError } from '../../domain/errors/EntityNotFoundError';
import type { IPlayerRepository } from '../../domain/repositories/IPlayerRepository';
import type { UpdatePlayerInputDTO, UpdatePlayerOutputDTO } from '../dtos/UpdatePlayerDTO';

export class UpdatePlayerUseCase {
  constructor(private playerRepository: IPlayerRepository) {}

  public async execute(input: UpdatePlayerInputDTO): Promise<UpdatePlayerOutputDTO> {
    if (!input.id || input.id.trim() === '') {
      throw new DomainError('ID do jogador é obrigatório.');
    }

    // PATCH é atualização parcial: só validamos o nome quando ele foi informado.
    if (input.name !== undefined && input.name.trim() === '') {
      throw new DomainError('Nome do jogador é obrigatório.');
    }

    const player = await this.playerRepository.findById(input.id.trim());

    if (!player) {
      throw new EntityNotFoundError('Jogador', input.id);
    }

    player.updateInfo(input.name, input.nickname, input.isGoalkeeper);

    const updated = await this.playerRepository.update(player);

    return {
      id: updated.id || input.id,
      name: updated.name,
      nickname: updated.nickname || null,
      avatarUrl: updated.avatarUrl || null,
      isGoalkeeper: updated.isGoalkeeper,
      isActive: updated.isActive,
      createdAt: updated.createdAt || new Date(),
    };
  }
}
