//#region src/core/infrastructure/auth/pinAuth.ts
var ADMIN_COOKIE_NAME = "society_admin_session";
var SESSION_MAX_AGE_SECONDS = 86400;
function getAdminPin() {
	return "1234".toString().trim();
}
function verifyPin(inputPin) {
	if (!inputPin) return false;
	const currentPin = getAdminPin();
	return inputPin.trim() === currentPin;
}
function computeSignature(payload, secret) {
	let hash = 2166136261;
	const combined = `${payload}:${secret}:society_salt_2026`;
	for (let i = 0; i < combined.length; i++) {
		hash ^= combined.charCodeAt(i);
		hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
	}
	return (hash >>> 0).toString(36) + combined.length.toString(36);
}
function base64UrlEncode(str) {
	const g = globalThis;
	if (typeof g.Buffer !== "undefined") return g.Buffer.from(str, "utf-8").toString("base64url");
	return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function base64UrlDecode(str) {
	const g = globalThis;
	if (typeof g.Buffer !== "undefined") return g.Buffer.from(str, "base64url").toString("utf-8");
	const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
	const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, "=");
	return decodeURIComponent(escape(atob(padded)));
}
function generateSessionToken(pin) {
	const currentPin = getAdminPin();
	const timestamp = Date.now().toString();
	return base64UrlEncode(`${timestamp}:${pin}:${computeSignature(timestamp, currentPin)}`);
}
function validateSessionToken(token) {
	if (!token || typeof token !== "string") return false;
	try {
		const parts = base64UrlDecode(token).split(":");
		if (parts.length !== 3) return false;
		const [timestampStr, pin, signature] = parts;
		const timestamp = parseInt(timestampStr, 10);
		if (isNaN(timestamp)) return false;
		const now = Date.now();
		const maxAgeMs = SESSION_MAX_AGE_SECONDS * 1e3;
		if (now - timestamp > maxAgeMs || timestamp > now + 6e4) return false;
		const currentPin = getAdminPin();
		if (pin !== currentPin) return false;
		return signature === computeSignature(timestampStr, currentPin);
	} catch {
		return false;
	}
}
function isAuthenticatedFromRequest(cookies, request) {
	let cookieToken;
	if (cookies && typeof cookies.get === "function") cookieToken = cookies.get(ADMIN_COOKIE_NAME)?.value;
	else if (request) {
		const match = (request.headers.get("cookie") || "").match(new RegExp(`(?:^|;\\s*)${ADMIN_COOKIE_NAME}=([^;]+)`));
		if (match) cookieToken = match[1];
	}
	if (cookieToken && validateSessionToken(cookieToken)) return true;
	if (request) {
		const pinHeader = request.headers.get("x-admin-pin");
		if (pinHeader && verifyPin(pinHeader)) return true;
		const authHeader = request.headers.get("authorization");
		if (authHeader && authHeader.startsWith("Bearer ")) {
			const bearerToken = authHeader.substring(7).trim();
			if (verifyPin(bearerToken) || validateSessionToken(bearerToken)) return true;
		}
	}
	return false;
}
//#endregion
export { verifyPin as a, isAuthenticatedFromRequest as i, SESSION_MAX_AGE_SECONDS as n, generateSessionToken as r, ADMIN_COOKIE_NAME as t };
