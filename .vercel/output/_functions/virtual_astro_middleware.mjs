import { A as defineMiddleware, g as sequence } from "./chunks/render_BP7Km_3S.mjs";
import { i as isAuthenticatedFromRequest } from "./chunks/pinAuth_B8z-2-vC.mjs";
//#region src/middleware.ts
var onRequest$1 = defineMiddleware(async (context, next) => {
	const { pathname, search } = context.url;
	const method = context.request.method;
	if (pathname.startsWith("/rodada/nova") || pathname.startsWith("/rodada/mesario")) {
		if (!isAuthenticatedFromRequest(context.cookies, context.request)) {
			const redirectTarget = encodeURIComponent(`${pathname}${search}`);
			return context.redirect(`/login?redirect=${redirectTarget}`);
		}
	}
	const isApiRoute = pathname.startsWith("/api/");
	const isAuthApi = pathname.startsWith("/api/auth/");
	const isWriteMethod = ![
		"GET",
		"HEAD",
		"OPTIONS"
	].includes(method);
	if (isApiRoute && !isAuthApi && isWriteMethod) {
		if (!isAuthenticatedFromRequest(context.cookies, context.request)) return new Response(JSON.stringify({
			error: "Acesso não autorizado. Forneça o PIN de administrador para gravar dados.",
			code: "UNAUTHORIZED_ADMIN_PIN"
		}), {
			status: 401,
			headers: { "Content-Type": "application/json" }
		});
	}
	return next();
});
//#endregion
//#region \0virtual:astro:middleware
var onRequest = sequence(onRequest$1);
//#endregion
export { onRequest };
