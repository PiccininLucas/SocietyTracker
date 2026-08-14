import { t as __exportAll } from "./rolldown-runtime_D7D4PA-g.mjs";
import { a as verifyPin, n as SESSION_MAX_AGE_SECONDS, r as generateSessionToken, t as ADMIN_COOKIE_NAME } from "./pinAuth_B8z-2-vC.mjs";
//#region src/pages/api/auth/login.ts
var login_exports = /* @__PURE__ */ __exportAll({
	POST: () => POST,
	prerender: () => false
});
var POST = async ({ request, cookies }) => {
	try {
		let pin = "";
		const contentType = request.headers.get("content-type") || "";
		if (contentType.includes("application/json")) pin = (await request.json()).pin;
		else if (contentType.includes("application/x-www-form-urlencoded")) pin = (await request.formData()).get("pin") || "";
		if (!pin || !verifyPin(pin)) return new Response(JSON.stringify({ error: "PIN incorreto. Verifique e tente novamente." }), {
			status: 401,
			headers: { "Content-Type": "application/json" }
		});
		const token = generateSessionToken(pin.trim());
		cookies.set(ADMIN_COOKIE_NAME, token, {
			path: "/",
			maxAge: SESSION_MAX_AGE_SECONDS,
			httpOnly: true,
			sameSite: "lax",
			secure: true
		});
		return new Response(JSON.stringify({
			success: true,
			message: "Autenticado com sucesso!",
			expiresInSeconds: SESSION_MAX_AGE_SECONDS
		}), {
			status: 200,
			headers: { "Content-Type": "application/json" }
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: error.message || "Erro ao processar login." }), {
			status: 500,
			headers: { "Content-Type": "application/json" }
		});
	}
};
//#endregion
//#region \0virtual:astro:page:src/pages/api/auth/login@_@ts
var page = () => login_exports;
//#endregion
export { page };
