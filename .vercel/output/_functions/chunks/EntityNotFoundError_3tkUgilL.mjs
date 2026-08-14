import { i as DomainError } from "./SupabaseMatchRepository_BtLE-yJp.mjs";
//#region src/core/domain/errors/EntityNotFoundError.ts
var EntityNotFoundError = class extends DomainError {
	constructor(entityName, id) {
		super(id ? `${entityName} com ID '${id}' não foi encontrado(a).` : `${entityName} não encontrado(a).`);
		this.name = "EntityNotFoundError";
	}
};
//#endregion
export { EntityNotFoundError as t };
