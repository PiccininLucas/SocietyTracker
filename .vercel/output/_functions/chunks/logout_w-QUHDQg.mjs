import { t as __exportAll } from "./rolldown-runtime_D7D4PA-g.mjs";
import { t as ADMIN_COOKIE_NAME } from "./pinAuth_B8z-2-vC.mjs";
//#region src/pages/api/auth/logout.ts
var logout_exports = /* @__PURE__ */ __exportAll({
	POST: () => POST,
	prerender: () => false
});
var POST = async ({ cookies }) => {
	cookies.delete(ADMIN_COOKIE_NAME, { path: "/" });
	return new Response(JSON.stringify({
		success: true,
		message: "Sessão encerrada com sucesso."
	}), {
		status: 200,
		headers: { "Content-Type": "application/json" }
	});
};
//#endregion
//#region \0virtual:astro:page:src/pages/api/auth/logout@_@ts
var page = () => logout_exports;
//#endregion
export { page };
