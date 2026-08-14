import { t as supabase } from "./supabaseClient_BWZ6C-d6.mjs";
//#region src/core/domain/entities/Team.ts
var Team = class {
	props;
	constructor(props) {
		if (!props.sessionId) throw new Error("ID da sessão é obrigatório.");
		if (!props.name || props.name.trim().length === 0) throw new Error("Nome do time é obrigatório.");
		this.props = {
			...props,
			name: props.name.trim(),
			colorHex: props.colorHex || "#333333",
			players: props.players ? [...props.players] : [],
			createdAt: props.createdAt ?? /* @__PURE__ */ new Date()
		};
	}
	get id() {
		return this.props.id;
	}
	get sessionId() {
		return this.props.sessionId;
	}
	get name() {
		return this.props.name;
	}
	get colorHex() {
		return this.props.colorHex || "#333333";
	}
	get players() {
		return this.props.players ?? [];
	}
	addPlayer(playerId, isLoaned = false) {
		if (!this.props.players) this.props.players = [];
		if (!this.props.players.some((p) => p.playerId === playerId)) this.props.players.push({
			playerId,
			isLoaned
		});
	}
	removePlayer(playerId) {
		if (!this.props.players) return;
		this.props.players = this.props.players.filter((p) => p.playerId !== playerId);
	}
	get state() {
		return this.props;
	}
};
//#endregion
//#region src/core/domain/entities/Session.ts
var Session = class {
	props;
	constructor(props) {
		if (!props.sessionDate || props.sessionDate.trim().length === 0) throw new Error("Data da sessão é obrigatória.");
		this.props = {
			...props,
			sessionDate: props.sessionDate.trim(),
			status: props.status ?? "ongoing",
			notes: props.notes ?? null,
			teams: props.teams ? [...props.teams] : [],
			createdAt: props.createdAt ?? /* @__PURE__ */ new Date()
		};
	}
	get id() {
		return this.props.id;
	}
	get sessionDate() {
		return this.props.sessionDate;
	}
	get status() {
		return this.props.status ?? "ongoing";
	}
	get notes() {
		return this.props.notes;
	}
	get teams() {
		return this.props.teams ?? [];
	}
	get isFinished() {
		return this.props.status === "finished";
	}
	get createdAt() {
		return this.props.createdAt;
	}
	finish() {
		this.props.status = "finished";
	}
	reopen() {
		this.props.status = "ongoing";
	}
	addTeam(team) {
		if (!this.props.teams) this.props.teams = [];
		this.props.teams.push(team);
	}
	get state() {
		return this.props;
	}
};
//#endregion
//#region src/core/infrastructure/repositories/SupabaseSessionRepository.ts
var SupabaseSessionRepository = class {
	client;
	constructor(client) {
		this.client = client || supabase;
	}
	mapTeamToDomain(row) {
		const players = (row.session_team_players || []).map((tp) => ({
			playerId: tp.player_id,
			isLoaned: tp.is_loaned,
			player: tp.players ? {
				name: tp.players.name,
				nickname: tp.players.nickname,
				avatarUrl: tp.players.avatar_url
			} : void 0
		}));
		return new Team({
			id: row.id,
			sessionId: row.session_id,
			name: row.name,
			colorHex: row.color_hex,
			players,
			createdAt: new Date(row.created_at)
		});
	}
	mapSessionToDomain(row) {
		const teams = (row.session_teams || []).map((t) => this.mapTeamToDomain(t));
		return new Session({
			id: row.id,
			sessionDate: row.session_date,
			status: row.status,
			notes: row.notes,
			teams,
			createdAt: new Date(row.created_at)
		});
	}
	async findLatest() {
		const { data, error } = await this.client.from("sessions").select("*, session_teams(*, session_team_players(*, players(name, nickname, avatar_url)))").order("session_date", { ascending: false }).limit(1).maybeSingle();
		if (error) throw new Error(`Erro ao buscar última sessão: ${error.message}`);
		if (!data) return null;
		return this.mapSessionToDomain(data);
	}
	async findById(id) {
		const { data, error } = await this.client.from("sessions").select("*, session_teams(*, session_team_players(*, players(name, nickname, avatar_url)))").eq("id", id).maybeSingle();
		if (error) throw new Error(`Erro ao buscar sessão por ID (${id}): ${error.message}`);
		if (!data) return null;
		return this.mapSessionToDomain(data);
	}
	async findByDate(date) {
		const { data, error } = await this.client.from("sessions").select("*, session_teams(*, session_team_players(*, players(name, nickname, avatar_url)))").eq("session_date", date).maybeSingle();
		if (error) throw new Error(`Erro ao buscar sessão por data (${date}): ${error.message}`);
		if (!data) return null;
		return this.mapSessionToDomain(data);
	}
	async create(session, teams) {
		const { data: sessionData, error: sessionError } = await this.client.from("sessions").insert({
			session_date: session.sessionDate,
			status: session.status,
			notes: session.notes || null
		}).select("*").single();
		if (sessionError) throw new Error(`Erro ao criar sessão: ${sessionError.message}`);
		const createdSessionId = sessionData.id;
		const createdTeams = [];
		if (teams && teams.length > 0) for (const teamInput of teams) {
			const { data: teamData, error: teamError } = await this.client.from("session_teams").insert({
				session_id: createdSessionId,
				name: teamInput.name,
				color_hex: teamInput.colorHex || "#333333"
			}).select("*").single();
			if (teamError) throw new Error(`Erro ao criar time '${teamInput.name}': ${teamError.message}`);
			const teamPlayers = [];
			if (teamInput.playerIds && teamInput.playerIds.length > 0) {
				const playerRows = teamInput.playerIds.map((playerId) => ({
					session_team_id: teamData.id,
					player_id: playerId,
					is_loaned: false
				}));
				const { error: playersError } = await this.client.from("session_team_players").insert(playerRows);
				if (playersError) throw new Error(`Erro ao vincular jogadores ao time '${teamInput.name}': ${playersError.message}`);
				teamPlayers.push(...teamInput.playerIds.map((pid) => ({
					playerId: pid,
					isLoaned: false
				})));
			}
			createdTeams.push(new Team({
				id: teamData.id,
				sessionId: createdSessionId,
				name: teamData.name,
				colorHex: teamData.color_hex,
				players: teamPlayers,
				createdAt: new Date(teamData.created_at)
			}));
		}
		return new Session({
			id: createdSessionId,
			sessionDate: sessionData.session_date,
			status: sessionData.status,
			notes: sessionData.notes,
			teams: createdTeams,
			createdAt: new Date(sessionData.created_at)
		});
	}
	async updateStatus(id, status) {
		const { error } = await this.client.from("sessions").update({ status }).eq("id", id);
		if (error) throw new Error(`Erro ao atualizar status da sessão (${id}): ${error.message}`);
	}
	async getTeamsBySessionId(sessionId) {
		const { data, error } = await this.client.from("session_teams").select("*, session_team_players(*, players(name, nickname, avatar_url))").eq("session_id", sessionId);
		if (error) throw new Error(`Erro ao buscar times da sessão (${sessionId}): ${error.message}`);
		return (data || []).map((row) => this.mapTeamToDomain(row));
	}
	async addPlayerToTeam(teamId, playerId, isLoaned = false) {
		const { error } = await this.client.from("session_team_players").upsert({
			session_team_id: teamId,
			player_id: playerId,
			is_loaned: isLoaned
		}, { onConflict: "session_team_id,player_id" });
		if (error) throw new Error(`Erro ao adicionar jogador ao time: ${error.message}`);
	}
	async removePlayerFromTeam(teamId, playerId) {
		const { error } = await this.client.from("session_team_players").delete().eq("session_team_id", teamId).eq("player_id", playerId);
		if (error) throw new Error(`Erro ao remover jogador do time: ${error.message}`);
	}
	async transferPlayer(fromTeamId, toTeamId, playerId, isLoaned = false) {
		await this.removePlayerFromTeam(fromTeamId, playerId);
		await this.addPlayerToTeam(toTeamId, playerId, isLoaned);
	}
};
//#endregion
export { Session as n, SupabaseSessionRepository as t };
