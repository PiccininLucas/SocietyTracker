import type { IPlayerRepository } from '../../domain/repositories/IPlayerRepository';
import type {
  UpdatePlayerInputDTO,
  UpdatePlayerOutputDTO,
} from '../dtos/UpdatePlayerDTO';

export class UpdatePlayerUseCase {
  constructor(private playerRepository: IPlayerRepository) {}

  public async execute(input: UpdatePlayerInputDTO): Promise<UpdatePlayerOutputDTO> {
    if (!input.id || input.id.trim() === '') {
      throw new Error('ID do jogador é obrigatório.');
    }

    if (!input.name || input.name.trim() === '') {
      throw new Error('Nome do jogador é obrigatório.');
    }

    const player = await this.playerRepository.findById(input.id.trim());

    if (!player) {
      throw new Error(`Jogador com ID ${input.id} não encontrado.`);
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
