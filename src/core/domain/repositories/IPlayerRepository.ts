import type { Player } from '../entities/Player';

export interface IPlayerRepository {
  findAll(activeOnly?: boolean): Promise<Player[]>;
  findById(id: string): Promise<Player | null>;
  create(player: Player): Promise<Player>;
  update(player: Player): Promise<Player>;
}
