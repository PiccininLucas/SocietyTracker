export const ADMIN_COOKIE_NAME = 'society_admin_session';
export const SESSION_MAX_AGE_SECONDS = 24 * 60 * 60; // 24 horas (86400s)

export function getAdminPin(): string {
  const g = globalThis as any;
  const envPin =
    import.meta.env?.ADMIN_PIN ||
    (typeof g.process !== 'undefined' && g.process?.env?.ADMIN_PIN) ||
    '1234';
  return envPin.toString().trim();
}

/**
 * Valida se o PIN informado confere com a variável ADMIN_PIN
 */
export function verifyPin(inputPin: string): boolean {
  if (!inputPin) return false;
  const currentPin = getAdminPin();
  return inputPin.trim() === currentPin;
}

// Função de hash determinística para validação de integridade do token
function computeSignature(payload: string, secret: string): string {
  let hash = 0x811c9dc5;
  const combined = `${payload}:${secret}:society_salt_2026`;
  for (let i = 0; i < combined.length; i++) {
    hash ^= combined.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(36) + combined.length.toString(36);
}

function base64UrlEncode(str: string): string {
  const g = globalThis as any;
  if (typeof g.Buffer !== 'undefined') {
    return g.Buffer.from(str, 'utf-8').toString('base64url');
  }
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
  const g = globalThis as any;
  if (typeof g.Buffer !== 'undefined') {
    return g.Buffer.from(str, 'base64url').toString('utf-8');
  }
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  return decodeURIComponent(escape(atob(padded)));
}

/**
 * Gera um token de sessão assinado contendo timestamp, PIN e assinatura
 */
export function generateSessionToken(pin: string): string {
  const currentPin = getAdminPin();
  const timestamp = Date.now().toString();
  const signature = computeSignature(timestamp, currentPin);
  const raw = `${timestamp}:${pin}:${signature}`;
  return base64UrlEncode(raw);
}

/**
 * Valida a integridade, o PIN e a expiração (24h) do token de sessão
 */
export function validateSessionToken(token?: string | null): boolean {
  if (!token || typeof token !== 'string') return false;

  try {
    const decoded = base64UrlDecode(token);
    const parts = decoded.split(':');
    if (parts.length !== 3) return false;

    const [timestampStr, pin, signature] = parts;
    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp)) return false;

    // Verifica se expirou (24 horas)
    const now = Date.now();
    const maxAgeMs = SESSION_MAX_AGE_SECONDS * 1000;
    if (now - timestamp > maxAgeMs || timestamp > now + 60000) {
      return false;
    }

    const currentPin = getAdminPin();
    if (pin !== currentPin) {
      return false;
    }

    const expectedSignature = computeSignature(timestampStr, currentPin);
    return signature === expectedSignature;
  } catch {
    return false;
  }
}

/**
 * Verifica se a requisição possui autenticação válida por Cookie ou Header
 */
export function isAuthenticatedFromRequest(cookies: any, request?: Request): boolean {
  // 1. Verifica via cookie de sessão
  let cookieToken: string | undefined;

  if (cookies && typeof cookies.get === 'function') {
    const cookieObj = cookies.get(ADMIN_COOKIE_NAME);
    cookieToken = cookieObj?.value;
  } else if (request) {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${ADMIN_COOKIE_NAME}=([^;]+)`));
    if (match) {
      cookieToken = match[1];
    }
  }

  if (cookieToken && validateSessionToken(cookieToken)) {
    return true;
  }

  // 2. Verifica via Header de Autorização ou x-admin-pin
  if (request) {
    const pinHeader = request.headers.get('x-admin-pin');
    if (pinHeader && verifyPin(pinHeader)) {
      return true;
    }

    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const bearerToken = authHeader.substring(7).trim();
      if (verifyPin(bearerToken) || validateSessionToken(bearerToken)) {
        return true;
      }
    }
  }

  return false;
}
