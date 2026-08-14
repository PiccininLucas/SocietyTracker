import { t as __exportAll } from "./rolldown-runtime_D7D4PA-g.mjs";
import { n as MatchEvent, t as SupabaseMatchRepository } from "./SupabaseMatchRepository_BtLE-yJp.mjs";
import { t as EntityNotFoundError } from "./EntityNotFoundError_3tkUgilL.mjs";
//#region src/core/application/use-cases/RegisterGoalUseCase.ts
var RegisterGoalUseCase = class {
	matchRepository;
	constructor(matchRepository) {
		this.matchRepository = matchRepository;
	}
	async execute(input) {
		const match = await this.matchRepository.findById(input.matchId);
		if (!match) throw new EntityNotFoundError("Partida", input.matchId);
		if (match.homeTeamId !== input.teamId && match.awayTeamId !== input.teamId) throw new Error("O time informado não pertence a esta partida.");
		const event = new MatchEvent({
			matchId: input.matchId,
			teamId: input.teamId,
			scorerId: input.scorerId,
			assistId: input.assistId,
			eventTimeSeconds: input.eventTimeSeconds ?? match.durationSeconds,
			isOwnGoal: input.isOwnGoal ?? false
		});
		match.registerGoal(input.teamId, input.eventTimeSeconds);
		const savedEvent = await this.matchRepository.addEvent(event);
		const updatedMatch = await this.matchRepository.update(match);
		return {
			match: {
				id: updatedMatch.id || match.id || input.matchId,
				sessionId: updatedMatch.sessionId,
				homeTeamId: updatedMatch.homeTeamId,
				awayTeamId: updatedMatch.awayTeamId,
				homeScore: updatedMatch.homeScore,
				awayScore: updatedMatch.awayScore,
				durationSeconds: updatedMatch.durationSeconds,
				endReason: updatedMatch.endReason,
				status: updatedMatch.status,
				isFinished: updatedMatch.isFinished
			},
			event: {
				id: savedEvent.id,
				matchId: savedEvent.matchId,
				teamId: savedEvent.teamId,
				scorerId: savedEvent.scorerId,
				assistId: savedEvent.assistId,
				eventTimeSeconds: savedEvent.eventTimeSeconds,
				isOwnGoal: savedEvent.isOwnGoal
			},
			isMatchFinished: updatedMatch.isFinished,
			matchEndReason: updatedMatch.endReason
		};
	}
};
//#endregion
//#region src/pages/api/matches/[id]/goals.ts
var goals_exports = /* @__PURE__ */ __exportAll({
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
		const result = await new RegisterGoalUseCase(new SupabaseMatchRepository()).execute({
			matchId,
			teamId: body.teamId,
			scorerId: body.scorerId || null,
			assistId: body.assistId || null,
			eventTimeSeconds: body.eventTimeSeconds,
			isOwnGoal: body.isOwnGoal ?? false
		});
		return new Response(JSON.stringify(result), {
			status: 200,
			headers: { "Content-Type": "application/json" }
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: error.message || "Erro ao registrar gol." }), {
			status: 400,
			headers: { "Content-Type": "application/json" }
		});
	}
};
//#endregion
//#region \0virtual:astro:page:src/pages/api/matches/[id]/goals@_@ts
var page = () => goals_exports;
//#endregion
export { page };
