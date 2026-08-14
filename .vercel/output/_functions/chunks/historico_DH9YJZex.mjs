import { t as __exportAll } from "./rolldown-runtime_D7D4PA-g.mjs";
import { C as createAstro, g as addAttribute, i as renderComponent, m as maybeRenderHead, u as renderTemplate } from "./server_DNJHvdY8.mjs";
import { t as createComponent } from "./compiler_Cige1B-f.mjs";
import { t as SupabaseMatchRepository } from "./SupabaseMatchRepository_BVgvsesk.mjs";
import { t as $$Layout } from "./Layout_7_u9jphL.mjs";
//#region src/components/ui/MatchHistoryCard.astro
createAstro("https://astro.build");
var $$MatchHistoryCard = createComponent(($$result, $$props, $$slots) => {
	const Astro = $$result.createAstro($$props, $$slots);
	Astro.self = $$MatchHistoryCard;
	const { match } = Astro.props;
	const isHomeWinner = match.homeScore > match.awayScore;
	const isAwayWinner = match.awayScore > match.homeScore;
	match.homeScore, match.awayScore;
	const formatMinutes = (seconds) => {
		return `${Math.floor(seconds / 60)}m ${(seconds % 60).toString().padStart(2, "0")}s`;
	};
	const formatTime = (isoString) => {
		try {
			return new Date(isoString).toLocaleTimeString("pt-BR", {
				hour: "2-digit",
				minute: "2-digit"
			});
		} catch {
			return "";
		}
	};
	return renderTemplate`${maybeRenderHead($$result)}<div class="rounded-3xl glass-card border border-white/10 p-5 bg-surface-100/90 shadow-lg hover:border-white/20 transition-all"><!-- Top Bar: Status, End Reason & Horário --><div class="flex items-center justify-between gap-2 mb-4"><div class="flex items-center gap-2">${match.endReason === "two_goals" ? renderTemplate`<span class="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-black uppercase tracking-wider flex items-center gap-1"><span>⚡</span><span>Regra dos 2 Gols</span></span>` : match.endReason === "time_limit" ? renderTemplate`<span class="px-2.5 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 text-[11px] font-black uppercase tracking-wider flex items-center gap-1"><span>⏱</span><span>Tempo Oficial (7 min)</span></span>` : renderTemplate`<span class="px-2.5 py-0.5 rounded-full bg-gray-500/15 border border-gray-500/30 text-gray-400 text-[11px] font-black uppercase tracking-wider">Partida Concluída</span>`}</div><div class="text-[11px] text-gray-400 font-semibold flex items-center gap-1.5"><span>⏱ ${formatMinutes(match.durationSeconds)}</span>${match.startedAt && renderTemplate`<span>• ${formatTime(match.startedAt)}</span>`}</div></div><!-- Placar Central dos 2 Times --><div class="grid grid-cols-7 items-center gap-2 py-3 px-2 rounded-2xl bg-surface-200/60 border border-white/5"><!-- Time Mandante (3 cols) --><div class="col-span-3 flex items-center gap-2.5 justify-start"><div class="w-4 h-8 rounded-md shadow shrink-0"${addAttribute(`background-color: ${match.homeTeamColor || "#1f2937"}; border: 1px solid rgba(255,255,255,0.2);`, "style")}></div><div class="min-w-0"><h4${addAttribute(["font-display font-black text-sm sm:text-base truncate", isHomeWinner ? "text-white font-extrabold" : "text-gray-300"], "class:list")}>${match.homeTeamName}</h4>${isHomeWinner && renderTemplate`<span class="text-[10px] font-black text-emerald-400 uppercase tracking-wider">Vencedor</span>`}</div></div><!-- Placar Central (1 col) --><div class="col-span-1 flex items-center justify-center"><div class="font-display font-black text-2xl sm:text-3xl text-white tracking-tight flex items-center gap-1.5"><span${addAttribute([isHomeWinner ? "text-emerald-400" : ""], "class:list")}>${match.homeScore}</span><span class="text-xs text-gray-500 font-normal">x</span><span${addAttribute([isAwayWinner ? "text-emerald-400" : ""], "class:list")}>${match.awayScore}</span></div></div><!-- Time Visitante (3 cols) --><div class="col-span-3 flex items-center gap-2.5 justify-end text-right"><div class="min-w-0"><h4${addAttribute(["font-display font-black text-sm sm:text-base truncate", isAwayWinner ? "text-white font-extrabold" : "text-gray-300"], "class:list")}>${match.awayTeamName}</h4>${isAwayWinner && renderTemplate`<span class="text-[10px] font-black text-emerald-400 uppercase tracking-wider">Vencedor</span>`}</div><div class="w-4 h-8 rounded-md shadow shrink-0"${addAttribute(`background-color: ${match.awayTeamColor || "#ef4444"}; border: 1px solid rgba(255,255,255,0.2);`, "style")}></div></div></div></div>`;
}, "C:/Projetos/SocietyTracker/src/components/ui/MatchHistoryCard.astro", void 0);
//#endregion
//#region src/pages/historico.astro
var historico_exports = /* @__PURE__ */ __exportAll({
	default: () => $$Historico,
	file: () => $$file,
	prerender: () => false,
	url: () => $$url
});
var $$Historico = createComponent(async ($$result, $$props, $$slots) => {
	const FALLBACK_MATCHES = [
		{
			matchId: "m-1",
			sessionId: "s-1",
			sessionDate: "2026-08-08",
			homeTeamName: "Time Preto",
			homeTeamColor: "#1f2937",
			homeScore: 2,
			awayTeamName: "Time Branco",
			awayTeamColor: "#e5e7eb",
			awayScore: 1,
			durationSeconds: 385,
			endReason: "two_goals",
			status: "finished",
			startedAt: "2026-08-08T20:05:00Z",
			finishedAt: "2026-08-08T20:11:25Z"
		},
		{
			matchId: "m-2",
			sessionId: "s-1",
			sessionDate: "2026-08-08",
			homeTeamName: "Time Preto",
			homeTeamColor: "#1f2937",
			homeScore: 2,
			awayTeamName: "Time Azul",
			awayTeamColor: "#3b82f6",
			awayScore: 0,
			durationSeconds: 240,
			endReason: "two_goals",
			status: "finished",
			startedAt: "2026-08-08T20:15:00Z",
			finishedAt: "2026-08-08T20:19:00Z"
		},
		{
			matchId: "m-3",
			sessionId: "s-1",
			sessionDate: "2026-08-08",
			homeTeamName: "Time Preto",
			homeTeamColor: "#1f2937",
			homeScore: 1,
			awayTeamName: "Time Vermelho",
			awayTeamColor: "#ef4444",
			awayScore: 2,
			durationSeconds: 410,
			endReason: "two_goals",
			status: "finished",
			startedAt: "2026-08-08T20:22:00Z",
			finishedAt: "2026-08-08T20:28:50Z"
		},
		{
			matchId: "m-4",
			sessionId: "s-1",
			sessionDate: "2026-08-08",
			homeTeamName: "Time Vermelho",
			homeTeamColor: "#ef4444",
			homeScore: 1,
			awayTeamName: "Time Branco",
			awayTeamColor: "#e5e7eb",
			awayScore: 1,
			durationSeconds: 420,
			endReason: "time_limit",
			status: "finished",
			startedAt: "2026-08-08T20:32:00Z",
			finishedAt: "2026-08-08T20:39:00Z"
		},
		{
			matchId: "m-5",
			sessionId: "s-2",
			sessionDate: "2026-08-01",
			homeTeamName: "Time Azul",
			homeTeamColor: "#3b82f6",
			homeScore: 2,
			awayTeamName: "Time Preto",
			awayTeamColor: "#1f2937",
			awayScore: 1,
			durationSeconds: 360,
			endReason: "two_goals",
			status: "finished",
			startedAt: "2026-08-01T20:00:00Z",
			finishedAt: "2026-08-01T20:06:00Z"
		},
		{
			matchId: "m-6",
			sessionId: "s-2",
			sessionDate: "2026-08-01",
			homeTeamName: "Time Azul",
			homeTeamColor: "#3b82f6",
			homeScore: 0,
			awayTeamName: "Time Vermelho",
			awayTeamColor: "#ef4444",
			awayScore: 2,
			durationSeconds: 310,
			endReason: "two_goals",
			status: "finished",
			startedAt: "2026-08-01T20:10:00Z",
			finishedAt: "2026-08-01T20:15:10Z"
		}
	];
	let matches = [];
	try {
		const dbMatches = await new SupabaseMatchRepository().getMatchesSummary();
		if (dbMatches && dbMatches.length > 0) matches = dbMatches;
		else matches = FALLBACK_MATCHES;
	} catch {
		matches = FALLBACK_MATCHES;
	}
	const groupedMatches = matches.reduce((acc, match) => {
		const dateKey = match.sessionDate || "Data Não Informada";
		if (!acc[dateKey]) acc[dateKey] = [];
		acc[dateKey].push(match);
		return acc;
	}, {});
	const formatDate = (dateStr) => {
		try {
			const parts = dateStr.split("-");
			if (parts.length === 3) {
				const year = parseInt(parts[0], 10);
				const month = parseInt(parts[1], 10) - 1;
				const day = parseInt(parts[2], 10);
				return new Date(year, month, day).toLocaleDateString("pt-BR", {
					weekday: "long",
					year: "numeric",
					month: "long",
					day: "numeric"
				});
			}
			return dateStr;
		} catch {
			return dateStr;
		}
	};
	return renderTemplate`${renderComponent($$result, "Layout", $$Layout, {
		"title": "SocietyTracker • Histórico de Partidas",
		"description": "Veja o placar, duração e detalhes de todos os confrontos disputados nas quintas-feiras.",
		"activeNav": "historico"
	}, { "default": ($$result) => renderTemplate`${maybeRenderHead($$result)}<div class="space-y-8"><!-- Header da Página de Histórico --><div class="p-6 sm:p-8 rounded-3xl glass-card bg-surface-100/90 border border-white/10 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div><div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-black uppercase tracking-wider mb-2"><span>📜</span><span>Linha do Tempo</span></div><h1 class="font-display font-black text-2xl sm:text-3xl lg:text-4xl text-white">Histórico de Confrontos</h1><p class="text-xs sm:text-sm text-gray-400 mt-1">Resultados e lances detalhados de cada rodada da quinta-feira</p></div><div class="flex items-center gap-3 text-xs font-semibold text-gray-300"><span class="px-3.5 py-2 rounded-2xl bg-surface-50 border border-white/5 shadow">⚽ ${matches.reduce((acc, m) => acc + m.homeScore + m.awayScore, 0)} Gols Marcados</span><span class="px-3.5 py-2 rounded-2xl bg-surface-50 border border-white/5 shadow">🎮 ${matches.length} Partidas</span></div></div><!-- Lista de Sessões Agrupadas por Data --><div class="space-y-8">${Object.entries(groupedMatches).map(([dateStr, sessionMatches]) => {
		const totalSessionGoals = sessionMatches.reduce((acc, m) => acc + m.homeScore + m.awayScore, 0);
		return renderTemplate`<section class="space-y-4"><!-- Header da Sessão / Data --><div class="flex items-center justify-between gap-2 px-2 pb-2 border-b border-white/10"><div class="flex items-center gap-2.5"><span class="w-3 h-3 rounded-full bg-emerald-400 shadow shadow-emerald-500/50"></span><h2 class="font-display font-black text-base sm:text-lg text-white capitalize">${formatDate(dateStr)}</h2></div><div class="flex items-center gap-2 text-xs text-gray-400 font-semibold"><span>${sessionMatches.length} jogos</span><span>•</span><span class="text-emerald-400">${totalSessionGoals} gols</span></div></div><!-- Grid de Confrontos daquela Data --><div class="grid grid-cols-1 md:grid-cols-2 gap-4">${sessionMatches.map((match) => renderTemplate`${renderComponent($$result, "MatchHistoryCard", $$MatchHistoryCard, { "match": match })}`)}</div></section>`;
	})}</div></div>` })}`;
}, "C:/Projetos/SocietyTracker/src/pages/historico.astro", void 0);
var $$file = "C:/Projetos/SocietyTracker/src/pages/historico.astro";
var $$url = "/historico";
//#endregion
//#region \0virtual:astro:page:src/pages/historico@_@astro
var page = () => historico_exports;
//#endregion
export { page };
