import { t as __exportAll } from "./rolldown-runtime_D7D4PA-g.mjs";
import { C as createAstro, i as renderComponent, m as maybeRenderHead, u as renderTemplate } from "./server_DNJHvdY8.mjs";
import { t as createComponent } from "./compiler_Cige1B-f.mjs";
import { i as isAuthenticatedFromRequest } from "./pinAuth_B8z-2-vC.mjs";
import { t as $$Layout } from "./Layout_BQmvqKSy.mjs";
import { t as cn } from "./utils_7hA_0p5v.mjs";
import { n as soundFx, t as hapticFeedback } from "./vibration_DEhdHpvZ.mjs";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Delete, KeyRound, RotateCcw, ShieldAlert, ShieldCheck, Unlock } from "lucide-react";
import { jsx, jsxs } from "react/jsx-runtime";
//#region src/components/live/PinLoginPad.tsx
var PinLoginPad = ({ redirectUrl = "/rodada/mesario" }) => {
	const [pin, setPin] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState(null);
	const [isSuccess, setIsSuccess] = useState(false);
	const [isShaking, setIsShaking] = useState(false);
	const handleSubmitPin = useCallback(async (completedPin) => {
		setIsLoading(true);
		setErrorMessage(null);
		try {
			const res = await fetch("/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ pin: completedPin })
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "PIN incorreto.");
			setIsSuccess(true);
			soundFx.playClickBeep("high");
			hapticFeedback.goal();
			setTimeout(() => {
				window.location.href = redirectUrl;
			}, 500);
		} catch (err) {
			soundFx.playClickBeep("low");
			hapticFeedback.cancel();
			setIsShaking(true);
			setErrorMessage(err.message || "PIN incorreto. Tente novamente.");
			setPin("");
			setTimeout(() => setIsShaking(false), 500);
		} finally {
			setIsLoading(false);
		}
	}, [redirectUrl]);
	const handleKeyPress = useCallback((digit) => {
		if (isLoading || isSuccess || pin.length >= 4) return;
		soundFx.playClickBeep("normal");
		hapticFeedback.click();
		const nextPin = pin + digit;
		setPin(nextPin);
		setErrorMessage(null);
		if (nextPin.length === 4) handleSubmitPin(nextPin);
	}, [
		pin,
		isLoading,
		isSuccess,
		handleSubmitPin
	]);
	const handleDelete = useCallback(() => {
		if (isLoading || isSuccess || pin.length === 0) return;
		soundFx.playClickBeep("low");
		hapticFeedback.click();
		setPin((prev) => prev.slice(0, -1));
		setErrorMessage(null);
	}, [
		isLoading,
		isSuccess,
		pin.length
	]);
	const handleClear = useCallback(() => {
		if (isLoading || isSuccess || pin.length === 0) return;
		soundFx.playClickBeep("low");
		hapticFeedback.click();
		setPin("");
		setErrorMessage(null);
	}, [
		isLoading,
		isSuccess,
		pin.length
	]);
	useEffect(() => {
		const handleKeyDown = (e) => {
			if (e.key >= "0" && e.key <= "9") handleKeyPress(e.key);
			else if (e.key === "Backspace") handleDelete();
			else if (e.key === "Escape") handleClear();
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [
		handleKeyPress,
		handleDelete,
		handleClear
	]);
	return /* @__PURE__ */ jsxs("div", {
		className: "w-full max-w-sm mx-auto p-6 rounded-3xl glass-card-glow bg-surface-100/95 border border-white/10 shadow-2xl space-y-6 animate-scale-up select-none",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "text-center space-y-2",
				children: [
					/* @__PURE__ */ jsx("div", {
						className: cn("w-16 h-16 rounded-3xl mx-auto flex items-center justify-center transition-all duration-300 shadow-xl", isSuccess ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 scale-110" : errorMessage ? "bg-rose-500/20 text-rose-400 border border-rose-500/40" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"),
						children: isSuccess ? /* @__PURE__ */ jsx(Unlock, { className: "w-8 h-8 animate-bounce-short" }) : /* @__PURE__ */ jsx(KeyRound, { className: "w-8 h-8" })
					}),
					/* @__PURE__ */ jsx("h2", {
						className: "font-display font-black text-2xl text-white",
						children: "Acesso do Mesário"
					}),
					/* @__PURE__ */ jsx("p", {
						className: "text-xs text-gray-400 max-w-xs mx-auto",
						children: "Digite o PIN de 4 dígitos para gerenciar a rodada e lançar gols"
					})
				]
			}),
			/* @__PURE__ */ jsx("div", {
				className: cn("flex items-center justify-center gap-4 py-2 transition-transform", isShaking && "animate-bounce-short"),
				children: [
					0,
					1,
					2,
					3
				].map((index) => {
					const isFilled = pin.length > index;
					return /* @__PURE__ */ jsx("div", { className: cn("w-4 h-4 rounded-full border-2 transition-all duration-200", isSuccess ? "bg-emerald-400 border-emerald-400 shadow-lg shadow-emerald-500/50 scale-110" : isFilled ? "bg-emerald-500 border-emerald-400 shadow-md shadow-emerald-500/40 scale-125" : "bg-surface-50 border-white/20") }, index);
				})
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "min-h-[24px] text-center",
				children: [isSuccess && /* @__PURE__ */ jsxs("span", {
					className: "text-xs font-bold text-emerald-400 animate-fade-in flex items-center justify-center gap-1",
					children: [/* @__PURE__ */ jsx(ShieldCheck, { className: "w-4 h-4" }), /* @__PURE__ */ jsx("span", { children: "PIN Correto! Redirecionando..." })]
				}), errorMessage && !isSuccess && /* @__PURE__ */ jsxs("span", {
					className: "text-xs font-bold text-rose-400 animate-fade-in flex items-center justify-center gap-1",
					children: [/* @__PURE__ */ jsx(ShieldAlert, { className: "w-4 h-4" }), /* @__PURE__ */ jsx("span", { children: errorMessage })]
				})]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "space-y-2.5",
				children: [[
					[
						"1",
						"2",
						"3"
					],
					[
						"4",
						"5",
						"6"
					],
					[
						"7",
						"8",
						"9"
					]
				].map((row, rIdx) => /* @__PURE__ */ jsx("div", {
					className: "grid grid-cols-3 gap-2.5",
					children: row.map((digit) => /* @__PURE__ */ jsx("button", {
						type: "button",
						disabled: isLoading || isSuccess,
						onClick: () => handleKeyPress(digit),
						className: "h-14 sm:h-16 rounded-2xl bg-surface-200/90 hover:bg-surface-50 border border-white/5 hover:border-emerald-500/40 text-white font-display font-black text-2xl flex items-center justify-center transition-all shadow-md active:scale-95 disabled:opacity-50 touch-press-scale",
						children: digit
					}, digit))
				}, rIdx)), /* @__PURE__ */ jsxs("div", {
					className: "grid grid-cols-3 gap-2.5",
					children: [
						/* @__PURE__ */ jsxs("button", {
							type: "button",
							disabled: isLoading || isSuccess || pin.length === 0,
							onClick: handleClear,
							className: "h-14 sm:h-16 rounded-2xl bg-surface-200/50 hover:bg-surface-50 border border-white/5 text-gray-400 hover:text-white font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all active:scale-95 disabled:opacity-30",
							title: "Limpar PIN",
							children: [/* @__PURE__ */ jsx(RotateCcw, { className: "w-4 h-4" }), /* @__PURE__ */ jsx("span", {
								className: "text-[10px]",
								children: "Limpar"
							})]
						}),
						/* @__PURE__ */ jsx("button", {
							type: "button",
							disabled: isLoading || isSuccess,
							onClick: () => handleKeyPress("0"),
							className: "h-14 sm:h-16 rounded-2xl bg-surface-200/90 hover:bg-surface-50 border border-white/5 hover:border-emerald-500/40 text-white font-display font-black text-2xl flex items-center justify-center transition-all shadow-md active:scale-95 disabled:opacity-50 touch-press-scale",
							children: "0"
						}),
						/* @__PURE__ */ jsxs("button", {
							type: "button",
							disabled: isLoading || isSuccess || pin.length === 0,
							onClick: handleDelete,
							className: "h-14 sm:h-16 rounded-2xl bg-surface-200/50 hover:bg-surface-50 border border-white/5 text-gray-400 hover:text-white font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all active:scale-95 disabled:opacity-30",
							title: "Apagar último dígito",
							children: [/* @__PURE__ */ jsx(Delete, { className: "w-4 h-4" }), /* @__PURE__ */ jsx("span", {
								className: "text-[10px]",
								children: "Apagar"
							})]
						})
					]
				})]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "pt-2 border-t border-white/5 flex flex-col items-center gap-3 text-center",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "flex items-center gap-1.5 text-[11px] text-gray-400",
					children: [/* @__PURE__ */ jsx(ShieldCheck, { className: "w-3.5 h-3.5 text-emerald-400" }), /* @__PURE__ */ jsx("span", { children: "Sessão autenticada válida por 24 horas" })]
				}), /* @__PURE__ */ jsxs("a", {
					href: "/",
					className: "inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-semibold",
					children: [/* @__PURE__ */ jsx(ArrowLeft, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ jsx("span", { children: "Voltar para a Classificação Pública" })]
				})]
			})
		]
	});
};
//#endregion
//#region src/pages/login.astro
var login_exports = /* @__PURE__ */ __exportAll({
	default: () => $$Login,
	file: () => $$file,
	prerender: () => false,
	url: () => $$url
});
createAstro("https://astro.build");
var $$Login = createComponent(($$result, $$props, $$slots) => {
	const Astro = $$result.createAstro($$props, $$slots);
	Astro.self = $$Login;
	const redirectParam = Astro.url.searchParams.get("redirect") || "/rodada/mesario";
	if (isAuthenticatedFromRequest(Astro.cookies, Astro.request)) return Astro.redirect(redirectParam);
	return renderTemplate`${renderComponent($$result, "Layout", $$Layout, {
		"title": "SocietyTracker • Acesso do Mesário",
		"description": "Digite seu PIN de 4 dígitos para gerenciar os jogos e lançar gols no Modo Mesário."
	}, { "default": ($$result) => renderTemplate`${maybeRenderHead($$result)}<div class="min-h-[75vh] flex flex-col items-center justify-center py-4">${renderComponent($$result, "PinLoginPad", PinLoginPad, {
		"client:load": true,
		"redirectUrl": redirectParam,
		"client:component-hydration": "load",
		"client:component-path": "C:/Projetos/SocietyTracker/src/components/live/PinLoginPad.tsx",
		"client:component-export": "PinLoginPad"
	})}</div>` })}`;
}, "C:/Projetos/SocietyTracker/src/pages/login.astro", void 0);
var $$file = "C:/Projetos/SocietyTracker/src/pages/login.astro";
var $$url = "/login";
//#endregion
//#region \0virtual:astro:page:src/pages/login@_@astro
var page = () => login_exports;
//#endregion
export { page };
