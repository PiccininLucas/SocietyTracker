import { t as __exportAll } from "./rolldown-runtime_D7D4PA-g.mjs";
import { i as isAuthenticatedFromRequest } from "./pinAuth_B8z-2-vC.mjs";
//#region src/pages/api/auth/status.ts
var status_exports = /* @__PURE__ */ __exportAll({
	GET: () => GET,
	prerender: () => false
});
var GET = async ({ cookies, request }) => {
	const authenticated = isAuthenticatedFromRequest(cookies, request);
	return new Response(JSON.stringify({ isAuthenticated: authenticated }), {
		status: 200,
		headers: { "Content-Type": "application/json" }
	});
};
//#endregion
//#region \0virtual:astro:page:src/pages/api/auth/status@_@ts
var page = () => status_exports;
//#endregion
export { page };
