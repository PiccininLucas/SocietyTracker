import { t as __exportAll } from "./rolldown-runtime_D7D4PA-g.mjs";
import { n as Player, t as SupabasePlayerRepository } from "./SupabasePlayerRepository_D8jIBsmt.mjs";
//#region src/core/application/use-cases/CreatePlayerUseCase.ts
var CreatePlayerUseCase = class {
	playerRepository;
	constructor(playerRepository) {
		this.playerRepository = playerRepository;
	}
	async execute(input) {
		if (!input.name || input.name.trim() === "") throw new Error("Nome do jogador é obrigatório.");
		const player = new Player({
			name: input.name.trim(),
			nickname: input.nickname?.trim() || null,
			avatarUrl: input.avatarUrl || null,
			isActive: input.isActive ?? true
		});
		const created = await this.playerRepository.create(player);
		return {
			id: created.id || "",
			name: created.name,
			nickname: created.nickname || null,
			avatarUrl: created.avatarUrl || null,
			isActive: created.isActive,
			createdAt: created.createdAt || /* @__PURE__ */ new Date()
		};
	}
};
//#endregion
//#region src/pages/api/players/index.ts
var players_exports = /* @__PURE__ */ __exportAll({
	GET: () => GET,
	POST: () => POST,
	prerender: () => false
});
var GET = async () => {
	try {
		const payload = (await new SupabasePlayerRepository().findAll(true)).map((p) => ({
			id: p.id,
			name: p.name,
			nickname: p.nickname,
			displayName: p.displayName,
			avatarUrl: p.avatarUrl,
			isActive: p.isActive
		}));
		return new Response(JSON.stringify(payload), {
			status: 200,
			headers: { "Content-Type": "application/json" }
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: error.message || "Erro ao listar jogadores." }), {
			status: 500,
			headers: { "Content-Type": "application/json" }
		});
	}
};
var POST = async ({ request }) => {
	try {
		const body = await request.json();
		const result = await new CreatePlayerUseCase(new SupabasePlayerRepository()).execute({
			name: body.name,
			nickname: body.nickname,
			avatarUrl: body.avatarUrl,
			isActive: body.isActive ?? true
		});
		return new Response(JSON.stringify(result), {
			status: 201,
			headers: { "Content-Type": "application/json" }
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: error.message || "Erro ao cadastrar jogador." }), {
			status: 400,
			headers: { "Content-Type": "application/json" }
		});
	}
};
//#endregion
//#region \0virtual:astro:page:src/pages/api/players/index@_@ts
var page = () => players_exports;
//#endregion
export { page };
