import { t as __exportAll } from "./rolldown-runtime_D7D4PA-g.mjs";
import { C as createAstro, g as addAttribute, i as renderComponent, m as maybeRenderHead, u as renderTemplate } from "./server_DNJHvdY8.mjs";
import { t as createComponent } from "./compiler_Cige1B-f.mjs";
import { t as SupabaseMatchRepository } from "./SupabaseMatchRepository_BVgvsesk.mjs";
import { t as GetLeaderboardUseCase } from "./GetLeaderboardUseCase_CU9_dacI.mjs";
import { t as $$Layout } from "./Layout_CdFAs0f-.mjs";
//#region src/components/ui/PodiumCard.astro
createAstro("https://astro.build");
var $$PodiumCard = createComponent(($$result, $$props, $$slots) => {
	const Astro = $$result.createAstro($$props, $$slots);
	Astro.self = $$PodiumCard;
	const { rank, title, category, playerName, playerNickname, avatarUrl, statValue, statLabel, secondaryStat } = Astro.props;
	const rankColors = {
		1: {
			border: "border-amber-400/50 hover:border-amber-400",
			bg: "from-amber-500/15 via-surface-100 to-surface-200",
			badge: "bg-amber-400/20 text-amber-300 border-amber-400/40",
			glow: "shadow-amber-500/10 hover:shadow-amber-500/20",
			icon: "👑",
			ribbon: "1º Lugar • Ouro",
			textGradient: "from-amber-200 via-amber-400 to-yellow-500",
			numberBadge: "bg-gradient-to-br from-amber-300 to-amber-600 text-gray-950 font-black"
		},
		2: {
			border: "border-slate-400/40 hover:border-slate-300",
			bg: "from-slate-400/10 via-surface-100 to-surface-200",
			badge: "bg-slate-400/20 text-slate-300 border-slate-400/40",
			glow: "shadow-slate-400/10",
			icon: "🥈",
			ribbon: "2º Lugar • Prata",
			textGradient: "from-slate-100 via-slate-300 to-slate-400",
			numberBadge: "bg-gradient-to-br from-slate-200 to-slate-400 text-gray-950 font-black"
		},
		3: {
			border: "border-amber-700/40 hover:border-amber-600",
			bg: "from-amber-900/15 via-surface-100 to-surface-200",
			badge: "bg-amber-800/30 text-amber-400 border-amber-700/40",
			glow: "shadow-amber-900/10",
			icon: "🥉",
			ribbon: "3º Lugar • Bronze",
			textGradient: "from-amber-300 via-amber-600 to-amber-800",
			numberBadge: "bg-gradient-to-br from-amber-600 to-amber-800 text-white font-black"
		}
	};
	const currentRank = rankColors[rank] || rankColors[1];
	const displayName = playerNickname || playerName;
	return renderTemplate`${maybeRenderHead($$result)}<div${addAttribute([
		"relative rounded-3xl p-5 sm:p-6 glass-card bg-gradient-to-b border transition-all duration-300 shadow-xl group hover:-translate-y-1",
		currentRank.border,
		currentRank.bg,
		currentRank.glow,
		rank === 1 ? "md:-translate-y-2 md:hover:-translate-y-3 ring-1 ring-amber-400/30" : ""
	], "class:list")}><!-- Ribbon Superior --><div class="flex items-center justify-between gap-2 mb-4"><span${addAttribute(["px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border flex items-center gap-1.5", currentRank.badge], "class:list")}><span>${currentRank.icon}</span><span>${title}</span></span><span${addAttribute(["w-6 h-6 rounded-full flex items-center justify-center text-xs shadow", currentRank.numberBadge], "class:list")}>#${rank}</span></div><!-- Avatar & Jogador --><div class="flex items-center gap-3.5 my-3"><div class="relative"><div class="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-surface-50 border border-white/10 flex items-center justify-center font-black text-xl text-white shadow-inner overflow-hidden">${avatarUrl ? renderTemplate`<img${addAttribute(avatarUrl, "src")}${addAttribute(displayName, "alt")} class="w-full h-full object-cover">` : renderTemplate`<span>${displayName.charAt(0).toUpperCase()}</span>`}</div>${rank === 1 && renderTemplate`<span class="absolute -top-2 -right-2 text-base animate-bounce-short">⭐</span>`}</div><div class="flex-1 min-w-0"><h3 class="font-display font-black text-lg sm:text-xl text-white truncate group-hover:text-emerald-400 transition-colors">${displayName}</h3>${playerNickname && playerNickname !== playerName && renderTemplate`<p class="text-xs text-gray-400 truncate">${playerName}</p>`}${secondaryStat && renderTemplate`<p class="text-[11px] text-emerald-400/90 font-semibold mt-0.5">${secondaryStat}</p>`}</div></div><!-- Valor do Destaque Principal --><div class="mt-4 pt-4 border-t border-white/10 flex items-baseline justify-between"><span class="text-xs font-bold uppercase tracking-wider text-gray-400">${statLabel}</span><div class="flex items-baseline gap-1"><span${addAttribute(["font-display text-3xl sm:text-4xl font-black bg-gradient-to-r bg-clip-text text-transparent", currentRank.textGradient], "class:list")}>${statValue}</span><span class="text-xs font-semibold text-gray-400">${statLabel.toLowerCase()}</span></div></div></div>`;
}, "C:/Projetos/SocietyTracker/src/components/ui/PodiumCard.astro", void 0);
//#endregion
//#region src/components/ui/LeaderboardTable.astro
createAstro("https://astro.build");
var $$LeaderboardTable = createComponent(($$result, $$props, $$slots) => {
	const Astro = $$result.createAstro($$props, $$slots);
	Astro.self = $$LeaderboardTable;
	const { players = [] } = Astro.props;
	return renderTemplate`${maybeRenderHead($$result)}<div class="w-full rounded-3xl glass-card border border-white/10 overflow-hidden shadow-2xl bg-surface-100/90"><div class="p-5 sm:p-6 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><h2 class="font-display font-black text-xl sm:text-2xl text-white flex items-center gap-2"><span>📊</span><span>Classificação Geral</span></h2><p class="text-xs sm:text-sm text-gray-400 mt-0.5">Estatísticas acumuladas de todas as quintas-feiras</p></div><!-- Badges Resumo --><div class="flex items-center gap-2 text-xs font-semibold text-gray-300"><span class="px-3 py-1 rounded-xl bg-surface-50 border border-white/5">⚽ Total: ${players.reduce((acc, p) => acc + (p.totalGoals || 0), 0)} gols</span><span class="px-3 py-1 rounded-xl bg-surface-50 border border-white/5">👥 ${players.length} Atletas</span></div></div><div class="overflow-x-auto"><table class="w-full text-left border-collapse min-w-[580px]"><thead><tr class="border-b border-white/5 bg-surface-200/50 text-[11px] font-black uppercase tracking-wider text-gray-400"><th class="py-3.5 px-4 text-center w-14">Pos</th><th class="py-3.5 px-4">Jogador</th><th class="py-3.5 px-3 text-center">Gols</th><th class="py-3.5 px-3 text-center">Assists</th><th class="py-3.5 px-3 text-center bg-emerald-500/5 text-emerald-300">G + A</th><th class="py-3.5 px-3 text-center">Jogos</th><th class="py-3.5 px-4 text-right">Média G/J</th></tr></thead><tbody class="divide-y divide-white/5 text-sm">${players.length === 0 ? renderTemplate`<tr><td colspan="7" class="py-12 text-center text-gray-400"><div class="flex flex-col items-center gap-2"><span class="text-3xl">⚽</span><p class="font-medium">Nenhum dado registrado ainda.</p><p class="text-xs text-gray-500">Inicie uma rodada no Modo Mesário para gerar estatísticas!</p></div></td></tr>` : players.map((player, index) => {
		const rank = index + 1;
		const avgGoals = player.totalSessionsPlayed > 0 ? (player.totalGoals / player.totalSessionsPlayed).toFixed(2) : "0.00";
		return renderTemplate`<tr${addAttribute(["hover:bg-white/[0.03] transition-colors group", rank === 1 ? "bg-amber-500/[0.03]" : ""], "class:list")}><!-- Posição com Badge --><td class="py-3.5 px-4 text-center font-display font-black">${rank === 1 ? renderTemplate`<span class="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-amber-400/20 text-amber-300 border border-amber-400/40 text-xs shadow-sm">1º</span>` : rank === 2 ? renderTemplate`<span class="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-slate-400/20 text-slate-300 border border-slate-400/40 text-xs">2º</span>` : rank === 3 ? renderTemplate`<span class="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-amber-800/30 text-amber-400 border border-amber-700/40 text-xs">3º</span>` : renderTemplate`<span class="text-xs text-gray-500 font-bold">${rank}º</span>`}</td><!-- Jogador (Avatar + Nome) --><td class="py-3.5 px-4"><div class="flex items-center gap-3"><div class="w-9 h-9 rounded-xl bg-surface-50 border border-white/10 flex items-center justify-center font-bold text-xs text-white overflow-hidden shrink-0 shadow-sm">${player.avatarUrl ? renderTemplate`<img${addAttribute(player.avatarUrl, "src")}${addAttribute(player.displayName, "alt")} class="w-full h-full object-cover">` : renderTemplate`<span>${player.displayName.charAt(0).toUpperCase()}</span>`}</div><div class="min-w-0"><div class="font-bold text-white group-hover:text-emerald-400 transition-colors flex items-center gap-1.5"><span class="truncate">${player.displayName}</span>${rank === 1 && renderTemplate`<span class="text-xs">👑</span>`}</div>${player.nickname && player.nickname !== player.name && renderTemplate`<p class="text-[11px] text-gray-400 truncate">${player.name}</p>`}</div></div></td><!-- Gols --><td class="py-3.5 px-3 text-center"><span class="font-display font-black text-base text-white">${player.totalGoals}</span></td><!-- Assistências --><td class="py-3.5 px-3 text-center"><span class="font-display font-bold text-base text-gray-300">${player.totalAssists}</span></td><!-- G+A (Destaque) --><td class="py-3.5 px-3 text-center bg-emerald-500/5"><span class="font-display font-black text-base text-emerald-400">${player.totalContributions}</span></td><!-- Jogos / Rodadas --><td class="py-3.5 px-3 text-center text-xs text-gray-400 font-semibold">${player.totalSessionsPlayed}</td><!-- Média Gols/Jogo --><td class="py-3.5 px-4 text-right font-mono text-xs font-bold text-gray-300">${avgGoals}</td></tr>`;
	})}</tbody></table></div></div>`;
}, "C:/Projetos/SocietyTracker/src/components/ui/LeaderboardTable.astro", void 0);
//#endregion
//#region src/pages/index.astro
var pages_exports = /* @__PURE__ */ __exportAll({
	default: () => $$Index,
	file: () => $$file,
	prerender: () => false,
	url: () => ""
});
var $$Index = createComponent(async ($$result, $$props, $$slots) => {
	const FALLBACK_LEADERBOARD = [
		{
			playerId: "p1",
			name: "Lucas Piccinin",
			nickname: "Lucas",
			displayName: "Lucas",
			avatarUrl: null,
			totalGoals: 14,
			totalAssists: 8,
			totalContributions: 22,
			totalSessionsPlayed: 6
		},
		{
			playerId: "p2",
			name: "Gabriel Silva",
			nickname: "Gabriel",
			displayName: "Gabriel",
			avatarUrl: null,
			totalGoals: 11,
			totalAssists: 9,
			totalContributions: 20,
			totalSessionsPlayed: 6
		},
		{
			playerId: "p3",
			name: "Igor Rocha",
			nickname: "Igor",
			displayName: "Igor",
			avatarUrl: null,
			totalGoals: 9,
			totalAssists: 7,
			totalContributions: 16,
			totalSessionsPlayed: 5
		},
		{
			playerId: "p4",
			name: "Mateus Lima",
			nickname: "Mateus",
			displayName: "Mateus",
			avatarUrl: null,
			totalGoals: 8,
			totalAssists: 5,
			totalContributions: 13,
			totalSessionsPlayed: 6
		},
		{
			playerId: "p7",
			name: "Felipe Santos",
			nickname: "Felipe",
			displayName: "Felipe",
			avatarUrl: null,
			totalGoals: 7,
			totalAssists: 6,
			totalContributions: 13,
			totalSessionsPlayed: 5
		},
		{
			playerId: "p14",
			name: "Vinicius Jr",
			nickname: "Vini",
			displayName: "Vini",
			avatarUrl: null,
			totalGoals: 7,
			totalAssists: 4,
			totalContributions: 11,
			totalSessionsPlayed: 4
		},
		{
			playerId: "p5",
			name: "Bruno Dias",
			nickname: "Bruno",
			displayName: "Bruno",
			avatarUrl: null,
			totalGoals: 5,
			totalAssists: 8,
			totalContributions: 13,
			totalSessionsPlayed: 6
		},
		{
			playerId: "p8",
			name: "Thiago Martins",
			nickname: "Thiago",
			displayName: "Thiago",
			avatarUrl: null,
			totalGoals: 4,
			totalAssists: 5,
			totalContributions: 9,
			totalSessionsPlayed: 4
		}
	];
	let leaderboard = [];
	try {
		const matchRepo = new SupabaseMatchRepository();
		const result = await new GetLeaderboardUseCase(matchRepo).execute();
		if (result && result.length > 0) leaderboard = result;
		else leaderboard = FALLBACK_LEADERBOARD;
	} catch {
		leaderboard = FALLBACK_LEADERBOARD;
	}
	const totalGoalsAll = leaderboard.reduce((acc, p) => acc + p.totalGoals, 0);
	const totalAssistsAll = leaderboard.reduce((acc, p) => acc + p.totalAssists, 0);
	const topScorer = [...leaderboard].sort((a, b) => b.totalGoals - a.totalGoals)[0] || FALLBACK_LEADERBOARD[0];
	const topAssister = [...leaderboard].sort((a, b) => b.totalAssists - a.totalAssists)[0] || FALLBACK_LEADERBOARD[1];
	const topContributor = [...leaderboard].sort((a, b) => b.totalContributions - a.totalContributions)[0] || FALLBACK_LEADERBOARD[0];
	return renderTemplate`${renderComponent($$result, "Layout", $$Layout, {
		"title": "SocietyTracker • Tabela de Classificação & Artilharia",
		"description": "Confira o ranking de artilharia, assistências e estatísticas completas da Pelada das Quintas!",
		"activeNav": "leaderboard"
	}, { "default": ($$result) => renderTemplate`${maybeRenderHead($$result)}<div class="space-y-8"><!-- Hero Header --><div class="relative overflow-hidden rounded-3xl glass-card bg-gradient-to-r from-emerald-950/40 via-surface-100 to-surface-200 p-6 sm:p-8 border border-white/10 shadow-2xl"><div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6"><div><div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-black uppercase tracking-wider mb-3"><span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span><span>Temporada Oficial</span></div><h1 class="font-display font-black text-3xl sm:text-4xl lg:text-5xl text-white tracking-tight">Pelada das <span class="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">Quintas</span></h1><p class="text-sm sm:text-base text-gray-400 mt-2 max-w-xl">Tabela oficial de artilharia, garçons e participações diretas. Jogos rápidos de 7 minutos ou 2 gols.</p></div><!-- Badges Rápidas de Estatísticas --><div class="flex items-center gap-3 shrink-0"><div class="p-3.5 sm:p-4 rounded-2xl bg-surface-50/80 border border-white/10 text-center min-w-[90px] shadow-lg"><span class="font-display font-black text-2xl sm:text-3xl text-emerald-400">${totalGoalsAll}</span><span class="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-400 mt-0.5">Gols</span></div><div class="p-3.5 sm:p-4 rounded-2xl bg-surface-50/80 border border-white/10 text-center min-w-[90px] shadow-lg"><span class="font-display font-black text-2xl sm:text-3xl text-blue-400">${totalAssistsAll}</span><span class="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-400 mt-0.5">Assists</span></div><div class="p-3.5 sm:p-4 rounded-2xl bg-surface-50/80 border border-white/10 text-center min-w-[90px] shadow-lg"><span class="font-display font-black text-2xl sm:text-3xl text-amber-400">${leaderboard.length}</span><span class="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-400 mt-0.5">Atletas</span></div></div></div></div><!-- Pódio Visual: Top 3 Destaques da Temporada --><div><div class="flex items-center justify-between gap-2 mb-4 px-1"><h2 class="font-display font-black text-xl sm:text-2xl text-white flex items-center gap-2"><span>👑</span><span>Destaques da Pelada</span></h2><span class="text-xs text-gray-400 font-semibold">Os líderes da temporada</span></div><div class="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 items-end"><!-- 2º Lugar: Garçom de Ouro --><div class="order-2 md:order-1">${renderComponent($$result, "PodiumCard", $$PodiumCard, {
		"rank": 2,
		"title": "Garçom da Pelada",
		"category": "garcom",
		"playerName": topAssister.name,
		"playerNickname": topAssister.nickname,
		"avatarUrl": topAssister.avatarUrl,
		"statValue": topAssister.totalAssists,
		"statLabel": "Assistências",
		"secondaryStat": `${topAssister.totalGoals} gols anotados`
	})}</div><!-- 1º Lugar: Artilheiro / Chuteira de Ouro (Central) --><div class="order-1 md:order-2">${renderComponent($$result, "PodiumCard", $$PodiumCard, {
		"rank": 1,
		"title": "Chuteira de Ouro",
		"category": "artilheiro",
		"playerName": topScorer.name,
		"playerNickname": topScorer.nickname,
		"avatarUrl": topScorer.avatarUrl,
		"statValue": topScorer.totalGoals,
		"statLabel": "Gols Marcados",
		"secondaryStat": `Média de ${(topScorer.totalGoals / (topScorer.totalSessionsPlayed || 1)).toFixed(1)} gols/rodada`
	})}</div><!-- 3º Lugar: Destaque Geral G+A --><div class="order-3 md:order-3">${renderComponent($$result, "PodiumCard", $$PodiumCard, {
		"rank": 3,
		"title": "Rei da Pelada (G+A)",
		"category": "destaque",
		"playerName": topContributor.name,
		"playerNickname": topContributor.nickname,
		"avatarUrl": topContributor.avatarUrl,
		"statValue": topContributor.totalContributions,
		"statLabel": "Participações",
		"secondaryStat": `${topContributor.totalGoals}G + ${topContributor.totalAssists}A`
	})}</div></div></div><!-- Tabela Geral de Classificação SSR -->${renderComponent($$result, "LeaderboardTable", $$LeaderboardTable, { "players": leaderboard })}</div>` })}`;
}, "C:/Projetos/SocietyTracker/src/pages/index.astro", void 0);
var $$file = "C:/Projetos/SocietyTracker/src/pages/index.astro";
//#endregion
//#region \0virtual:astro:page:src/pages/index@_@astro
var page = () => pages_exports;
//#endregion
export { page };
