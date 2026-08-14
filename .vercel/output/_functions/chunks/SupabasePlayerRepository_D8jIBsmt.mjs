import { t as supabase } from "./supabaseClient_BrqKuFUM.mjs";
//#region src/core/domain/entities/Player.ts
var Player = class {
	props;
	constructor(props) {
		if (!props.name || props.name.trim().length === 0) throw new Error("Nome do jogador é obrigatório.");
		this.props = {
			...props,
			name: props.name.trim(),
			nickname: props.nickname ? props.nickname.trim() : null,
			avatarUrl: props.avatarUrl || null,
			isActive: props.isActive ?? true,
			createdAt: props.createdAt ?? /* @__PURE__ */ new Date()
		};
	}
	get id() {
		return this.props.id;
	}
	get name() {
		return this.props.name;
	}
	get nickname() {
		return this.props.nickname;
	}
	get displayName() {
		return this.props.nickname || this.props.name;
	}
	get avatarUrl() {
		return this.props.avatarUrl;
	}
	get isActive() {
		return !!this.props.isActive;
	}
	get createdAt() {
		return this.props.createdAt;
	}
	get state() {
		return this.props;
	}
};
//#endregion
//#region src/core/infrastructure/repositories/SupabasePlayerRepository.ts
var SupabasePlayerRepository = class {
	client;
	constructor(client) {
		this.client = client || supabase;
	}
	toDomain(row) {
		return new Player({
			id: row.id,
			name: row.name,
			nickname: row.nickname,
			avatarUrl: row.avatar_url,
			isActive: row.is_active,
			createdAt: new Date(row.created_at)
		});
	}
	async findAll(activeOnly = false) {
		let query = this.client.from("players").select("*").order("name");
		if (activeOnly) query = query.eq("is_active", true);
		const { data, error } = await query;
		if (error) throw new Error(`Erro ao buscar jogadores: ${error.message}`);
		return (data || []).map((row) => this.toDomain(row));
	}
	async findById(id) {
		const { data, error } = await this.client.from("players").select("*").eq("id", id).maybeSingle();
		if (error) throw new Error(`Erro ao buscar jogador por ID (${id}): ${error.message}`);
		if (!data) return null;
		return this.toDomain(data);
	}
	async create(player) {
		const { data, error } = await this.client.from("players").insert({
			name: player.name,
			nickname: player.nickname || null,
			avatar_url: player.avatarUrl || null,
			is_active: player.isActive
		}).select("*").single();
		if (error) throw new Error(`Erro ao criar jogador: ${error.message}`);
		return this.toDomain(data);
	}
	async update(player) {
		if (!player.id) throw new Error("ID do jogador é obrigatório para atualização.");
		const { data, error } = await this.client.from("players").update({
			name: player.name,
			nickname: player.nickname || null,
			avatar_url: player.avatarUrl || null,
			is_active: player.isActive
		}).eq("id", player.id).select("*").single();
		if (error) throw new Error(`Erro ao atualizar jogador (${player.id}): ${error.message}`);
		return this.toDomain(data);
	}
};
//#endregion
export { Player as n, SupabasePlayerRepository as t };
