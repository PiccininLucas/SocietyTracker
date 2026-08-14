import { t as __exportAll } from "./rolldown-runtime_D7D4PA-g.mjs";
import { n as Session, t as SupabaseSessionRepository } from "./SupabaseSessionRepository_BnUMdPCy.mjs";
//#region src/core/application/use-cases/CreateSessionUseCase.ts
var CreateSessionUseCase = class {
	sessionRepository;
	constructor(sessionRepository) {
		this.sessionRepository = sessionRepository;
	}
	async execute(input) {
		if (!input.sessionDate || input.sessionDate.trim() === "") throw new Error("Data da rodada é obrigatória.");
		const session = new Session({
			sessionDate: input.sessionDate.trim(),
			status: "ongoing",
			notes: input.notes?.trim() || null
		});
		const created = await this.sessionRepository.create(session, input.teams);
		return {
			id: created.id || "",
			sessionDate: created.sessionDate,
			status: created.status,
			notes: created.notes || null,
			teams: created.teams.map((t) => ({
				id: t.id || "",
				sessionId: t.sessionId,
				name: t.name,
				colorHex: t.colorHex,
				playersCount: t.players.length
			})),
			createdAt: created.createdAt || /* @__PURE__ */ new Date()
		};
	}
};
//#endregion
//#region src/pages/api/sessions/index.ts
var sessions_exports = /* @__PURE__ */ __exportAll({
	GET: () => GET,
	POST: () => POST,
	prerender: () => false
});
var GET = async ({ url }) => {
	try {
		const sessionRepo = new SupabaseSessionRepository();
		const id = url.searchParams.get("id");
		const date = url.searchParams.get("date");
		let session = null;
		if (id) session = await sessionRepo.findById(id);
		else if (date) session = await sessionRepo.findByDate(date);
		else session = await sessionRepo.findLatest();
		if (!session) return new Response(JSON.stringify({ error: "Nenhuma sessão encontrada." }), {
			status: 404,
			headers: { "Content-Type": "application/json" }
		});
		const payload = {
			id: session.id,
			sessionDate: session.sessionDate,
			status: session.status,
			notes: session.notes,
			teams: session.teams.map((t) => ({
				id: t.id,
				sessionId: t.sessionId,
				name: t.name,
				colorHex: t.colorHex,
				players: t.players.map((tp) => ({
					id: tp.playerId,
					name: tp.player?.name || "Jogador",
					nickname: tp.player?.nickname || null,
					avatarUrl: tp.player?.avatarUrl || null,
					isLoaned: tp.isLoaned
				}))
			})),
			createdAt: session.state.createdAt
		};
		return new Response(JSON.stringify(payload), {
			status: 200,
			headers: { "Content-Type": "application/json" }
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: error.message || "Erro ao consultar sessão." }), {
			status: 500,
			headers: { "Content-Type": "application/json" }
		});
	}
};
var POST = async ({ request }) => {
	try {
		const body = await request.json();
		const result = await new CreateSessionUseCase(new SupabaseSessionRepository()).execute({
			sessionDate: body.sessionDate,
			notes: body.notes,
			teams: body.teams
		});
		return new Response(JSON.stringify(result), {
			status: 201,
			headers: { "Content-Type": "application/json" }
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: error.message || "Erro ao criar sessão." }), {
			status: 400,
			headers: { "Content-Type": "application/json" }
		});
	}
};
//#endregion
//#region \0virtual:astro:page:src/pages/api/sessions/index@_@ts
var page = () => sessions_exports;
//#endregion
export { page };
