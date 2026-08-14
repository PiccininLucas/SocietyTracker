import { t as __exportAll } from "./rolldown-runtime_D7D4PA-g.mjs";
import { t as SupabaseMatchRepository } from "./SupabaseMatchRepository_BtLE-yJp.mjs";
import { t as GetLeaderboardUseCase } from "./GetLeaderboardUseCase_CU9_dacI.mjs";
//#region src/pages/api/leaderboard/index.ts
var leaderboard_exports = /* @__PURE__ */ __exportAll({
	GET: () => GET,
	prerender: () => false
});
var GET = async () => {
	try {
		const matchRepo = new SupabaseMatchRepository();
		const leaderboard = await new GetLeaderboardUseCase(matchRepo).execute();
		return new Response(JSON.stringify(leaderboard), {
			status: 200,
			headers: { "Content-Type": "application/json" }
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: error.message || "Erro ao buscar classificação." }), {
			status: 500,
			headers: { "Content-Type": "application/json" }
		});
	}
};
//#endregion
//#region \0virtual:astro:page:src/pages/api/leaderboard/index@_@ts
var page = () => leaderboard_exports;
//#endregion
export { page };
