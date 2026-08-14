import { DomainError } from './DomainError';

export class MatchAlreadyFinishedError extends DomainError {
  constructor(message = 'A partida já foi encerrada.') {
    super(message);
    this.name = 'MatchAlreadyFinishedError';
  }
}
