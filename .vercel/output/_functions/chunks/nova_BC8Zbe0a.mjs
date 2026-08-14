import { t as __exportAll } from "./rolldown-runtime_D7D4PA-g.mjs";
import { i as renderComponent, u as renderTemplate } from "./server_DNJHvdY8.mjs";
import { t as createComponent } from "./compiler_Cige1B-f.mjs";
import { t as SupabasePlayerRepository } from "./SupabasePlayerRepository_dyEOLIm4.mjs";
import { t as $$Layout } from "./Layout_7_u9jphL.mjs";
import { t as cn } from "./utils_7hA_0p5v.mjs";
import { useState } from "react";
import { ArrowRight, Dices, Search, ShieldAlert, Trash2, UserPlus, X } from "lucide-react";
import { Fragment as Fragment$1, jsx, jsxs } from "react/jsx-runtime";
//#region src/components/live/TeamBuilderIsland.tsx
var DEFAULT_TEAMS_CONFIG = [
	{
		id: "team-1",
		name: "Time Preto",
		colorHex: "#1f2937"
	},
	{
		id: "team-2",
		name: "Time Branco",
		colorHex: "#e5e7eb"
	},
	{
		id: "team-3",
		name: "Time Azul",
		colorHex: "#3b82f6"
	},
	{
		id: "team-4",
		name: "Time Vermelho",
		colorHex: "#ef4444"
	}
];
var TeamBuilderIsland = ({ initialPlayers }) => {
	const [allPlayers, setAllPlayers] = useState(initialPlayers);
	const [searchQuery, setSearchQuery] = useState("");
	const [sessionDate, setSessionDate] = useState(() => {
		return (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
	});
	const [notes, setNotes] = useState("");
	const [isSaving, setIsSaving] = useState(false);
	const [errorMessage, setErrorMessage] = useState(null);
	const [isAddPlayerModalOpen, setIsAddPlayerModalOpen] = useState(false);
	const [newPlayerName, setNewPlayerName] = useState("");
	const [newPlayerNickname, setNewPlayerNickname] = useState("");
	const [isCreatingPlayer, setIsCreatingPlayer] = useState(false);
	const [teams, setTeams] = useState(() => DEFAULT_TEAMS_CONFIG.map((t) => ({
		...t,
		players: []
	})));
	const assignedPlayerIds = new Set(teams.flatMap((t) => t.players.map((p) => p.id)));
	const availablePlayers = allPlayers.filter((p) => !assignedPlayerIds.has(p.id));
	const filteredAvailable = availablePlayers.filter((p) => {
		const term = searchQuery.toLowerCase();
		return p.name.toLowerCase().includes(term) || p.nickname && p.nickname.toLowerCase().includes(term);
	});
	const totalAssigned = assignedPlayerIds.size;
	const handleAssignToTeam = (player, teamId) => {
		setTeams((prev) => prev.map((t) => {
			if (t.id === teamId) {
				if (t.players.length >= 6) {
					alert(`O ${t.name} já atingiu o limite de 6 jogadores.`);
					return t;
				}
				return {
					...t,
					players: [...t.players, player]
				};
			}
			return t;
		}));
	};
	const handleRemoveFromTeam = (teamId, playerId) => {
		setTeams((prev) => prev.map((t) => {
			if (t.id === teamId) return {
				...t,
				players: t.players.filter((p) => p.id !== playerId)
			};
			return t;
		}));
	};
	const handleAutoDraw = () => {
		const shuffled = [...[...allPlayers]].sort(() => Math.random() - .5);
		const maxPlayersPerTeam = 6;
		const newTeams = DEFAULT_TEAMS_CONFIG.map((t) => ({
			...t,
			players: []
		}));
		let playerIndex = 0;
		for (let round = 0; round < maxPlayersPerTeam; round++) for (let t = 0; t < newTeams.length; t++) if (playerIndex < shuffled.length) {
			newTeams[t].players.push(shuffled[playerIndex]);
			playerIndex++;
		}
		setTeams(newTeams);
	};
	const handleClearTeams = () => {
		setTeams(DEFAULT_TEAMS_CONFIG.map((t) => ({
			...t,
			players: []
		})));
	};
	const handleCreatePlayer = async (e) => {
		e.preventDefault();
		if (!newPlayerName.trim()) return;
		setIsCreatingPlayer(true);
		try {
			const res = await fetch("/api/players", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: newPlayerName.trim(),
					nickname: newPlayerNickname.trim() || null
				})
			});
			if (!res.ok) throw new Error("Falha ao cadastrar jogador.");
			const created = await res.json();
			setAllPlayers((prev) => [created, ...prev]);
			setNewPlayerName("");
			setNewPlayerNickname("");
			setIsAddPlayerModalOpen(false);
		} catch (err) {
			alert(err.message || "Erro ao cadastrar jogador.");
		} finally {
			setIsCreatingPlayer(false);
		}
	};
	const handleSaveSession = async () => {
		if (totalAssigned < 4) {
			setErrorMessage("Distribua pelo menos alguns jogadores nos times antes de iniciar.");
			return;
		}
		setIsSaving(true);
		setErrorMessage(null);
		try {
			const payload = {
				sessionDate,
				notes: notes.trim() || null,
				teams: teams.map((t) => ({
					name: t.name,
					colorHex: t.colorHex,
					playerIds: t.players.map((p) => p.id)
				}))
			};
			const res = await fetch("/api/sessions", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload)
			});
			if (!res.ok) {
				const errorData = await res.json();
				throw new Error(errorData.error || "Erro ao salvar rodada.");
			}
			const created = await res.json();
			window.location.href = `/rodada/mesario?sessionId=${created.id}`;
		} catch (err) {
			setErrorMessage(err.message || "Erro ao conectar ao servidor.");
			setIsSaving(false);
		}
	};
	return /* @__PURE__ */ jsxs("div", {
		className: "space-y-6",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl glass-card bg-surface-100/90 border border-white/10",
				children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsxs("h2", {
					className: "font-display font-black text-xl sm:text-2xl text-white flex items-center gap-2",
					children: [/* @__PURE__ */ jsx("span", { children: "👥" }), /* @__PURE__ */ jsx("span", { children: "Montagem dos 4 Times" })]
				}), /* @__PURE__ */ jsx("p", {
					className: "text-xs sm:text-sm text-gray-400 mt-0.5",
					children: "Distribua até 24 jogadores entre Preto, Branco, Azul e Vermelho (6 por time)."
				})] }), /* @__PURE__ */ jsxs("div", {
					className: "flex flex-wrap items-center gap-2",
					children: [
						/* @__PURE__ */ jsxs("button", {
							type: "button",
							onClick: handleAutoDraw,
							className: "px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-bold text-xs sm:text-sm flex items-center gap-2 transition-all active:scale-95",
							children: [/* @__PURE__ */ jsx(Dices, { className: "w-4 h-4 text-amber-400" }), /* @__PURE__ */ jsx("span", { children: "Sortear Equilibrado" })]
						}),
						/* @__PURE__ */ jsx("button", {
							type: "button",
							onClick: handleClearTeams,
							className: "px-3 py-2 rounded-xl bg-surface-50 hover:bg-surface-200 border border-white/5 text-gray-400 hover:text-white font-semibold text-xs transition-all",
							children: "Limpar"
						}),
						/* @__PURE__ */ jsxs("button", {
							type: "button",
							onClick: () => setIsAddPlayerModalOpen(true),
							className: "px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-all active:scale-95",
							children: [/* @__PURE__ */ jsx(UserPlus, { className: "w-4 h-4 text-emerald-400" }), /* @__PURE__ */ jsx("span", { children: "Novo Avulso" })]
						})
					]
				})]
			}),
			errorMessage && /* @__PURE__ */ jsxs("div", {
				className: "p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2 animate-fade-in",
				children: [/* @__PURE__ */ jsx(ShieldAlert, { className: "w-5 h-5 text-rose-400 shrink-0" }), /* @__PURE__ */ jsx("span", { children: errorMessage })]
			}),
			/* @__PURE__ */ jsx("div", {
				className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4",
				children: teams.map((team) => /* @__PURE__ */ jsxs("div", {
					className: "rounded-3xl glass-card border border-white/10 bg-surface-100/90 p-4 flex flex-col justify-between shadow-lg relative overflow-hidden",
					children: [/* @__PURE__ */ jsx("div", {
						className: "absolute top-0 left-0 right-0 h-2",
						style: { backgroundColor: team.colorHex }
					}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsxs("div", {
						className: "flex items-center justify-between gap-2 mt-1 mb-3",
						children: [/* @__PURE__ */ jsxs("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ jsx("div", {
								className: "w-3.5 h-3.5 rounded-full border border-white/20",
								style: { backgroundColor: team.colorHex }
							}), /* @__PURE__ */ jsx("h3", {
								className: "font-display font-black text-base text-white",
								children: team.name
							})]
						}), /* @__PURE__ */ jsxs("span", {
							className: cn("text-xs font-black px-2 py-0.5 rounded-full border", team.players.length === 6 ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" : "bg-surface-50 text-gray-400 border-white/5"),
							children: [team.players.length, "/6"]
						})]
					}), /* @__PURE__ */ jsx("div", {
						className: "space-y-1.5 min-h-[180px]",
						children: team.players.length === 0 ? /* @__PURE__ */ jsxs("div", {
							className: "h-full min-h-[160px] border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center text-center p-3 text-gray-500 text-xs",
							children: [/* @__PURE__ */ jsx("span", { children: "Nenhum jogador escalado" }), /* @__PURE__ */ jsx("span", {
								className: "text-[10px] text-gray-600 mt-1",
								children: "Clique em um jogador abaixo para escalar"
							})]
						}) : team.players.map((p, idx) => /* @__PURE__ */ jsxs("div", {
							className: "flex items-center justify-between p-2 rounded-xl bg-surface-200/60 border border-white/5 text-xs group hover:border-white/20 transition-all",
							children: [/* @__PURE__ */ jsxs("div", {
								className: "flex items-center gap-2 min-w-0",
								children: [/* @__PURE__ */ jsx("span", {
									className: "w-5 h-5 rounded-lg bg-surface-50 text-gray-400 font-bold text-[10px] flex items-center justify-center shrink-0",
									children: idx + 1
								}), /* @__PURE__ */ jsx("span", {
									className: "font-semibold text-white truncate",
									children: p.nickname || p.name
								})]
							}), /* @__PURE__ */ jsx("button", {
								type: "button",
								onClick: () => handleRemoveFromTeam(team.id, p.id),
								className: "text-gray-500 hover:text-rose-400 p-1 transition-colors",
								title: "Remover do time",
								children: /* @__PURE__ */ jsx(Trash2, { className: "w-3.5 h-3.5" })
							})]
						}, p.id))
					})] })]
				}, team.id))
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "p-5 rounded-3xl glass-card bg-surface-100/90 border border-white/10 shadow-xl",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4",
					children: [/* @__PURE__ */ jsxs("div", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ jsxs("h3", {
							className: "font-display font-black text-base sm:text-lg text-white",
							children: [
								"Jogadores Disponíveis (",
								availablePlayers.length,
								")"
							]
						}), /* @__PURE__ */ jsxs("span", {
							className: "text-xs text-emerald-400 font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20",
							children: [totalAssigned, " escalados"]
						})]
					}), /* @__PURE__ */ jsxs("div", {
						className: "relative w-full sm:w-64",
						children: [/* @__PURE__ */ jsx(Search, { className: "w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" }), /* @__PURE__ */ jsx("input", {
							type: "text",
							placeholder: "Buscar atleta...",
							value: searchQuery,
							onChange: (e) => setSearchQuery(e.target.value),
							className: "w-full pl-9 pr-3 py-1.5 rounded-xl bg-surface-50 border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
						})]
					})]
				}), /* @__PURE__ */ jsx("div", {
					className: "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-72 overflow-y-auto pr-1",
					children: filteredAvailable.length === 0 ? /* @__PURE__ */ jsx("div", {
						className: "col-span-full py-8 text-center text-gray-500 text-xs",
						children: searchQuery ? "Nenhum jogador encontrado com esse nome." : "Todos os jogadores já foram escalados nos times!"
					}) : filteredAvailable.map((player) => /* @__PURE__ */ jsxs("div", {
						className: "p-2 rounded-2xl bg-surface-200/80 border border-white/5 hover:border-emerald-500/40 transition-all flex flex-col justify-between gap-2 shadow-sm",
						children: [/* @__PURE__ */ jsxs("div", {
							className: "min-w-0",
							children: [/* @__PURE__ */ jsx("div", {
								className: "font-bold text-xs text-white truncate",
								children: player.nickname || player.name
							}), player.nickname && player.nickname !== player.name && /* @__PURE__ */ jsx("div", {
								className: "text-[10px] text-gray-400 truncate",
								children: player.name
							})]
						}), /* @__PURE__ */ jsx("div", {
							className: "grid grid-cols-4 gap-1 pt-1 border-t border-white/5",
							children: teams.map((team) => /* @__PURE__ */ jsx("button", {
								type: "button",
								disabled: team.players.length >= 6,
								onClick: () => handleAssignToTeam(player, team.id),
								className: "h-6 rounded-lg text-[10px] font-black flex items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:scale-100",
								style: {
									backgroundColor: team.colorHex,
									color: team.id === "team-2" ? "#111827" : "#ffffff"
								},
								title: `Escalar no ${team.name}`,
								children: "+"
							}, team.id))
						})]
					}, player.id))
				})]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "p-5 rounded-3xl glass-card bg-surface-100/90 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto",
					children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
						className: "block text-[11px] font-bold uppercase text-gray-400 mb-1",
						children: "Data da Pelada"
					}), /* @__PURE__ */ jsx("input", {
						type: "date",
						value: sessionDate,
						onChange: (e) => setSessionDate(e.target.value),
						className: "px-3 py-2 rounded-xl bg-surface-50 border border-white/10 text-xs text-white focus:outline-none focus:border-emerald-500"
					})] }), /* @__PURE__ */ jsxs("div", {
						className: "w-full sm:w-64",
						children: [/* @__PURE__ */ jsx("label", {
							className: "block text-[11px] font-bold uppercase text-gray-400 mb-1",
							children: "Observações (Opcional)"
						}), /* @__PURE__ */ jsx("input", {
							type: "text",
							placeholder: "Ex: Rodada especial de fim de mês",
							value: notes,
							onChange: (e) => setNotes(e.target.value),
							className: "w-full px-3 py-2 rounded-xl bg-surface-50 border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
						})]
					})]
				}), /* @__PURE__ */ jsx("button", {
					type: "button",
					disabled: isSaving,
					onClick: handleSaveSession,
					className: "w-full sm:w-auto min-h-[48px] px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 disabled:opacity-50 text-gray-950 font-black text-sm shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 shrink-0 touch-press-scale",
					children: isSaving ? /* @__PURE__ */ jsx("span", { children: "Salvando Sessão..." }) : /* @__PURE__ */ jsxs(Fragment$1, { children: [/* @__PURE__ */ jsx("span", { children: "Salvar e Iniciar Rodada" }), /* @__PURE__ */ jsx(ArrowRight, { className: "w-4 h-4" })] })
				})]
			}),
			isAddPlayerModalOpen && /* @__PURE__ */ jsx("div", {
				className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in",
				children: /* @__PURE__ */ jsxs("div", {
					className: "relative w-full max-w-sm rounded-3xl glass-card-glow bg-surface-100 border border-emerald-500/30 p-6 shadow-2xl",
					children: [
						/* @__PURE__ */ jsx("button", {
							type: "button",
							onClick: () => setIsAddPlayerModalOpen(false),
							className: "absolute top-4 right-4 p-1 rounded-xl text-gray-400 hover:text-white",
							children: /* @__PURE__ */ jsx(X, { className: "w-5 h-5" })
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "flex items-center gap-2 mb-4",
							children: [/* @__PURE__ */ jsx("div", {
								className: "w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold",
								children: /* @__PURE__ */ jsx(UserPlus, { className: "w-5 h-5" })
							}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h3", {
								className: "font-display font-black text-lg text-white",
								children: "Novo Jogador"
							}), /* @__PURE__ */ jsx("p", {
								className: "text-xs text-gray-400",
								children: "Cadastre um atleta avulso na hora"
							})] })]
						}),
						/* @__PURE__ */ jsxs("form", {
							onSubmit: handleCreatePlayer,
							className: "space-y-3",
							children: [
								/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
									className: "block text-xs font-bold text-gray-300 mb-1",
									children: "Nome Completo *"
								}), /* @__PURE__ */ jsx("input", {
									type: "text",
									required: true,
									placeholder: "Ex: Matheus Silva",
									value: newPlayerName,
									onChange: (e) => setNewPlayerName(e.target.value),
									className: "w-full px-3.5 py-2.5 rounded-xl bg-surface-50 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
								})] }),
								/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
									className: "block text-xs font-bold text-gray-300 mb-1",
									children: "Apelido (Como é chamado)"
								}), /* @__PURE__ */ jsx("input", {
									type: "text",
									placeholder: "Ex: Theus",
									value: newPlayerNickname,
									onChange: (e) => setNewPlayerNickname(e.target.value),
									className: "w-full px-3.5 py-2.5 rounded-xl bg-surface-50 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
								})] }),
								/* @__PURE__ */ jsxs("div", {
									className: "pt-2 flex items-center gap-2",
									children: [/* @__PURE__ */ jsx("button", {
										type: "button",
										onClick: () => setIsAddPlayerModalOpen(false),
										className: "flex-1 py-2.5 rounded-xl bg-surface-50 hover:bg-surface-200 text-xs font-bold text-gray-300",
										children: "Cancelar"
									}), /* @__PURE__ */ jsx("button", {
										type: "submit",
										disabled: isCreatingPlayer,
										className: "flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-xs font-black text-gray-950 disabled:opacity-50",
										children: isCreatingPlayer ? "Salvando..." : "Cadastrar"
									})]
								})
							]
						})
					]
				})
			})
		]
	});
};
//#endregion
//#region src/pages/rodada/nova.astro
var nova_exports = /* @__PURE__ */ __exportAll({
	default: () => $$Nova,
	file: () => $$file,
	prerender: () => false,
	url: () => $$url
});
var $$Nova = createComponent(async ($$result, $$props, $$slots) => {
	const FALLBACK_PLAYERS = [
		{
			id: "p1",
			name: "Lucas Piccinin",
			nickname: "Lucas"
		},
		{
			id: "p2",
			name: "Gabriel Silva",
			nickname: "Gabriel"
		},
		{
			id: "p3",
			name: "Igor Rocha",
			nickname: "Igor"
		},
		{
			id: "p4",
			name: "Mateus Lima",
			nickname: "Mateus"
		},
		{
			id: "p5",
			name: "Bruno Dias",
			nickname: "Bruno"
		},
		{
			id: "p6",
			name: "Rodrigo Alves",
			nickname: "Rodrigo"
		},
		{
			id: "p7",
			name: "Felipe Santos",
			nickname: "Felipe"
		},
		{
			id: "p8",
			name: "Thiago Martins",
			nickname: "Thiago"
		},
		{
			id: "p9",
			name: "Rafael Costa",
			nickname: "Rafael"
		},
		{
			id: "p10",
			name: "Danilo Souza",
			nickname: "Danilo"
		},
		{
			id: "p11",
			name: "Leonardo Moura",
			nickname: "Léo"
		},
		{
			id: "p12",
			name: "Gustavo Nunes",
			nickname: "Gustavo"
		},
		{
			id: "p13",
			name: "Caio Castro",
			nickname: "Caio"
		},
		{
			id: "p14",
			name: "Vinicius Jr",
			nickname: "Vini"
		},
		{
			id: "p15",
			name: "Arthur Melo",
			nickname: "Arthur"
		},
		{
			id: "p16",
			name: "Bernardo Silva",
			nickname: "Bernardo"
		},
		{
			id: "p17",
			name: "Diego Ribas",
			nickname: "Diego"
		},
		{
			id: "p18",
			name: "Enzo Ferrari",
			nickname: "Enzo"
		},
		{
			id: "p19",
			name: "Pedro Henrique",
			nickname: "Pedro"
		},
		{
			id: "p20",
			name: "Lucas Paquetá",
			nickname: "Paquetá"
		},
		{
			id: "p21",
			name: "Richarlison",
			nickname: "Pombo"
		},
		{
			id: "p22",
			name: "Casemiro",
			nickname: "Case"
		},
		{
			id: "p23",
			name: "Marquinhos",
			nickname: "Marquinhos"
		},
		{
			id: "p24",
			name: "Alisson Becker",
			nickname: "Alisson"
		}
	];
	let players = [];
	try {
		const dbPlayers = await new SupabasePlayerRepository().findAll(true);
		if (dbPlayers && dbPlayers.length > 0) players = dbPlayers.map((p) => ({
			id: p.id || "",
			name: p.name,
			nickname: p.nickname || null,
			avatarUrl: p.avatarUrl || null
		}));
		else players = FALLBACK_PLAYERS;
	} catch {
		players = FALLBACK_PLAYERS;
	}
	return renderTemplate`${renderComponent($$result, "Layout", $$Layout, {
		"title": "SocietyTracker • Montar Times da Rodada",
		"description": "Distribua os atletas presentes nos 4 times da noite (Preto, Branco, Azul, Vermelho) e inicie a pelada!",
		"activeNav": "nova_rodada"
	}, { "default": ($$result) => renderTemplate`${renderComponent($$result, "TeamBuilderIsland", TeamBuilderIsland, {
		"client:load": true,
		"initialPlayers": players,
		"client:component-hydration": "load",
		"client:component-path": "C:/Projetos/SocietyTracker/src/components/live/TeamBuilderIsland.tsx",
		"client:component-export": "TeamBuilderIsland"
	})}` })}`;
}, "C:/Projetos/SocietyTracker/src/pages/rodada/nova.astro", void 0);
var $$file = "C:/Projetos/SocietyTracker/src/pages/rodada/nova.astro";
var $$url = "/rodada/nova";
//#endregion
//#region \0virtual:astro:page:src/pages/rodada/nova@_@astro
var page = () => nova_exports;
//#endregion
export { page };
