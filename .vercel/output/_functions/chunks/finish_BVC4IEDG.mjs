import { t as __exportAll } from "./rolldown-runtime_D7D4PA-g.mjs";
import { t as SupabaseMatchRepository } from "./SupabaseMatchRepository_BtLE-yJp.mjs";
import { t as EntityNotFoundError } from "./EntityNotFoundError_3tkUgilL.mjs";
//#region src/core/application/use-cases/FinishMatchUseCase.ts
var FinishMatchUseCase = class {
	matchRepository;
	constructor(matchRepository) {
		this.matchRepository = matchRepository;
	}
	async execute(input) {
		const match = await this.matchRepository.findById(input.matchId);
		if (!match) throw new EntityNotFoundError("Partida", input.matchId);
		if (input.durationSeconds !== void 0) match.updateDuration(input.durationSeconds);
		match.finish(input.reason || "manual");
		const updatedMatch = await this.matchRepository.update(match);
		return {
			id: updatedMatch.id || match.id || input.matchId,
			sessionId: updatedMatch.sessionId,
			homeTeamId: updatedMatch.homeTeamId,
			awayTeamId: updatedMatch.awayTeamId,
			homeScore: updatedMatch.homeScore,
			awayScore: updatedMatch.awayScore,
			durationSeconds: updatedMatch.durationSeconds,
			endReason: updatedMatch.endReason || null,
			status: updatedMatch.status,
			finishedAt: updatedMatch.finishedAt || null
		};
	}
};
//#endregion
//#region src/pages/api/matches/[id]/finish.ts
var finish_exports = /* @__PURE__ */ __exportAll({
	POST: () => POST,
	prerender: () => false
});
var POST = async ({ request, params }) => {
	try {
		const matchId = params.id;
		if (!matchId) return new Response(JSON.stringify({ error: "ID da partida é obrigatório." }), {
			status: 400,
			headers: { "Content-Type": "application/json" }
		});
		const body = await request.json();
		const result = await new FinishMatchUseCase(new SupabaseMatchRepository()).execute({
			matchId,
			durationSeconds: body.durationSeconds,
			reason: body.reason || "manual"
		});
		return new Response(JSON.stringify(result), {
			status: 200,
			headers: { "Content-Type": "application/json" }
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: error.message || "Erro ao finalizar partida." }), {
			status: 400,
			headers: { "Content-Type": "application/json" }
		});
	}
};
//#endregion
//#region \0virtual:astro:page:src/pages/api/matches/[id]/finish@_@ts
var page = () => finish_exports;
//#endregion
export { page };
