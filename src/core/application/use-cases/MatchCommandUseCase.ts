import type {
  IMatchCommands,
  MatchCommand,
  MatchCommandResult,
} from '../../domain/repositories/IMatchCommands';
export class MatchCommandUseCase {
  constructor(private readonly repository: IMatchCommands) {}
  execute(command: MatchCommand): Promise<MatchCommandResult> {
    if (!command.operationId) throw new Error('Identificador da operação obrigatório.');
    if (command.action !== 'start' && !command.matchId) throw new Error('Partida obrigatória.');
    return this.repository.executeCommand(command);
  }
}
