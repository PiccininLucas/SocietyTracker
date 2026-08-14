import { t as supabase } from "./supabaseClient_BrqKuFUM.mjs";
//#region src/core/domain/errors/DomainError.ts
var DomainError = class extends Error {
	constructor(message) {
		super(message);
		this.name = "DomainError";
	}
};
//#endregion
//#region src/core/domain/errors/MatchAlreadyFinishedError.ts
var MatchAlreadyFinishedError = class extends DomainError {
	constructor(message = "A partida já foi encerrada.") {
		super(message);
		this.name = "MatchAlreadyFinishedError";
	}
};
//#endregion
//#region src/core/domain/entities/Match.ts
var MATCH_RULES = {
	MAX_GOALS_FOR_VICTORY: 2,
	MAX_DURATION_SECONDS: 420
};
var Match = class {
	props;
	constructor(props) {
		if (!props.sessionId) throw new Error("ID da sessão é obrigatório.");
		if (!props.homeTeamId || !props.awayTeamId) throw new Error("Times mandante e visitante são obrigatórios.");
		if (props.homeTeamId === props.awayTeamId) throw new Error("O time mandante e visitante não podem ser o mesmo.");
		this.props = {
			...props,
			homeScore: props.homeScore ?? 0,
			awayScore: props.awayScore ?? 0,
			durationSeconds: props.durationSeconds ?? 0,
			endReason: props.endReason ?? null,
			status: props.status ?? "ongoing",
			startedAt: props.startedAt ?? /* @__PURE__ */ new Date(),
			finishedAt: props.finishedAt ?? null
		};
	}
	get id() {
		return this.props.id;
	}
	get sessionId() {
		return this.props.sessionId;
	}
	get homeTeamId() {
		return this.props.homeTeamId;
	}
	get awayTeamId() {
		return this.props.awayTeamId;
	}
	get homeScore() {
		return this.props.homeScore ?? 0;
	}
	get awayScore() {
		return this.props.awayScore ?? 0;
	}
	get durationSeconds() {
		return this.props.durationSeconds ?? 0;
	}
	get endReason() {
		return this.props.endReason;
	}
	get status() {
		return this.props.status ?? "ongoing";
	}
	get isFinished() {
		return this.props.status === "finished";
	}
	get startedAt() {
		return this.props.startedAt;
	}
	get finishedAt() {
		return this.props.finishedAt;
	}
	registerGoal(teamId, currentDurationSeconds) {
		if (this.isFinished) throw new MatchAlreadyFinishedError("Partida já encerrada.");
		if (currentDurationSeconds !== void 0) {
			this.updateDuration(currentDurationSeconds);
			if (this.isFinished) return {
				finished: true,
				reason: this.props.endReason || "time_limit"
			};
		}
		if (teamId === this.props.homeTeamId) this.props.homeScore = (this.props.homeScore ?? 0) + 1;
		else if (teamId === this.props.awayTeamId) this.props.awayScore = (this.props.awayScore ?? 0) + 1;
		else throw new Error("Time informado não pertence a esta partida.");
		if ((this.props.homeScore ?? 0) >= MATCH_RULES.MAX_GOALS_FOR_VICTORY || (this.props.awayScore ?? 0) >= MATCH_RULES.MAX_GOALS_FOR_VICTORY) {
			this.finish("two_goals");
			return {
				finished: true,
				reason: "two_goals"
			};
		}
		return { finished: false };
	}
	updateDuration(seconds) {
		if (this.isFinished) return;
		this.props.durationSeconds = seconds;
		if (seconds >= MATCH_RULES.MAX_DURATION_SECONDS) this.finish("time_limit");
	}
	handleTimeExpired() {
		if (!this.isFinished) {
			this.props.durationSeconds = MATCH_RULES.MAX_DURATION_SECONDS;
			this.finish("time_limit");
		}
	}
	finish(reason = "manual") {
		if (this.isFinished) return;
		this.props.status = "finished";
		this.props.endReason = reason;
		this.props.finishedAt = /* @__PURE__ */ new Date();
	}
	get state() {
		return this.props;
	}
};
//#endregion
//#region src/core/domain/errors/InvalidGoalEventError.ts
var InvalidGoalEventError = class extends DomainError {
	constructor(message = "Dados inválidos para o evento de gol.") {
		super(message);
		this.name = "InvalidGoalEventError";
	}
};
//#endregion
//#region src/core/domain/entities/MatchEvent.ts
var MatchEvent = class {
	props;
	constructor(props) {
		if (!props.matchId) throw new Error("ID da partida é obrigatório.");
		if (!props.teamId) throw new Error("ID do time é obrigatório.");
		const isOwnGoal = props.isOwnGoal ?? false;
		if (!isOwnGoal && !props.scorerId) throw new InvalidGoalEventError("Gol normal exige a identificação do autor do gol (scorerId).");
		if (isOwnGoal && props.assistId) throw new InvalidGoalEventError("Gol contra não pode ter assistência.");
		if (props.scorerId && props.assistId && props.scorerId === props.assistId) throw new InvalidGoalEventError("O autor do gol não pode ser o mesmo da assistência.");
		this.props = {
			...props,
			scorerId: props.scorerId ?? null,
			assistId: props.assistId ?? null,
			eventTimeSeconds: props.eventTimeSeconds ?? 0,
			isOwnGoal,
			createdAt: props.createdAt ?? /* @__PURE__ */ new Date()
		};
	}
	get id() {
		return this.props.id;
	}
	get matchId() {
		return this.props.matchId;
	}
	get teamId() {
		return this.props.teamId;
	}
	get scorerId() {
		return this.props.scorerId;
	}
	get assistId() {
		return this.props.assistId;
	}
	get eventTimeSeconds() {
		return this.props.eventTimeSeconds ?? 0;
	}
	get isOwnGoal() {
		return !!this.props.isOwnGoal;
	}
	get createdAt() {
		return this.props.createdAt;
	}
	get state() {
		return this.props;
	}
};
//#endregion
//#region src/core/infrastructure/repositories/SupabaseMatchRepository.ts
var SupabaseMatchRepository = class {
	client;
	constructor(client) {
		this.client = client || supabase;
	}
	mapMatchToDomain(row) {
		return new Match({
			id: row.id,
			sessionId: row.session_id,
			homeTeamId: row.home_team_id,
			awayTeamId: row.away_team_id,
			homeScore: row.home_score,
			awayScore: row.away_score,
			durationSeconds: row.duration_seconds,
			endReason: row.end_reason,
			status: row.status,
			startedAt: new Date(row.started_at),
			finishedAt: row.finished_at ? new Date(row.finished_at) : null
		});
	}
	mapEventToDomain(row) {
		return new MatchEvent({
			id: row.id,
			matchId: row.match_id,
			teamId: row.team_id,
			scorerId: row.scorer_id,
			assistId: row.assist_id,
			eventTimeSeconds: row.event_time_seconds,
			isOwnGoal: row.is_own_goal,
			createdAt: new Date(row.created_at)
		});
	}
	async findById(id) {
		const { data, error } = await this.client.from("matches").select("*").eq("id", id).maybeSingle();
		if (error) throw new Error(`Erro ao buscar partida por ID (${id}): ${error.message}`);
		if (!data) return null;
		return this.mapMatchToDomain(data);
	}
	async findBySessionId(sessionId) {
		const { data, error } = await this.client.from("matches").select("*").eq("session_id", sessionId).order("started_at", { ascending: true });
		if (error) throw new Error(`Erro ao buscar partidas da sessão (${sessionId}): ${error.message}`);
		return (data || []).map((row) => this.mapMatchToDomain(row));
	}
	async findActiveMatch(sessionId) {
		const { data, error } = await this.client.from("matches").select("*").eq("session_id", sessionId).eq("status", "ongoing").order("started_at", { ascending: false }).limit(1).maybeSingle();
		if (error) throw new Error(`Erro ao buscar partida ativa: ${error.message}`);
		if (!data) return null;
		return this.mapMatchToDomain(data);
	}
	async create(match) {
		const { data, error } = await this.client.from("matches").insert({
			session_id: match.sessionId,
			home_team_id: match.homeTeamId,
			away_team_id: match.awayTeamId,
			home_score: match.homeScore,
			away_score: match.awayScore,
			duration_seconds: match.durationSeconds,
			end_reason: match.endReason || null,
			status: match.status,
			started_at: match.startedAt ? match.startedAt.toISOString() : (/* @__PURE__ */ new Date()).toISOString(),
			finished_at: match.finishedAt ? match.finishedAt.toISOString() : null
		}).select("*").single();
		if (error) throw new Error(`Erro ao criar partida: ${error.message}`);
		return this.mapMatchToDomain(data);
	}
	async update(match) {
		if (!match.id) throw new Error("ID da partida é obrigatório para atualização.");
		const { data, error } = await this.client.from("matches").update({
			home_score: match.homeScore,
			away_score: match.awayScore,
			duration_seconds: match.durationSeconds,
			end_reason: match.endReason || null,
			status: match.status,
			finished_at: match.finishedAt ? match.finishedAt.toISOString() : null
		}).eq("id", match.id).select("*").single();
		if (error) throw new Error(`Erro ao atualizar partida (${match.id}): ${error.message}`);
		return this.mapMatchToDomain(data);
	}
	async addEvent(event) {
		const { data, error } = await this.client.from("match_events").insert({
			match_id: event.matchId,
			team_id: event.teamId,
			scorer_id: event.scorerId || null,
			assist_id: event.assistId || null,
			event_time_seconds: event.eventTimeSeconds,
			is_own_goal: event.isOwnGoal
		}).select("*").single();
		if (error) throw new Error(`Erro ao registrar evento de jogo: ${error.message}`);
		return this.mapEventToDomain(data);
	}
	async getEventsByMatchId(matchId) {
		const { data, error } = await this.client.from("match_events").select("*").eq("match_id", matchId).order("event_time_seconds", { ascending: true });
		if (error) throw new Error(`Erro ao buscar eventos da partida (${matchId}): ${error.message}`);
		return (data || []).map((row) => this.mapEventToDomain(row));
	}
	async getLeaderboard() {
		const { data, error } = await this.client.from("vw_player_leaderboard").select("*");
		if (error) throw new Error(`Erro ao buscar classificação: ${error.message}`);
		return (data || []).map((row) => ({
			playerId: row.player_id,
			name: row.name,
			nickname: row.nickname,
			avatarUrl: row.avatar_url,
			totalGoals: row.total_goals,
			totalAssists: row.total_assists,
			totalContributions: row.total_contributions,
			totalSessionsPlayed: row.total_sessions_played
		}));
	}
	async getMatchesSummary(sessionId) {
		let query = this.client.from("vw_matches_summary").select("*");
		if (sessionId) query = query.eq("session_id", sessionId);
		const { data, error } = await query;
		if (error) throw new Error(`Erro ao buscar resumo das partidas: ${error.message}`);
		return (data || []).map((row) => ({
			matchId: row.match_id,
			sessionId: row.session_id,
			sessionDate: row.session_date,
			homeTeamName: row.home_team_name,
			homeTeamColor: row.home_team_color,
			homeScore: row.home_score,
			awayTeamName: row.away_team_name,
			awayTeamColor: row.away_team_color,
			awayScore: row.away_score,
			durationSeconds: row.duration_seconds,
			endReason: row.end_reason,
			status: row.status,
			startedAt: row.started_at,
			finishedAt: row.finished_at
		}));
	}
};
//#endregion
export { DomainError as i, MatchEvent as n, Match as r, SupabaseMatchRepository as t };
