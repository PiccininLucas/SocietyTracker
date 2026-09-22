import type {
  IMatchCommands,
  MatchCommand,
  MatchCommandResult,
} from '../../domain/repositories/IMatchCommands';
import { DomainError } from '../../domain/errors/DomainError';
export class MatchCommandUseCase {
  constructor(private readonly repository: IMatchCommands) {}
  execute(command: MatchCommand): Promise<MatchCommandResult> {
    if (!command.operationId) throw new DomainError('Identificador da operação obrigatório.');
    if (command.action !== 'start' && !command.matchId) throw new DomainError('Partida obrigatória.');
    return this.repository.executeCommand(command);
  }
}
