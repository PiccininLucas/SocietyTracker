import { t as __exportAll } from "./rolldown-runtime_D7D4PA-g.mjs";
import { r as Match, t as SupabaseMatchRepository } from "./SupabaseMatchRepository_BVgvsesk.mjs";
//#region src/core/application/use-cases/StartMatchUseCase.ts
var StartMatchUseCase = class {
	matchRepository;
	constructor(matchRepository) {
		this.matchRepository = matchRepository;
	}
	async execute(input) {
		if (!input.sessionId) throw new Error("ID da sessão é obrigatório.");
		if (!input.homeTeamId || !input.awayTeamId) throw new Error("Times mandante e visitante são obrigatórios.");
		if (input.homeTeamId === input.awayTeamId) throw new Error("Os dois times selecionados devem ser diferentes.");
		const match = new Match({
			sessionId: input.sessionId,
			homeTeamId: input.homeTeamId,
			awayTeamId: input.awayTeamId,
			homeScore: 0,
			awayScore: 0,
			durationSeconds: 0,
			status: "ongoing",
			startedAt: /* @__PURE__ */ new Date()
		});
		const createdMatch = await this.matchRepository.create(match);
		return {
			id: createdMatch.id || "",
			sessionId: createdMatch.sessionId,
			homeTeamId: createdMatch.homeTeamId,
			awayTeamId: createdMatch.awayTeamId,
			homeScore: createdMatch.homeScore,
			awayScore: createdMatch.awayScore,
			durationSeconds: createdMatch.durationSeconds,
			status: createdMatch.status,
			startedAt: createdMatch.startedAt || /* @__PURE__ */ new Date()
		};
	}
};
//#endregion
//#region src/pages/api/matches/start.ts
var start_exports = /* @__PURE__ */ __exportAll({
	POST: () => POST,
	prerender: () => false
});
var POST = async ({ request }) => {
	try {
		const body = await request.json();
		const result = await new StartMatchUseCase(new SupabaseMatchRepository()).execute({
			sessionId: body.sessionId,
			homeTeamId: body.homeTeamId,
			awayTeamId: body.awayTeamId
		});
		return new Response(JSON.stringify(result), {
			status: 201,
			headers: { "Content-Type": "application/json" }
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: error.message || "Erro ao iniciar partida." }), {
			status: 400,
			headers: { "Content-Type": "application/json" }
		});
	}
};
//#endregion
//#region \0virtual:astro:page:src/pages/api/matches/start@_@ts
var page = () => start_exports;
//#endregion
export { page };
