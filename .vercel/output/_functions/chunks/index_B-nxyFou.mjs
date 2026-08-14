import { n as __exportAll, t as createComponent } from "./compiler_CG2aLJJ5.mjs";
import { S as createAstro, h as addAttribute, l as renderTemplate, m as renderHead } from "./server_BimzntT8.mjs";
//#region src/pages/index.astro
var pages_exports = /* @__PURE__ */ __exportAll({
	default: () => $$Index,
	file: () => $$file,
	url: () => ""
});
createAstro("https://astro.build");
var $$Index = createComponent(($$result, $$props, $$slots) => {
	const Astro = $$result.createAstro($$props, $$slots);
	Astro.self = $$Index;
	return renderTemplate`<html lang="en"><head><meta charset="utf-8"><link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="icon" href="/favicon.ico"><meta name="viewport" content="width=device-width"><meta name="generator"${addAttribute(Astro.generator, "content")}><title>Astro</title>${renderHead($$result)}</head><body><h1>Astro</h1></body></html>`;
}, "C:/Projetos/SocietyTracker/src/pages/index.astro", void 0);
var $$file = "C:/Projetos/SocietyTracker/src/pages/index.astro";
//#endregion
//#region \0virtual:astro:page:src/pages/index@_@astro
var page = () => pages_exports;
//#endregion
export { page };
