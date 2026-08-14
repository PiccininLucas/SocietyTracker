import { DomainError } from './DomainError';

export class EntityNotFoundError extends DomainError {
  constructor(entityName: string, id?: string) {
    super(id ? `${entityName} com ID '${id}' não foi encontrado(a).` : `${entityName} não encontrado(a).`);
    this.name = 'EntityNotFoundError';
  }
}
