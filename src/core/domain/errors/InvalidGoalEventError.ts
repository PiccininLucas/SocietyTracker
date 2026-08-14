import { DomainError } from './DomainError';

export class InvalidGoalEventError extends DomainError {
  constructor(message = 'Dados inválidos para o evento de gol.') {
    super(message);
    this.name = 'InvalidGoalEventError';
  }
}
