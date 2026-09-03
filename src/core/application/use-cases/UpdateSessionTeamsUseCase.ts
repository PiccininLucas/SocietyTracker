import type { ISessionRepository } from '../../domain/repositories/ISessionRepository';
import type {
  UpdateSessionTeamsInputDTO,
  UpdateSessionTeamsOutputDTO,
} from '../dtos/UpdateSessionTeamsDTO';

export class UpdateSessionTeamsUseCase {
  constructor(private sessionRepository: ISessionRepository) {}

  public async execute(input: UpdateSessionTeamsInputDTO): Promise<UpdateSessionTeamsOutputDTO> {
    if (!input.sessionId || input.sessionId.trim() === '') {
      throw new Error('ID da rodada é obrigatório.');
    }

    if (!input.teams || input.teams.length === 0) {
      throw new Error('É necessário fornecer ao menos um time para atualização.');
    }

    for (const team of input.teams) {
      if (!team.name || team.name.trim() === '') {
        throw new Error('Nome do time não pode ser vazio.');
      }
    }

    const updatedTeams = await this.sessionRepository.updateTeams(
      input.sessionId,
      input.teams.map((t) => ({
        id: t.id,
        name: t.name.trim(),
        captainId: t.captainId || null,
        colorHex: t.colorHex,
        players: t.players.map((p) => ({
          playerId: p.playerId,
          isGoalkeeper: p.isGoalkeeper ?? false,
          isLoaned: p.isLoaned ?? false,
          isCaptain: p.isCaptain ?? (t.captainId ? t.captainId === p.playerId : false),
        })),
      }))
    );

    return {
      sessionId: input.sessionId,
      teams: updatedTeams.map((t) => ({
        id: t.id || '',
        sessionId: t.sessionId,
        name: t.name,
        colorHex: t.colorHex,
        captainId: t.captainId || null,
        playersCount: t.players.length,
        players: t.players.map((tp) => ({
          id: tp.playerId,
          name: tp.player?.name || 'Jogador',
          nickname: tp.player?.nickname || null,
          avatarUrl: tp.player?.avatarUrl || null,
          isGoalkeeper: tp.isGoalkeeper ?? false,
          isLoaned: tp.isLoaned ?? false,
          isCaptain: tp.isCaptain ?? (t.captainId ? t.captainId === tp.playerId : false),
        })),
      })),
    };
  }
}
