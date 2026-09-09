import type { MatchSummary } from './IMatchRepository';
export type MatchAction = 'start' | 'goal' | 'edit' | 'delete' | 'score' | 'finish' | 'remove_match';
export interface MatchCommand {
  action: MatchAction;
  matchId?: string;
  operationId: string;
  input: Record<string, unknown>;
}
export interface MatchCommandResult {
  match: MatchSummary;
  eventId?: string;
}
export interface IMatchCommands {
  executeCommand(command: MatchCommand): Promise<MatchCommandResult>;
}
