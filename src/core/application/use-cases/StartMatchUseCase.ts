import type { IMatchRepository } from '../../domain/repositories/IMatchRepository';
import { Match } from '../../domain/entities/Match';
import type { StartMatchInput, StartMatchOutput } from '../dtos/StartMatchDTO';

export class StartMatchUseCase {
  constructor(private matchRepository: IMatchRepository) {}

  public async execute(input: StartMatchInput): Promise<StartMatchOutput> {
    if (!input.sessionId) {
      throw new Error('ID da sessão é obrigatório.');
    }
    if (!input.homeTeamId || !input.awayTeamId) {
      throw new Error('Times mandante e visitante são obrigatórios.');
    }
    if (input.homeTeamId === input.awayTeamId) {
      throw new Error('Os dois times selecionados devem ser diferentes.');
    }

    // Cria a entidade da partida com estado inicial
    const match = new Match({
      sessionId: input.sessionId,
      homeTeamId: input.homeTeamId,
      awayTeamId: input.awayTeamId,
      homeScore: 0,
      awayScore: 0,
      durationSeconds: 0,
      status: 'ongoing',
      startedAt: new Date(),
    });

    const createdMatch = await this.matchRepository.create(match);

    return {
      id: createdMatch.id || '',
      sessionId: createdMatch.sessionId,
      homeTeamId: createdMatch.homeTeamId,
      awayTeamId: createdMatch.awayTeamId,
      homeScore: createdMatch.homeScore,
      awayScore: createdMatch.awayScore,
      durationSeconds: createdMatch.durationSeconds,
      status: createdMatch.status,
      startedAt: createdMatch.startedAt || new Date(),
    };
  }
}
