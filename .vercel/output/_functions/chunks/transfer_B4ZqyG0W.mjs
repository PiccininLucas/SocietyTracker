import { t as __exportAll } from "./rolldown-runtime_D7D4PA-g.mjs";
import { t as SupabaseSessionRepository } from "./SupabaseSessionRepository_BnUMdPCy.mjs";
//#region src/core/application/use-cases/TransferPlayerUseCase.ts
var TransferPlayerUseCase = class {
	sessionRepository;
	constructor(sessionRepository) {
		this.sessionRepository = sessionRepository;
	}
	async execute(input) {
		if (!input.fromTeamId || !input.toTeamId || !input.playerId) throw new Error("IDs do time de origem, time de destino e jogador são obrigatórios.");
		if (input.fromTeamId === input.toTeamId) throw new Error("Time de origem e destino devem ser diferentes.");
		await this.sessionRepository.transferPlayer(input.fromTeamId, input.toTeamId, input.playerId, input.isLoaned ?? false);
		return {
			success: true,
			message: "Jogador transferido com sucesso.",
			playerId: input.playerId,
			fromTeamId: input.fromTeamId,
			toTeamId: input.toTeamId,
			isLoaned: input.isLoaned ?? false
		};
	}
};
//#endregion
//#region src/pages/api/sessions/[id]/transfer.ts
var transfer_exports = /* @__PURE__ */ __exportAll({
	POST: () => POST,
	prerender: () => false
});
var POST = async ({ request, params }) => {
	try {
		const sessionId = params.id;
		const body = await request.json();
		const result = await new TransferPlayerUseCase(new SupabaseSessionRepository()).execute({
			sessionId,
			fromTeamId: body.fromTeamId,
			toTeamId: body.toTeamId,
			playerId: body.playerId,
			isLoaned: body.isLoaned
		});
		return new Response(JSON.stringify(result), {
			status: 200,
			headers: { "Content-Type": "application/json" }
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: error.message || "Erro ao transferir jogador." }), {
			status: 400,
			headers: { "Content-Type": "application/json" }
		});
	}
};
//#endregion
//#region \0virtual:astro:page:src/pages/api/sessions/[id]/transfer@_@ts
var page = () => transfer_exports;
//#endregion
export { page };
