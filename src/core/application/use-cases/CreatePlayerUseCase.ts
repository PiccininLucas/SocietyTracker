import type { IPlayerRepository } from '../../domain/repositories/IPlayerRepository';
import { Player } from '../../domain/entities/Player';
import type {
  CreatePlayerInputDTO,
  CreatePlayerOutputDTO,
} from '../dtos/CreatePlayerDTO';

export class CreatePlayerUseCase {
  constructor(private playerRepository: IPlayerRepository) {}

  public async execute(input: CreatePlayerInputDTO): Promise<CreatePlayerOutputDTO> {
    if (!input.name || input.name.trim() === '') {
      throw new Error('Nome do jogador é obrigatório.');
    }

    const player = new Player({
      name: input.name.trim(),
      nickname: input.nickname?.trim() || null,
      avatarUrl: input.avatarUrl || null,
      isActive: input.isActive ?? true,
    });

    const created = await this.playerRepository.create(player);

    return {
      id: created.id || '',
      name: created.name,
      nickname: created.nickname || null,
      avatarUrl: created.avatarUrl || null,
      isActive: created.isActive,
      createdAt: created.createdAt || new Date(),
    };
  }
}
