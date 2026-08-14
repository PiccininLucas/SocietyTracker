import { t as __exportAll } from "./rolldown-runtime_D7D4PA-g.mjs";
import { C as createAstro, i as renderComponent, u as renderTemplate } from "./server_DNJHvdY8.mjs";
import { t as createComponent } from "./compiler_Cige1B-f.mjs";
import { t as SupabaseSessionRepository } from "./SupabaseSessionRepository_CWOm7LEd.mjs";
import { t as $$Layout } from "./Layout_7_u9jphL.mjs";
import { t as cn } from "./utils_7hA_0p5v.mjs";
import { n as soundFx, t as hapticFeedback } from "./vibration_DEhdHpvZ.mjs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, AlertTriangle, ArrowLeft, ArrowRightLeft, Calendar, Check, CheckCircle2, ChevronRight, Flame, Pause, Play, Plus, RotateCcw, Save, ShieldAlert, Sparkles, Square, Trophy, Undo2, User, UserCheck, Volume2, X } from "lucide-react";
import { Fragment as Fragment$1, jsx, jsxs } from "react/jsx-runtime";
//#region src/components/live/types.ts
var ACTIVE_MATCH_STORAGE_KEY = "society_active_match_state";
//#endregion
//#region src/components/live/MatchTimer.tsx
var MatchTimer = ({ secondsRemaining, totalDuration = 420, isRunning, onToggleRunning, onAddMinute, onReset, onTimeExpired, disabled = false, className }) => {
	const hasExpiredFiredRef = useRef(false);
	const formattedTime = useMemo(() => {
		const clamped = Math.max(0, secondsRemaining);
		const mins = Math.floor(clamped / 60);
		const secs = clamped % 60;
		return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
	}, [secondsRemaining]);
	const progressPercent = useMemo(() => {
		if (totalDuration <= 0) return 0;
		const pct = Math.max(0, secondsRemaining) / totalDuration * 100;
		return Math.min(100, Math.max(0, pct));
	}, [secondsRemaining, totalDuration]);
	useEffect(() => {
		if (secondsRemaining <= 0 && isRunning && !hasExpiredFiredRef.current) {
			hasExpiredFiredRef.current = true;
			soundFx.playWhistle();
			hapticFeedback.timeExpired();
			onTimeExpired?.();
		} else if (secondsRemaining > 0) hasExpiredFiredRef.current = false;
	}, [
		secondsRemaining,
		isRunning,
		onTimeExpired
	]);
	const handleToggle = () => {
		if (disabled) return;
		hapticFeedback.click();
		soundFx.playClickBeep(isRunning ? "low" : "high");
		onToggleRunning();
	};
	const handleAddMinute = () => {
		if (disabled) return;
		hapticFeedback.click();
		soundFx.playClickBeep("normal");
		onAddMinute();
	};
	const handleReset = () => {
		if (disabled) return;
		hapticFeedback.click();
		soundFx.playClickBeep("low");
		onReset();
	};
	const timerTone = useMemo(() => {
		if (secondsRemaining <= 0) return {
			bar: "bg-rose-500",
			text: "text-rose-500 animate-pulse",
			badge: "bg-rose-500/20 text-rose-300 border-rose-500/30",
			cardGlow: "border-rose-500/50 shadow-[0_0_25px_rgba(244,63,94,0.3)]"
		};
		if (secondsRemaining <= 60) return {
			bar: "bg-rose-500",
			text: "text-rose-400",
			badge: "bg-rose-500/10 text-rose-300 border-rose-500/20",
			cardGlow: "border-rose-500/30"
		};
		if (secondsRemaining <= 180) return {
			bar: "bg-amber-400",
			text: "text-amber-400",
			badge: "bg-amber-500/10 text-amber-300 border-amber-500/20",
			cardGlow: "border-amber-500/30"
		};
		return {
			bar: "bg-emerald-500",
			text: "text-emerald-400",
			badge: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
			cardGlow: "border-emerald-500/20"
		};
	}, [secondsRemaining]);
	const isExpired = secondsRemaining <= 0;
	return /* @__PURE__ */ jsxs("div", {
		className: cn("w-full rounded-2xl glass-card p-4 transition-all duration-300", timerTone.cardGlow, className),
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "flex items-center justify-between mb-2",
				children: [/* @__PURE__ */ jsx("div", {
					className: "flex items-center gap-2",
					children: /* @__PURE__ */ jsx("span", {
						className: cn("flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border", timerTone.badge),
						children: isExpired ? /* @__PURE__ */ jsxs(Fragment$1, { children: [/* @__PURE__ */ jsx(AlertTriangle, { className: "w-3.5 h-3.5" }), "Tempo Esgotado"] }) : isRunning ? /* @__PURE__ */ jsxs(Fragment$1, { children: [/* @__PURE__ */ jsx("span", { className: "w-2 h-2 rounded-full bg-emerald-400 animate-ping" }), "Em Andamento"] }) : /* @__PURE__ */ jsxs(Fragment$1, { children: [/* @__PURE__ */ jsx("span", { className: "w-2 h-2 rounded-full bg-gray-400" }), "Pausado"] })
					})
				}), /* @__PURE__ */ jsx("button", {
					type: "button",
					onClick: () => {
						soundFx.playWhistle();
						hapticFeedback.timeExpired();
					},
					className: "text-gray-400 hover:text-gray-200 p-1 rounded-lg transition-colors",
					title: "Testar Apito do Juiz",
					"aria-label": "Testar Som de Apito",
					children: /* @__PURE__ */ jsx(Volume2, { className: "w-4 h-4 opacity-70 hover:opacity-100" })
				})]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "flex flex-col items-center justify-center my-2",
				children: [/* @__PURE__ */ jsx("div", {
					className: cn("font-mono text-5xl sm:text-6xl font-extrabold tracking-tight select-none transition-colors duration-200", timerTone.text),
					children: formattedTime
				}), /* @__PURE__ */ jsx("p", {
					className: "text-xs text-gray-400 mt-1 font-medium",
					children: "Duração oficial: 7 minutos (420s)"
				})]
			}),
			/* @__PURE__ */ jsx("div", {
				className: "w-full bg-gray-800/80 rounded-full h-2.5 my-3 overflow-hidden border border-gray-700/50",
				children: /* @__PURE__ */ jsx("div", {
					className: cn("h-full rounded-full transition-all duration-300 ease-linear", timerTone.bar),
					style: { width: `${progressPercent}%` }
				})
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "grid grid-cols-3 gap-2 mt-3",
				children: [
					/* @__PURE__ */ jsxs("button", {
						type: "button",
						disabled,
						onClick: handleReset,
						className: "min-h-[46px] flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-gray-800/90 hover:bg-gray-700 active:scale-95 text-gray-300 hover:text-white font-medium text-xs sm:text-sm border border-gray-700/60 transition-all touch-press-scale disabled:opacity-40 disabled:pointer-events-none",
						"aria-label": "Resetar Cronômetro",
						children: [/* @__PURE__ */ jsx(RotateCcw, { className: "w-4 h-4" }), /* @__PURE__ */ jsx("span", { children: "Reset" })]
					}),
					/* @__PURE__ */ jsx("button", {
						type: "button",
						disabled,
						onClick: handleToggle,
						className: cn("min-h-[46px] col-span-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm sm:text-base transition-all touch-press-scale shadow-lg active:scale-95 disabled:opacity-40 disabled:pointer-events-none", isRunning ? "bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-gray-950 shadow-amber-500/20" : "bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-gray-950 shadow-emerald-500/25"),
						"aria-label": isRunning ? "Pausar Cronômetro" : "Iniciar Cronômetro",
						children: isRunning ? /* @__PURE__ */ jsxs(Fragment$1, { children: [/* @__PURE__ */ jsx(Pause, { className: "w-4 h-4 fill-current" }), /* @__PURE__ */ jsx("span", { children: "Pausar" })] }) : /* @__PURE__ */ jsxs(Fragment$1, { children: [/* @__PURE__ */ jsx(Play, { className: "w-4 h-4 fill-current" }), /* @__PURE__ */ jsx("span", { children: "Iniciar" })] })
					}),
					/* @__PURE__ */ jsxs("button", {
						type: "button",
						disabled,
						onClick: handleAddMinute,
						className: "min-h-[46px] flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl bg-gray-800/90 hover:bg-gray-700 active:scale-95 text-emerald-400 hover:text-emerald-300 font-semibold text-xs sm:text-sm border border-gray-700/60 transition-all touch-press-scale disabled:opacity-40 disabled:pointer-events-none",
						"aria-label": "Adicionar 1 Minuto",
						children: [/* @__PURE__ */ jsx(Plus, { className: "w-4 h-4" }), /* @__PURE__ */ jsx("span", { children: "+1 min" })]
					})
				]
			})
		]
	});
};
//#endregion
//#region src/components/live/GoalDrawer.tsx
var GoalDrawer = ({ isOpen, team, opponentTeam, onConfirmGoal, onClose }) => {
	const [step, setStep] = useState("select_scorer");
	const [selectedScorer, setSelectedScorer] = useState(null);
	const [isOwnGoal, setIsOwnGoal] = useState(false);
	useEffect(() => {
		if (isOpen) {
			setStep("select_scorer");
			setSelectedScorer(null);
			setIsOwnGoal(false);
		}
	}, [isOpen, team?.id]);
	if (!isOpen || !team) return null;
	const teamPlayers = team.players || [];
	const assistCandidates = teamPlayers.filter((p) => !selectedScorer || p.id !== selectedScorer.id);
	const handleSelectScorer = (player) => {
		hapticFeedback.click();
		soundFx.playClickBeep("high");
		setSelectedScorer(player);
		setIsOwnGoal(false);
		setStep("select_assist");
	};
	const handleSelectOwnGoal = () => {
		hapticFeedback.goal();
		soundFx.playGoalSound();
		onConfirmGoal({
			teamId: team.id,
			scorerId: null,
			assistId: null,
			isOwnGoal: true,
			scorerName: "Gol Contra",
			assistName: void 0
		});
		onClose();
	};
	const handleSelectAssist = (assistPlayer) => {
		if (!selectedScorer) return;
		hapticFeedback.goal();
		soundFx.playGoalSound();
		onConfirmGoal({
			teamId: team.id,
			scorerId: selectedScorer.id,
			assistId: assistPlayer ? assistPlayer.id : null,
			isOwnGoal: false,
			scorerName: selectedScorer.nickname || selectedScorer.name,
			assistName: assistPlayer ? assistPlayer.nickname || assistPlayer.name : void 0
		});
		onClose();
	};
	return /* @__PURE__ */ jsxs("div", {
		className: "fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm transition-opacity animate-fade-in",
		children: [/* @__PURE__ */ jsx("div", {
			className: "absolute inset-0",
			onClick: onClose,
			"aria-hidden": "true"
		}), /* @__PURE__ */ jsxs("div", {
			className: "relative z-10 w-full max-w-lg rounded-t-3xl bg-surface-100 border-t border-white/10 p-5 shadow-2xl animate-slide-up max-h-[85vh] flex flex-col",
			style: { boxShadow: `0 -10px 40px -10px ${team.colorHex}33` },
			children: [
				/* @__PURE__ */ jsx("div", { className: "w-12 h-1.5 bg-gray-600 rounded-full mx-auto mb-4" }),
				/* @__PURE__ */ jsxs("div", {
					className: "flex items-center justify-between pb-3 border-b border-gray-800",
					children: [/* @__PURE__ */ jsxs("div", {
						className: "flex items-center gap-3",
						children: [step === "select_assist" && /* @__PURE__ */ jsx("button", {
							type: "button",
							onClick: () => {
								hapticFeedback.click();
								setStep("select_scorer");
							},
							className: "p-1.5 rounded-lg bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors",
							"aria-label": "Voltar para seleção de autor",
							children: /* @__PURE__ */ jsx(ArrowLeft, { className: "w-5 h-5" })
						}), /* @__PURE__ */ jsxs("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ jsx("span", {
								className: "w-4 h-4 rounded-full border border-white/30",
								style: { backgroundColor: team.colorHex }
							}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h3", {
								className: "text-base sm:text-lg font-bold text-white leading-tight",
								children: step === "select_scorer" ? "⚽ Quem marcou o gol?" : "👟 Quem deu a assistência?"
							}), /* @__PURE__ */ jsxs("p", {
								className: "text-xs text-gray-400",
								children: [
									team.name,
									" • ",
									step === "select_scorer" ? "Passo 1 de 2" : "Passo 2 de 2"
								]
							})] })]
						})]
					}), /* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: onClose,
						className: "p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-colors",
						"aria-label": "Fechar",
						children: /* @__PURE__ */ jsx(X, { className: "w-5 h-5" })
					})]
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "overflow-y-auto py-3 space-y-2.5 flex-1 pr-1",
					children: [step === "select_scorer" && /* @__PURE__ */ jsxs(Fragment$1, { children: [/* @__PURE__ */ jsx("div", {
						className: "grid grid-cols-1 sm:grid-cols-2 gap-2",
						children: teamPlayers.map((player) => /* @__PURE__ */ jsxs("button", {
							type: "button",
							onClick: () => handleSelectScorer(player),
							className: "min-h-[52px] w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-gray-800/80 hover:bg-gray-700 active:scale-[0.98] border border-gray-700/60 hover:border-emerald-500/50 text-left transition-all touch-press-scale group",
							children: [/* @__PURE__ */ jsxs("div", {
								className: "flex items-center gap-3",
								children: [/* @__PURE__ */ jsx("div", {
									className: "w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-gray-300 font-bold text-xs group-hover:bg-emerald-500 group-hover:text-gray-950 transition-colors",
									children: /* @__PURE__ */ jsx(User, { className: "w-4 h-4" })
								}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("span", {
									className: "font-semibold text-white text-sm sm:text-base block",
									children: player.nickname || player.name
								}), player.nickname && player.name && /* @__PURE__ */ jsx("span", {
									className: "text-xs text-gray-400 block -mt-0.5",
									children: player.name
								})] })]
							}), /* @__PURE__ */ jsx("span", {
								className: "text-xs font-bold px-2 py-1 rounded bg-gray-700/50 text-emerald-400 opacity-80 group-hover:opacity-100",
								children: "GOL ⚽"
							})]
						}, player.id))
					}), /* @__PURE__ */ jsx("div", {
						className: "pt-2",
						children: /* @__PURE__ */ jsxs("button", {
							type: "button",
							onClick: handleSelectOwnGoal,
							className: "min-h-[48px] w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-rose-950/40 hover:bg-rose-900/50 active:scale-[0.98] border border-rose-800/40 text-rose-300 font-bold text-sm transition-all touch-press-scale",
							children: [/* @__PURE__ */ jsx(ShieldAlert, { className: "w-4 h-4" }), /* @__PURE__ */ jsx("span", { children: "Registrar Gol Contra (Adversário)" })]
						})
					})] }), step === "select_assist" && /* @__PURE__ */ jsxs(Fragment$1, { children: [
						/* @__PURE__ */ jsxs("button", {
							type: "button",
							onClick: () => handleSelectAssist(null),
							className: "min-h-[54px] w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-gray-950 font-extrabold text-sm sm:text-base shadow-lg shadow-emerald-500/20 transition-all touch-press-scale mb-3",
							children: [/* @__PURE__ */ jsx(Sparkles, { className: "w-5 h-5 fill-current" }), /* @__PURE__ */ jsx("span", { children: "Sem Assistência (Jogada Individual)" })]
						}),
						/* @__PURE__ */ jsx("div", {
							className: "text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 pt-1 pb-1",
							children: "Ou selecione o garçom:"
						}),
						/* @__PURE__ */ jsx("div", {
							className: "grid grid-cols-1 sm:grid-cols-2 gap-2",
							children: assistCandidates.map((player) => /* @__PURE__ */ jsxs("button", {
								type: "button",
								onClick: () => handleSelectAssist(player),
								className: "min-h-[50px] w-full flex items-center justify-between px-4 py-2.5 rounded-2xl bg-gray-800/80 hover:bg-gray-700 active:scale-[0.98] border border-gray-700/60 hover:border-cyan-500/50 text-left transition-all touch-press-scale group",
								children: [/* @__PURE__ */ jsxs("div", {
									className: "flex items-center gap-3",
									children: [/* @__PURE__ */ jsx("div", {
										className: "w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-gray-300 font-bold text-xs group-hover:bg-cyan-400 group-hover:text-gray-950 transition-colors",
										children: /* @__PURE__ */ jsx(User, { className: "w-4 h-4" })
									}), /* @__PURE__ */ jsx("span", {
										className: "font-semibold text-white text-sm",
										children: player.nickname || player.name
									})]
								}), /* @__PURE__ */ jsx("span", {
									className: "text-xs font-semibold px-2 py-0.5 rounded bg-gray-700/50 text-cyan-400",
									children: "Passe 👟"
								})]
							}, player.id))
						})
					] })]
				})
			]
		})]
	});
};
//#endregion
//#region src/components/live/QuickPlayerTransferModal.tsx
var QuickPlayerTransferModal = ({ isOpen, teams, currentHomeTeamId, currentAwayTeamId, onTransfer, onClose }) => {
	const [fromTeamId, setFromTeamId] = useState("");
	const [toTeamId, setToTeamId] = useState("");
	const [selectedPlayerId, setSelectedPlayerId] = useState("");
	const [isLoaned, setIsLoaned] = useState(true);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [errorMsg, setErrorMsg] = useState(null);
	useEffect(() => {
		if (isOpen && teams.length >= 2) {
			const defaultFrom = teams[0].id;
			const defaultTo = teams.find((t) => t.id !== defaultFrom)?.id || teams[1].id;
			setFromTeamId(defaultFrom);
			setToTeamId(defaultTo);
			setSelectedPlayerId("");
			setIsLoaned(true);
			setErrorMsg(null);
			setIsSubmitting(false);
		}
	}, [isOpen, teams]);
	if (!isOpen) return null;
	const sourceTeam = teams.find((t) => t.id === fromTeamId);
	teams.find((t) => t.id === toTeamId);
	const availablePlayers = sourceTeam?.players || [];
	const handleConfirm = async () => {
		if (!fromTeamId || !toTeamId) {
			setErrorMsg("Selecione os times de origem e destino.");
			return;
		}
		if (fromTeamId === toTeamId) {
			setErrorMsg("Os times de origem e destino devem ser diferentes.");
			return;
		}
		if (!selectedPlayerId) {
			setErrorMsg("Selecione o jogador a ser transferido.");
			return;
		}
		try {
			setIsSubmitting(true);
			setErrorMsg(null);
			hapticFeedback.click();
			soundFx.playClickBeep("high");
			await onTransfer({
				fromTeamId,
				toTeamId,
				playerId: selectedPlayerId,
				isLoaned
			});
			onClose();
		} catch (err) {
			const message = err instanceof Error ? err.message : "Erro ao transferir atleta.";
			setErrorMsg(message);
		} finally {
			setIsSubmitting(false);
		}
	};
	return /* @__PURE__ */ jsxs("div", {
		className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in",
		children: [/* @__PURE__ */ jsx("div", {
			className: "absolute inset-0",
			onClick: onClose,
			"aria-hidden": "true"
		}), /* @__PURE__ */ jsxs("div", {
			className: "relative z-10 w-full max-w-md rounded-3xl glass-card-glow bg-surface-100 border border-white/10 p-5 sm:p-6 shadow-2xl animate-scale-up",
			children: [
				/* @__PURE__ */ jsxs("div", {
					className: "flex items-center justify-between pb-3 border-b border-gray-800",
					children: [/* @__PURE__ */ jsxs("div", {
						className: "flex items-center gap-2.5",
						children: [/* @__PURE__ */ jsx("div", {
							className: "w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center",
							children: /* @__PURE__ */ jsx(ArrowRightLeft, { className: "w-5 h-5" })
						}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h3", {
							className: "text-base sm:text-lg font-bold text-white leading-snug",
							children: "Emprestar / Transferir Atleta"
						}), /* @__PURE__ */ jsx("p", {
							className: "text-xs text-gray-400",
							children: "Ajuste rápido de escalação para o jogo"
						})] })]
					}), /* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: onClose,
						className: "p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-colors",
						"aria-label": "Fechar",
						children: /* @__PURE__ */ jsx(X, { className: "w-5 h-5" })
					})]
				}),
				errorMsg && /* @__PURE__ */ jsxs("div", {
					className: "mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2",
					children: [/* @__PURE__ */ jsx(AlertCircle, { className: "w-4 h-4 shrink-0" }), /* @__PURE__ */ jsx("span", { children: errorMsg })]
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "grid grid-cols-2 gap-3 my-4",
					children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
						className: "block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider",
						children: "Time de Origem"
					}), /* @__PURE__ */ jsx("select", {
						value: fromTeamId,
						onChange: (e) => {
							const newFrom = e.target.value;
							setFromTeamId(newFrom);
							setSelectedPlayerId("");
							if (newFrom === toTeamId) {
								const alt = teams.find((t) => t.id !== newFrom)?.id || "";
								setToTeamId(alt);
							}
						},
						className: "w-full min-h-[46px] px-3 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white font-medium text-sm focus:outline-none focus:border-blue-500 transition-colors",
						children: teams.map((t) => /* @__PURE__ */ jsxs("option", {
							value: t.id,
							children: [
								t.name,
								" (",
								t.players?.length || 0,
								")"
							]
						}, t.id))
					})] }), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
						className: "block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider",
						children: "Time de Destino"
					}), /* @__PURE__ */ jsx("select", {
						value: toTeamId,
						onChange: (e) => setToTeamId(e.target.value),
						className: "w-full min-h-[46px] px-3 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white font-medium text-sm focus:outline-none focus:border-blue-500 transition-colors",
						children: teams.filter((t) => t.id !== fromTeamId).map((t) => /* @__PURE__ */ jsxs("option", {
							value: t.id,
							children: [
								t.name,
								" (",
								t.players?.length || 0,
								")"
							]
						}, t.id))
					})] })]
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "mb-4",
					children: [/* @__PURE__ */ jsxs("label", {
						className: "block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider",
						children: [
							"Selecione o Atleta (",
							sourceTeam?.name,
							")"
						]
					}), availablePlayers.length === 0 ? /* @__PURE__ */ jsx("div", {
						className: "p-4 rounded-xl bg-gray-800/40 text-center text-xs text-gray-400 border border-dashed border-gray-700",
						children: "Nenhum jogador disponível neste time."
					}) : /* @__PURE__ */ jsx("div", {
						className: "grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1",
						children: availablePlayers.map((player) => {
							const isSelected = selectedPlayerId === player.id;
							return /* @__PURE__ */ jsxs("button", {
								type: "button",
								onClick: () => {
									hapticFeedback.click();
									setSelectedPlayerId(player.id);
								},
								className: cn("min-h-[46px] flex items-center justify-between px-3 py-2 rounded-xl text-left font-medium text-xs sm:text-sm transition-all touch-press-scale border", isSelected ? "bg-blue-600/30 border-blue-500 text-white font-bold shadow-sm" : "bg-gray-800/80 border-gray-700/60 text-gray-300 hover:bg-gray-700/80"),
								children: [/* @__PURE__ */ jsx("span", {
									className: "truncate",
									children: player.nickname || player.name
								}), isSelected && /* @__PURE__ */ jsx(Check, { className: "w-4 h-4 text-blue-400 shrink-0 ml-1" })]
							}, player.id);
						})
					})]
				}),
				/* @__PURE__ */ jsxs("div", {
					onClick: () => setIsLoaned(!isLoaned),
					className: "flex items-center justify-between p-3.5 rounded-2xl bg-gray-800/60 border border-gray-700/60 mb-5 cursor-pointer select-none hover:bg-gray-800/90 transition-colors",
					children: [/* @__PURE__ */ jsxs("div", {
						className: "pr-3",
						children: [/* @__PURE__ */ jsx("span", {
							className: "text-sm font-semibold text-white block",
							children: "Empréstimo Temporário (Esta Partida)"
						}), /* @__PURE__ */ jsx("span", {
							className: "text-xs text-gray-400 block mt-0.5",
							children: "Gols contam para o ranking individual do atleta."
						})]
					}), /* @__PURE__ */ jsx("div", {
						className: cn("w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 shrink-0", isLoaned ? "bg-blue-600" : "bg-gray-600"),
						children: /* @__PURE__ */ jsx("div", { className: cn("w-5 h-5 rounded-full bg-white transition-transform shadow-md", isLoaned ? "translate-x-5" : "translate-x-0") })
					})]
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "grid grid-cols-2 gap-3",
					children: [/* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: onClose,
						className: "min-h-[48px] px-4 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold text-sm transition-colors border border-gray-700",
						children: "Cancelar"
					}), /* @__PURE__ */ jsxs("button", {
						type: "button",
						disabled: !selectedPlayerId || isSubmitting,
						onClick: handleConfirm,
						className: "min-h-[48px] flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-40 disabled:pointer-events-none text-white font-bold text-sm shadow-lg shadow-blue-600/20 transition-all touch-press-scale",
						children: [/* @__PURE__ */ jsx(UserCheck, { className: "w-4 h-4" }), /* @__PURE__ */ jsx("span", { children: isSubmitting ? "Transferindo..." : "Confirmar" })]
					})]
				})
			]
		})]
	});
};
//#endregion
//#region src/components/live/LiveScoreboard.tsx
var DEFAULT_HOME_TEAM = {
	id: "team-preto",
	name: "Time Preto",
	colorHex: "#1f2937",
	players: [
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
		}
	]
};
var DEFAULT_AWAY_TEAM = {
	id: "team-branco",
	name: "Time Branco",
	colorHex: "#e5e7eb",
	players: [
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
		}
	]
};
var LiveScoreboard = ({ initialMatchId = "match-live-01", sessionId = "session-current", sessionTitle = "Pelada das Quintas", homeTeam = DEFAULT_HOME_TEAM, awayTeam = DEFAULT_AWAY_TEAM, allSessionTeams = [DEFAULT_HOME_TEAM, DEFAULT_AWAY_TEAM], onGoalRegistered, onFinishMatch, onNextMatch, onTransferPlayer }) => {
	const [matchState, setMatchState] = useState(() => {
		return {
			id: initialMatchId,
			sessionId,
			homeTeam,
			awayTeam,
			allSessionTeams,
			homeScore: 0,
			awayScore: 0,
			secondsRemaining: 420,
			durationSeconds: 0,
			status: "ongoing",
			endReason: null,
			events: [],
			isTimerRunning: false,
			startedAt: (/* @__PURE__ */ new Date()).toISOString(),
			finishedAt: null
		};
	});
	const [isGoalDrawerOpen, setIsGoalDrawerOpen] = useState(false);
	const [selectedScoringTeam, setSelectedScoringTeam] = useState(null);
	const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
	const [isVictoryModalOpen, setIsVictoryModalOpen] = useState(false);
	const [isRestoreBannerVisible, setIsRestoreBannerVisible] = useState(false);
	const [lastSavedTime, setLastSavedTime] = useState(null);
	const timerIntervalRef = useRef(null);
	const persistState = useCallback((state) => {
		if (typeof window === "undefined") return;
		try {
			const payload = {
				version: 1,
				match: state,
				pendingSyncEvents: state.events,
				savedAt: (/* @__PURE__ */ new Date()).toISOString()
			};
			localStorage.setItem(ACTIVE_MATCH_STORAGE_KEY, JSON.stringify(payload));
			setLastSavedTime((/* @__PURE__ */ new Date()).toLocaleTimeString("pt-BR", {
				hour: "2-digit",
				minute: "2-digit",
				second: "2-digit"
			}));
		} catch {}
	}, []);
	useEffect(() => {
		if (typeof window === "undefined") return;
		try {
			const raw = localStorage.getItem(ACTIVE_MATCH_STORAGE_KEY);
			if (raw) {
				const parsed = JSON.parse(raw);
				if (parsed?.match && parsed.match.status === "ongoing") {
					setMatchState(parsed.match);
					setIsRestoreBannerVisible(true);
					setLastSavedTime(new Date(parsed.savedAt).toLocaleTimeString("pt-BR"));
				}
			}
		} catch {}
	}, []);
	useEffect(() => {
		if (matchState.isTimerRunning && matchState.status === "ongoing") timerIntervalRef.current = window.setInterval(() => {
			setMatchState((prev) => {
				if (prev.secondsRemaining <= 1) {
					if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
					const finishedState = {
						...prev,
						secondsRemaining: 0,
						durationSeconds: 420,
						isTimerRunning: false,
						status: "finished",
						endReason: "time_limit",
						finishedAt: (/* @__PURE__ */ new Date()).toISOString()
					};
					persistState(finishedState);
					setIsVictoryModalOpen(true);
					return finishedState;
				}
				const nextRemaining = prev.secondsRemaining - 1;
				const nextDuration = prev.durationSeconds + 1;
				const nextState = {
					...prev,
					secondsRemaining: nextRemaining,
					durationSeconds: nextDuration
				};
				if (nextRemaining % 5 === 0) persistState(nextState);
				return nextState;
			});
		}, 1e3);
		else if (timerIntervalRef.current) {
			clearInterval(timerIntervalRef.current);
			timerIntervalRef.current = null;
		}
		return () => {
			if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
		};
	}, [
		matchState.isTimerRunning,
		matchState.status,
		persistState
	]);
	const handleToggleTimer = () => {
		setMatchState((prev) => {
			const next = {
				...prev,
				isTimerRunning: !prev.isTimerRunning
			};
			persistState(next);
			return next;
		});
	};
	const handleAddMinute = () => {
		setMatchState((prev) => {
			const nextRemaining = Math.min(420, prev.secondsRemaining + 60);
			const next = {
				...prev,
				secondsRemaining: nextRemaining
			};
			persistState(next);
			return next;
		});
	};
	const handleResetTimer = () => {
		setMatchState((prev) => {
			const next = {
				...prev,
				secondsRemaining: 420,
				durationSeconds: 0,
				isTimerRunning: false
			};
			persistState(next);
			return next;
		});
	};
	const handleTimeExpired = () => {
		setMatchState((prev) => {
			const finished = {
				...prev,
				secondsRemaining: 0,
				status: "finished",
				endReason: "time_limit",
				isTimerRunning: false,
				finishedAt: (/* @__PURE__ */ new Date()).toISOString()
			};
			persistState(finished);
			setIsVictoryModalOpen(true);
			return finished;
		});
	};
	const handleOpenGoalDrawer = (team) => {
		if (matchState.status === "finished") return;
		hapticFeedback.click();
		soundFx.playClickBeep("normal");
		setSelectedScoringTeam(team);
		setIsGoalDrawerOpen(true);
	};
	const handleConfirmGoal = async (data) => {
		const isHome = data.teamId === matchState.homeTeam.id;
		const nextHomeScore = isHome ? matchState.homeScore + 1 : matchState.homeScore;
		const nextAwayScore = !isHome ? matchState.awayScore + 1 : matchState.awayScore;
		const scoringTeam = isHome ? matchState.homeTeam : matchState.awayTeam;
		const newEvent = {
			clientEventId: `event-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
			matchId: matchState.id,
			teamId: data.teamId,
			scorerId: data.scorerId ?? null,
			assistId: data.assistId ?? null,
			eventTimeSeconds: matchState.durationSeconds,
			isOwnGoal: data.isOwnGoal,
			scorerName: data.scorerName,
			assistName: data.assistName,
			teamName: scoringTeam.name,
			createdAt: (/* @__PURE__ */ new Date()).toISOString()
		};
		const isTwoGoalsReached = nextHomeScore >= 2 || nextAwayScore >= 2;
		const nextStatus = isTwoGoalsReached ? "finished" : matchState.status;
		const nextEndReason = isTwoGoalsReached ? "two_goals" : matchState.endReason;
		const updatedState = {
			...matchState,
			homeScore: nextHomeScore,
			awayScore: nextAwayScore,
			status: nextStatus,
			endReason: nextEndReason,
			isTimerRunning: isTwoGoalsReached ? false : matchState.isTimerRunning,
			finishedAt: isTwoGoalsReached ? (/* @__PURE__ */ new Date()).toISOString() : matchState.finishedAt,
			events: [newEvent, ...matchState.events]
		};
		setMatchState(updatedState);
		persistState(updatedState);
		if (onGoalRegistered) try {
			await onGoalRegistered(newEvent);
		} catch {}
		if (isTwoGoalsReached) {
			soundFx.playVictoryFanfare();
			hapticFeedback.victory();
			setIsVictoryModalOpen(true);
			if (onFinishMatch) onFinishMatch(updatedState);
		}
	};
	const handleUndoLastGoal = () => {
		if (matchState.events.length === 0) return;
		hapticFeedback.cancel();
		soundFx.playClickBeep("low");
		const isHome = matchState.events[0].teamId === matchState.homeTeam.id;
		const nextHomeScore = isHome ? Math.max(0, matchState.homeScore - 1) : matchState.homeScore;
		const nextAwayScore = !isHome ? Math.max(0, matchState.awayScore - 1) : matchState.awayScore;
		const updatedEvents = matchState.events.slice(1);
		const updatedState = {
			...matchState,
			homeScore: nextHomeScore,
			awayScore: nextAwayScore,
			events: updatedEvents,
			status: "ongoing",
			endReason: null,
			finishedAt: null
		};
		setMatchState(updatedState);
		persistState(updatedState);
		setIsVictoryModalOpen(false);
	};
	const handleManualFinish = () => {
		hapticFeedback.timeExpired();
		soundFx.playWhistle();
		const finishedState = {
			...matchState,
			status: "finished",
			endReason: "manual",
			isTimerRunning: false,
			finishedAt: (/* @__PURE__ */ new Date()).toISOString()
		};
		setMatchState(finishedState);
		persistState(finishedState);
		setIsVictoryModalOpen(true);
		if (onFinishMatch) onFinishMatch(finishedState);
	};
	const handleResetMatch = () => {
		if (typeof window !== "undefined") {
			if (!window.confirm("Deseja zerar o placar e reiniciar esta partida?")) return;
		}
		hapticFeedback.click();
		soundFx.playClickBeep("low");
		const resetState = {
			...matchState,
			homeScore: 0,
			awayScore: 0,
			secondsRemaining: 420,
			durationSeconds: 0,
			status: "ongoing",
			endReason: null,
			events: [],
			isTimerRunning: false,
			startedAt: (/* @__PURE__ */ new Date()).toISOString(),
			finishedAt: null
		};
		setMatchState(resetState);
		persistState(resetState);
		setIsVictoryModalOpen(false);
	};
	const handleTransferPlayer = async (data) => {
		let transferredPlayer;
		const updatedTeams = (matchState.allSessionTeams || [matchState.homeTeam, matchState.awayTeam]).map((team) => {
			if (team.id === data.fromTeamId) {
				transferredPlayer = team.players.find((p) => p.id === data.playerId);
				return {
					...team,
					players: team.players.filter((p) => p.id !== data.playerId)
				};
			}
			return team;
		});
		if (!transferredPlayer) return;
		const modifiedPlayer = {
			...transferredPlayer,
			isLoaned: data.isLoaned,
			originalTeamId: data.fromTeamId
		};
		const finalTeams = updatedTeams.map((team) => {
			if (team.id === data.toTeamId) return {
				...team,
				players: [...team.players, modifiedPlayer]
			};
			return team;
		});
		const newHomeTeam = finalTeams.find((t) => t.id === matchState.homeTeam.id) || matchState.homeTeam;
		const newAwayTeam = finalTeams.find((t) => t.id === matchState.awayTeam.id) || matchState.awayTeam;
		const updatedState = {
			...matchState,
			homeTeam: newHomeTeam,
			awayTeam: newAwayTeam,
			allSessionTeams: finalTeams
		};
		setMatchState(updatedState);
		persistState(updatedState);
		if (onTransferPlayer) await onTransferPlayer(data);
	};
	const winningTeam = matchState.homeScore > matchState.awayScore ? matchState.homeTeam : matchState.awayScore > matchState.homeScore ? matchState.awayTeam : null;
	return /* @__PURE__ */ jsxs("div", {
		className: "w-full max-w-xl mx-auto px-3.5 sm:px-4 py-4 space-y-4 pb-20 select-none",
		children: [
			isRestoreBannerVisible && /* @__PURE__ */ jsxs("div", {
				className: "flex items-center justify-between p-3 rounded-2xl bg-blue-950/40 border border-blue-500/30 text-blue-300 text-xs animate-fade-in",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ jsx(Save, { className: "w-4 h-4 text-blue-400 shrink-0" }), /* @__PURE__ */ jsxs("span", { children: [
						"Partida restaurada do cache offline ",
						lastSavedTime && `(salva às ${lastSavedTime})`,
						"."
					] })]
				}), /* @__PURE__ */ jsx("button", {
					type: "button",
					onClick: () => setIsRestoreBannerVisible(false),
					className: "text-blue-400 hover:text-white text-xs font-bold px-2 py-1",
					children: "OK"
				})]
			}),
			/* @__PURE__ */ jsxs("header", {
				className: "flex items-center justify-between px-1",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "flex items-center gap-2.5",
					children: [/* @__PURE__ */ jsx("div", {
						className: "w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-black text-sm",
						children: "⚽"
					}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsxs("h1", {
						className: "text-base sm:text-lg font-black text-white uppercase tracking-wider flex items-center gap-1.5",
						children: [/* @__PURE__ */ jsx("span", { children: sessionTitle }), /* @__PURE__ */ jsx("span", { className: "w-2 h-2 rounded-full bg-emerald-400 animate-pulse" })]
					}), /* @__PURE__ */ jsx("p", {
						className: "text-xs text-gray-400 font-medium",
						children: "Modo Mesário • Mini-jogo de 7 min"
					})] })]
				}), /* @__PURE__ */ jsxs("div", {
					className: "flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-800/80 border border-gray-700 text-xs font-semibold text-emerald-400",
					title: "Dados salvos automaticamente em cache offline",
					children: [
						/* @__PURE__ */ jsx(Check, { className: "w-3.5 h-3.5" }),
						/* @__PURE__ */ jsx("span", {
							className: "hidden sm:inline",
							children: "Offline-First"
						}),
						/* @__PURE__ */ jsx("span", {
							className: "sm:hidden",
							children: "Auto"
						})
					]
				})]
			}),
			/* @__PURE__ */ jsx(MatchTimer, {
				secondsRemaining: matchState.secondsRemaining,
				isRunning: matchState.isTimerRunning,
				onToggleRunning: handleToggleTimer,
				onAddMinute: handleAddMinute,
				onReset: handleResetTimer,
				onTimeExpired: handleTimeExpired,
				disabled: matchState.status === "finished"
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "grid grid-cols-2 gap-3 sm:gap-4",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "rounded-3xl glass-card p-4 sm:p-5 flex flex-col items-center justify-between border-t-4 transition-all duration-200",
					style: { borderTopColor: matchState.homeTeam.colorHex },
					children: [
						/* @__PURE__ */ jsxs("div", {
							className: "flex flex-col items-center text-center w-full",
							children: [
								/* @__PURE__ */ jsx("span", {
									className: "w-3.5 h-3.5 rounded-full border border-white/20 mb-1",
									style: { backgroundColor: matchState.homeTeam.colorHex }
								}),
								/* @__PURE__ */ jsx("h2", {
									className: "font-extrabold text-white text-sm sm:text-base truncate w-full",
									children: matchState.homeTeam.name
								}),
								/* @__PURE__ */ jsxs("span", {
									className: "text-[11px] text-gray-400 font-medium",
									children: [matchState.homeTeam.players.length, " atletas"]
								})
							]
						}),
						/* @__PURE__ */ jsx("div", {
							className: "my-3 font-display text-6xl sm:text-7xl font-black text-white tracking-tight drop-shadow-md",
							children: matchState.homeScore
						}),
						/* @__PURE__ */ jsxs("button", {
							type: "button",
							disabled: matchState.status === "finished",
							onClick: () => handleOpenGoalDrawer(matchState.homeTeam),
							className: "w-full min-h-[54px] sm:min-h-[58px] flex items-center justify-center gap-1.5 px-3 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 disabled:opacity-30 disabled:pointer-events-none text-gray-950 font-black text-sm sm:text-base shadow-lg shadow-emerald-500/25 transition-all touch-press-scale",
							"aria-label": `Adicionar gol para ${matchState.homeTeam.name}`,
							children: [/* @__PURE__ */ jsx("span", {
								className: "text-lg",
								children: "⚽"
							}), /* @__PURE__ */ jsx("span", { children: "+ GOL" })]
						})
					]
				}), /* @__PURE__ */ jsxs("div", {
					className: "rounded-3xl glass-card p-4 sm:p-5 flex flex-col items-center justify-between border-t-4 transition-all duration-200",
					style: { borderTopColor: matchState.awayTeam.colorHex },
					children: [
						/* @__PURE__ */ jsxs("div", {
							className: "flex flex-col items-center text-center w-full",
							children: [
								/* @__PURE__ */ jsx("span", {
									className: "w-3.5 h-3.5 rounded-full border border-white/20 mb-1",
									style: { backgroundColor: matchState.awayTeam.colorHex }
								}),
								/* @__PURE__ */ jsx("h2", {
									className: "font-extrabold text-white text-sm sm:text-base truncate w-full",
									children: matchState.awayTeam.name
								}),
								/* @__PURE__ */ jsxs("span", {
									className: "text-[11px] text-gray-400 font-medium",
									children: [matchState.awayTeam.players.length, " atletas"]
								})
							]
						}),
						/* @__PURE__ */ jsx("div", {
							className: "my-3 font-display text-6xl sm:text-7xl font-black text-white tracking-tight drop-shadow-md",
							children: matchState.awayScore
						}),
						/* @__PURE__ */ jsxs("button", {
							type: "button",
							disabled: matchState.status === "finished",
							onClick: () => handleOpenGoalDrawer(matchState.awayTeam),
							className: "w-full min-h-[54px] sm:min-h-[58px] flex items-center justify-center gap-1.5 px-3 py-3.5 rounded-2xl bg-cyan-400 hover:bg-cyan-300 active:scale-95 disabled:opacity-30 disabled:pointer-events-none text-gray-950 font-black text-sm sm:text-base shadow-lg shadow-cyan-400/25 transition-all touch-press-scale",
							"aria-label": `Adicionar gol para ${matchState.awayTeam.name}`,
							children: [/* @__PURE__ */ jsx("span", {
								className: "text-lg",
								children: "⚽"
							}), /* @__PURE__ */ jsx("span", { children: "+ GOL" })]
						})
					]
				})]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "rounded-2xl glass-card p-4",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "flex items-center justify-between pb-2 mb-2 border-b border-gray-800",
					children: [/* @__PURE__ */ jsxs("div", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ jsx(Flame, { className: "w-4 h-4 text-amber-400" }), /* @__PURE__ */ jsxs("h3", {
							className: "text-xs sm:text-sm font-bold text-gray-200 uppercase tracking-wider",
							children: [
								"Lances da Partida (",
								matchState.events.length,
								")"
							]
						})]
					}), matchState.events.length > 0 && /* @__PURE__ */ jsxs("button", {
						type: "button",
						onClick: handleUndoLastGoal,
						className: "flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 active:scale-95 text-rose-400 hover:text-rose-300 font-semibold text-xs transition-all border border-gray-700",
						title: "Anular o último gol registrado",
						children: [/* @__PURE__ */ jsx(Undo2, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ jsx("span", { children: "Desfazer Gol" })]
					})]
				}), matchState.events.length === 0 ? /* @__PURE__ */ jsx("p", {
					className: "text-xs text-gray-500 text-center py-4 font-medium italic",
					children: "Nenhum gol registrado até o momento. A partida está 0 x 0."
				}) : /* @__PURE__ */ jsx("div", {
					className: "space-y-2 max-h-48 overflow-y-auto pr-1",
					children: matchState.events.map((ev, index) => {
						const mins = Math.floor(ev.eventTimeSeconds / 60);
						const secs = ev.eventTimeSeconds % 60;
						const formattedTime = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
						const isFirst = index === 0;
						return /* @__PURE__ */ jsxs("div", {
							className: cn("flex items-center justify-between p-2.5 rounded-xl border text-xs sm:text-sm transition-all", isFirst ? "bg-gray-800/90 border-emerald-500/40 text-white shadow-sm" : "bg-gray-800/40 border-gray-800 text-gray-300"),
							children: [/* @__PURE__ */ jsxs("div", {
								className: "flex items-center gap-2.5",
								children: [/* @__PURE__ */ jsx("span", {
									className: "font-mono text-xs font-bold px-2 py-0.5 rounded bg-gray-900 text-gray-400 border border-gray-700",
									children: formattedTime
								}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsxs("div", {
									className: "font-bold flex items-center gap-1.5",
									children: [
										/* @__PURE__ */ jsx("span", { children: ev.isOwnGoal ? "🛡️" : "⚽" }),
										/* @__PURE__ */ jsx("span", {
											className: ev.isOwnGoal ? "text-rose-400" : "text-emerald-400",
											children: ev.scorerName || "Gol"
										}),
										/* @__PURE__ */ jsxs("span", {
											className: "text-gray-400 font-normal text-xs",
											children: [
												"(",
												ev.teamName,
												")"
											]
										})
									]
								}), ev.assistName && /* @__PURE__ */ jsxs("div", {
									className: "text-[11px] text-cyan-300 font-medium",
									children: ["Assistência: ", ev.assistName]
								})] })]
							}), isFirst && /* @__PURE__ */ jsx("span", {
								className: "text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded",
								children: "Último"
							})]
						}, ev.clientEventId || index);
					})
				})]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "grid grid-cols-2 gap-2.5 pt-1",
				children: [/* @__PURE__ */ jsxs("button", {
					type: "button",
					onClick: () => {
						hapticFeedback.click();
						setIsTransferModalOpen(true);
					},
					className: "min-h-[48px] flex items-center justify-center gap-2 px-3 py-3 rounded-2xl bg-gray-800/80 hover:bg-gray-700 active:scale-95 text-blue-400 font-bold text-xs sm:text-sm border border-gray-700 transition-all touch-press-scale",
					children: [/* @__PURE__ */ jsx(ArrowRightLeft, { className: "w-4 h-4" }), /* @__PURE__ */ jsx("span", { children: "Emprestar Jogador" })]
				}), /* @__PURE__ */ jsxs("button", {
					type: "button",
					disabled: matchState.status === "finished",
					onClick: handleManualFinish,
					className: "min-h-[48px] flex items-center justify-center gap-2 px-3 py-3 rounded-2xl bg-gray-800/80 hover:bg-gray-700 active:scale-95 disabled:opacity-40 text-rose-400 font-bold text-xs sm:text-sm border border-gray-700 transition-all touch-press-scale",
					children: [/* @__PURE__ */ jsx(Square, { className: "w-4 h-4 fill-current" }), /* @__PURE__ */ jsx("span", { children: "Encerrar Partida" })]
				})]
			}),
			/* @__PURE__ */ jsx(GoalDrawer, {
				isOpen: isGoalDrawerOpen,
				team: selectedScoringTeam,
				opponentTeam: selectedScoringTeam?.id === matchState.homeTeam.id ? matchState.awayTeam : matchState.homeTeam,
				onConfirmGoal: handleConfirmGoal,
				onClose: () => setIsGoalDrawerOpen(false)
			}),
			/* @__PURE__ */ jsx(QuickPlayerTransferModal, {
				isOpen: isTransferModalOpen,
				teams: matchState.allSessionTeams || [matchState.homeTeam, matchState.awayTeam],
				currentHomeTeamId: matchState.homeTeam.id,
				currentAwayTeamId: matchState.awayTeam.id,
				onTransfer: handleTransferPlayer,
				onClose: () => setIsTransferModalOpen(false)
			}),
			isVictoryModalOpen && /* @__PURE__ */ jsx("div", {
				className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in",
				children: /* @__PURE__ */ jsxs("div", {
					className: "relative w-full max-w-sm rounded-3xl glass-card-glow bg-surface-100 border border-emerald-500/40 p-6 text-center shadow-2xl animate-scale-up",
					children: [
						/* @__PURE__ */ jsx("div", {
							className: "w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-4 border border-emerald-500/30",
							children: /* @__PURE__ */ jsx(Trophy, { className: "w-8 h-8" })
						}),
						/* @__PURE__ */ jsx("span", {
							className: "px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 text-xs font-bold uppercase tracking-wider border border-emerald-500/20 inline-block mb-2",
							children: matchState.endReason === "two_goals" ? "⚡ Regra dos 2 Gols" : matchState.endReason === "time_limit" ? "⏱ Fim do Tempo Oficial" : "⏹ Partida Encerrada"
						}),
						/* @__PURE__ */ jsx("h2", {
							className: "text-xl sm:text-2xl font-black text-white mt-1 mb-1",
							children: winningTeam ? `${winningTeam.name} Venceu!` : "Empate na Partida!"
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "my-4 p-4 rounded-2xl bg-gray-900/80 border border-gray-800",
							children: [
								/* @__PURE__ */ jsx("div", {
									className: "text-xs text-gray-400 mb-1 font-semibold uppercase",
									children: "Placar Final"
								}),
								/* @__PURE__ */ jsxs("div", {
									className: "font-display text-4xl font-black text-white",
									children: [
										matchState.homeTeam.name,
										" ",
										matchState.homeScore,
										" x ",
										matchState.awayScore,
										" ",
										matchState.awayTeam.name
									]
								}),
								/* @__PURE__ */ jsxs("div", {
									className: "text-xs text-gray-400 mt-2",
									children: [
										"Duração total: ",
										Math.floor(matchState.durationSeconds / 60),
										"m",
										" ",
										matchState.durationSeconds % 60,
										"s"
									]
								})
							]
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "space-y-2 pt-2",
							children: [onNextMatch ? /* @__PURE__ */ jsxs("button", {
								type: "button",
								onClick: () => {
									hapticFeedback.click();
									setIsVictoryModalOpen(false);
									onNextMatch();
								},
								className: "w-full min-h-[50px] flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-gray-950 font-black text-base shadow-lg shadow-emerald-500/25 transition-all touch-press-scale",
								children: [/* @__PURE__ */ jsx("span", { children: "Avançar para Próximo Jogo" }), /* @__PURE__ */ jsx(ChevronRight, { className: "w-5 h-5" })]
							}) : /* @__PURE__ */ jsxs("button", {
								type: "button",
								onClick: () => {
									hapticFeedback.click();
									setIsVictoryModalOpen(false);
								},
								className: "w-full min-h-[50px] flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-gray-950 font-black text-base shadow-lg shadow-emerald-500/25 transition-all touch-press-scale",
								children: [/* @__PURE__ */ jsx(CheckCircle2, { className: "w-5 h-5" }), /* @__PURE__ */ jsx("span", { children: "Concluir Partida" })]
							}), /* @__PURE__ */ jsxs("button", {
								type: "button",
								onClick: handleResetMatch,
								className: "w-full min-h-[44px] flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gray-800/80 hover:bg-gray-700 text-gray-300 font-semibold text-xs transition-colors",
								children: [/* @__PURE__ */ jsx(RotateCcw, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ jsx("span", { children: "Reiniciar este mesmo jogo" })]
							})]
						})
					]
				})
			})
		]
	});
};
//#endregion
//#region src/components/live/MesarioSessionWrapper.tsx
var MesarioSessionWrapper = ({ session }) => {
	const [activeSession, setActiveSession] = useState(session);
	const [activeMatchId, setActiveMatchId] = useState(null);
	const [selectedHomeTeamId, setSelectedHomeTeamId] = useState(session.teams[0]?.id || "team-1");
	const [selectedAwayTeamId, setSelectedAwayTeamId] = useState(session.teams[1]?.id || "team-2");
	const [isStartingMatch, setIsStartingMatch] = useState(false);
	const [lastFinishedMatch, setLastFinishedMatch] = useState(null);
	const homeTeam = activeSession.teams.find((t) => t.id === selectedHomeTeamId) || activeSession.teams[0];
	const awayTeam = activeSession.teams.find((t) => t.id === selectedAwayTeamId) || activeSession.teams[1];
	const handleStartNewMatch = async () => {
		if (selectedHomeTeamId === selectedAwayTeamId) {
			alert("Selecione dois times diferentes para o confronto.");
			return;
		}
		setIsStartingMatch(true);
		try {
			const res = await fetch("/api/matches/start", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					sessionId: activeSession.id,
					homeTeamId: selectedHomeTeamId,
					awayTeamId: selectedAwayTeamId
				})
			});
			if (!res.ok) throw new Error("Falha ao iniciar partida na API.");
			const data = await res.json();
			setActiveMatchId(data.id || `match-${Date.now()}`);
		} catch {
			setActiveMatchId(`match-${Date.now()}`);
		} finally {
			setIsStartingMatch(false);
		}
	};
	const handleGoalRegistered = async (event) => {
		if (!activeMatchId) return;
		try {
			await fetch(`/api/matches/${activeMatchId}/goals`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					teamId: event.teamId,
					scorerId: event.scorerId,
					assistId: event.assistId,
					eventTimeSeconds: event.eventTimeSeconds,
					isOwnGoal: event.isOwnGoal
				})
			});
		} catch {}
	};
	const handleFinishMatch = async (finishedMatch) => {
		setLastFinishedMatch(finishedMatch);
		if (!activeMatchId) return;
		try {
			await fetch(`/api/matches/${activeMatchId}/finish`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					durationSeconds: finishedMatch.durationSeconds,
					reason: finishedMatch.endReason || "manual"
				})
			});
		} catch {}
	};
	const handleTransferPlayer = async (data) => {
		try {
			await fetch(`/api/sessions/${activeSession.id}/transfer`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(data)
			});
		} catch {}
	};
	const handleNextMatch = () => {
		setActiveMatchId(null);
		if (lastFinishedMatch) {
			if (lastFinishedMatch.homeScore > lastFinishedMatch.awayScore) setSelectedHomeTeamId(lastFinishedMatch.homeTeam.id);
			else if (lastFinishedMatch.awayScore > lastFinishedMatch.homeScore) setSelectedHomeTeamId(lastFinishedMatch.awayTeam.id);
		}
	};
	if (activeMatchId && homeTeam && awayTeam) return /* @__PURE__ */ jsx(LiveScoreboard, {
		initialMatchId: activeMatchId,
		sessionId: activeSession.id,
		sessionTitle: `Pelada • ${activeSession.sessionDate}`,
		homeTeam,
		awayTeam,
		allSessionTeams: activeSession.teams,
		onGoalRegistered: handleGoalRegistered,
		onFinishMatch: handleFinishMatch,
		onNextMatch: handleNextMatch,
		onTransferPlayer: handleTransferPlayer
	});
	return /* @__PURE__ */ jsxs("div", {
		className: "w-full max-w-xl mx-auto space-y-6",
		children: [/* @__PURE__ */ jsxs("div", {
			className: "p-5 sm:p-6 rounded-3xl glass-card bg-surface-100/90 border border-white/10 shadow-xl text-center",
			children: [
				/* @__PURE__ */ jsxs("div", {
					className: "inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-black uppercase tracking-wider mb-2",
					children: [/* @__PURE__ */ jsx("span", { className: "w-2 h-2 rounded-full bg-emerald-400 animate-pulse" }), /* @__PURE__ */ jsx("span", { children: "Sessão em Andamento" })]
				}),
				/* @__PURE__ */ jsx("h2", {
					className: "font-display font-black text-2xl sm:text-3xl text-white",
					children: "Próximo Confronto"
				}),
				/* @__PURE__ */ jsxs("p", {
					className: "text-xs sm:text-sm text-gray-400 mt-1 flex items-center justify-center gap-1.5",
					children: [/* @__PURE__ */ jsx(Calendar, { className: "w-4 h-4 text-emerald-400" }), /* @__PURE__ */ jsxs("span", { children: ["Data da rodada: ", activeSession.sessionDate] })]
				})
			]
		}), /* @__PURE__ */ jsxs("div", {
			className: "p-5 sm:p-6 rounded-3xl glass-card bg-surface-100/90 border border-white/10 shadow-2xl space-y-6",
			children: [
				/* @__PURE__ */ jsxs("div", {
					className: "grid grid-cols-1 sm:grid-cols-2 gap-4 items-center",
					children: [/* @__PURE__ */ jsxs("div", {
						className: "space-y-2",
						children: [/* @__PURE__ */ jsx("label", {
							className: "block text-xs font-black uppercase tracking-wider text-gray-300",
							children: "Time 1 (Mandante)"
						}), /* @__PURE__ */ jsx("div", {
							className: "grid grid-cols-2 gap-2",
							children: activeSession.teams.map((t) => /* @__PURE__ */ jsxs("button", {
								type: "button",
								onClick: () => setSelectedHomeTeamId(t.id),
								className: cn("p-3 rounded-2xl border text-left transition-all flex flex-col justify-between min-h-[70px]", selectedHomeTeamId === t.id ? "border-emerald-400 bg-emerald-500/10 ring-2 ring-emerald-400/40 shadow-lg" : "border-white/5 bg-surface-200/60 hover:border-white/20"),
								children: [/* @__PURE__ */ jsxs("div", {
									className: "flex items-center gap-2",
									children: [/* @__PURE__ */ jsx("div", {
										className: "w-3 h-3 rounded-full border border-white/20",
										style: { backgroundColor: t.colorHex }
									}), /* @__PURE__ */ jsx("span", {
										className: "font-bold text-xs text-white truncate",
										children: t.name
									})]
								}), /* @__PURE__ */ jsxs("span", {
									className: "text-[10px] text-gray-400",
									children: [t.players.length, " jogadores"]
								})]
							}, t.id))
						})]
					}), /* @__PURE__ */ jsxs("div", {
						className: "space-y-2",
						children: [/* @__PURE__ */ jsx("label", {
							className: "block text-xs font-black uppercase tracking-wider text-gray-300",
							children: "Time 2 (Visitante)"
						}), /* @__PURE__ */ jsx("div", {
							className: "grid grid-cols-2 gap-2",
							children: activeSession.teams.map((t) => /* @__PURE__ */ jsxs("button", {
								type: "button",
								onClick: () => setSelectedAwayTeamId(t.id),
								className: cn("p-3 rounded-2xl border text-left transition-all flex flex-col justify-between min-h-[70px]", selectedAwayTeamId === t.id ? "border-emerald-400 bg-emerald-500/10 ring-2 ring-emerald-400/40 shadow-lg" : "border-white/5 bg-surface-200/60 hover:border-white/20"),
								children: [/* @__PURE__ */ jsxs("div", {
									className: "flex items-center gap-2",
									children: [/* @__PURE__ */ jsx("div", {
										className: "w-3 h-3 rounded-full border border-white/20",
										style: { backgroundColor: t.colorHex }
									}), /* @__PURE__ */ jsx("span", {
										className: "font-bold text-xs text-white truncate",
										children: t.name
									})]
								}), /* @__PURE__ */ jsxs("span", {
									className: "text-[10px] text-gray-400",
									children: [t.players.length, " jogadores"]
								})]
							}, t.id))
						})]
					})]
				}),
				homeTeam && awayTeam && /* @__PURE__ */ jsxs("div", {
					className: "p-4 rounded-2xl bg-surface-200/80 border border-white/10 flex items-center justify-between gap-3",
					children: [
						/* @__PURE__ */ jsxs("div", {
							className: "flex items-center gap-2.5 min-w-0",
							children: [/* @__PURE__ */ jsx("div", {
								className: "w-3.5 h-6 rounded shadow shrink-0",
								style: { backgroundColor: homeTeam.colorHex }
							}), /* @__PURE__ */ jsx("span", {
								className: "font-display font-black text-sm text-white truncate",
								children: homeTeam.name
							})]
						}),
						/* @__PURE__ */ jsx("span", {
							className: "text-xs font-black text-emerald-400 uppercase tracking-widest px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20",
							children: "VS"
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "flex items-center gap-2.5 min-w-0 justify-end text-right",
							children: [/* @__PURE__ */ jsx("span", {
								className: "font-display font-black text-sm text-white truncate",
								children: awayTeam.name
							}), /* @__PURE__ */ jsx("div", {
								className: "w-3.5 h-6 rounded shadow shrink-0",
								style: { backgroundColor: awayTeam.colorHex }
							})]
						})
					]
				}),
				/* @__PURE__ */ jsx("button", {
					type: "button",
					disabled: isStartingMatch || selectedHomeTeamId === selectedAwayTeamId,
					onClick: handleStartNewMatch,
					className: "w-full min-h-[52px] px-6 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 disabled:opacity-50 text-gray-950 font-black text-base shadow-xl shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 touch-press-scale",
					children: isStartingMatch ? /* @__PURE__ */ jsx("span", { children: "Iniciando Cronômetro..." }) : /* @__PURE__ */ jsxs(Fragment$1, { children: [/* @__PURE__ */ jsx(Play, { className: "w-5 h-5 fill-current" }), /* @__PURE__ */ jsx("span", { children: "Apitar Início da Partida (7 min)" })] })
				})
			]
		})]
	});
};
//#endregion
//#region src/pages/rodada/mesario.astro
var mesario_exports = /* @__PURE__ */ __exportAll({
	default: () => $$Mesario,
	file: () => $$file,
	prerender: () => false,
	url: () => $$url
});
createAstro("https://astro.build");
var $$Mesario = createComponent(async ($$result, $$props, $$slots) => {
	const Astro = $$result.createAstro($$props, $$slots);
	Astro.self = $$Mesario;
	const FALLBACK_SESSION = {
		id: "session-demo",
		sessionDate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
		status: "ongoing",
		notes: "Rodada de Demonstração",
		teams: [
			{
				id: "team-preto",
				name: "Time Preto",
				colorHex: "#1f2937",
				players: [
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
					}
				]
			},
			{
				id: "team-branco",
				name: "Time Branco",
				colorHex: "#e5e7eb",
				players: [
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
					}
				]
			},
			{
				id: "team-azul",
				name: "Time Azul",
				colorHex: "#3b82f6",
				players: [
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
					}
				]
			},
			{
				id: "team-vermelho",
				name: "Time Vermelho",
				colorHex: "#ef4444",
				players: [
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
				]
			}
		]
	};
	const sessionIdParam = Astro.url.searchParams.get("sessionId");
	let sessionData = FALLBACK_SESSION;
	try {
		const sessionRepo = new SupabaseSessionRepository();
		const dbSession = sessionIdParam ? await sessionRepo.findById(sessionIdParam) : await sessionRepo.findLatest();
		if (dbSession && dbSession.teams.length >= 2) sessionData = {
			id: dbSession.id || "session-active",
			sessionDate: dbSession.sessionDate,
			status: dbSession.status,
			notes: dbSession.notes,
			teams: dbSession.teams.map((t) => ({
				id: t.id || "",
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
			}))
		};
	} catch {
		sessionData = FALLBACK_SESSION;
	}
	return renderTemplate`${renderComponent($$result, "Layout", $$Layout, {
		"title": "SocietyTracker • Modo Mesário ao Vivo",
		"description": "Controle o placar, cronômetro de 7 minutos, gols e assistências em tempo real na beira do campo.",
		"activeNav": "mesario"
	}, { "default": ($$result) => renderTemplate`${renderComponent($$result, "MesarioSessionWrapper", MesarioSessionWrapper, {
		"client:load": true,
		"session": sessionData,
		"client:component-hydration": "load",
		"client:component-path": "C:/Projetos/SocietyTracker/src/components/live/MesarioSessionWrapper.tsx",
		"client:component-export": "MesarioSessionWrapper"
	})}` })}`;
}, "C:/Projetos/SocietyTracker/src/pages/rodada/mesario.astro", void 0);
var $$file = "C:/Projetos/SocietyTracker/src/pages/rodada/mesario.astro";
var $$url = "/rodada/mesario";
//#endregion
//#region \0virtual:astro:page:src/pages/rodada/mesario@_@astro
var page = () => mesario_exports;
//#endregion
export { page };
