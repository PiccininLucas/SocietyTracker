import { createHmac, timingSafeEqual } from 'node:crypto';

export const ADMIN_COOKIE_NAME = 'society_admin_session';
export const SESSION_MAX_AGE_SECONDS = 24 * 60 * 60; // 24 horas (86400s)

const DEV_FALLBACK_PIN = '1234';
const DEV_FALLBACK_SECRET = 'society_salt_2026_default_secret_key';

/**
 * Lê a variável em tempo de execução.
 *
 * Lê só de `process.env`, nunca de `import.meta.env`. O Vite resolve `import.meta.env`
 * **em tempo de build**: no acesso estático ele inlina o valor no artefato, e no acesso
 * por índice dinâmico ele embute o objeto de ambiente inteiro. Nos dois casos o PIN
 * acabava em texto claro no bundle de servidor e trocá-lo no painel da Vercel não tinha
 * efeito sem um novo deploy.
 */
function readSecretEnv(key: 'ADMIN_PIN' | 'SESSION_SECRET'): string {
  const g = globalThis as any;
  const fromProcess = typeof process !== 'undefined' ? process.env?.[key] : undefined;
  const fromGlobalProcess = typeof g.process !== 'undefined' ? g.process?.env?.[key] : undefined;
  return String(fromProcess || fromGlobalProcess || '').trim();
}

function isProduction(): boolean {
  const g = globalThis as any;
  const nodeEnv =
    (typeof process !== 'undefined' ? process.env?.NODE_ENV : undefined) ||
    (typeof g.process !== 'undefined' ? g.process?.env?.NODE_ENV : undefined);
  return nodeEnv === 'production';
}

const warned = new Set<string>();
function warnOnceInProduction(key: string) {
  if (!isProduction() || warned.has(key)) return;
  warned.add(key);
  console.error(
    `[pinAuth] ${key} não está definida no ambiente. Usando o valor padrão do código, ` +
      `que é público neste repositório. Defina ${key} nas variáveis de ambiente.`
  );
}

export function getAdminPin(): string {
  const pin = readSecretEnv('ADMIN_PIN');
  if (pin) return pin;
  warnOnceInProduction('ADMIN_PIN');
  return DEV_FALLBACK_PIN;
}

export function getSessionSecret(): string {
  const secret = readSecretEnv('SESSION_SECRET');
  if (secret) return secret;
  warnOnceInProduction('SESSION_SECRET');
  return DEV_FALLBACK_SECRET;
}

/**
 * Valida se o PIN informado confere com a variável ADMIN_PIN
 */
export function verifyPin(inputPin: string): boolean {
  if (!inputPin) return false;
  const currentPin = getAdminPin();
  return inputPin.trim() === currentPin;
}

function getDerivedHmacKey(): string {
  const currentPin = getAdminPin();
  const secret = getSessionSecret();
  return `${currentPin}:${secret}`;
}

function computeHmacSignature(payload: string, secretKey: string): string {
  return createHmac('sha256', secretKey).update(payload).digest('base64url');
}

/**
 * Gera um token de sessão assinado contendo timestamp e validade (HMAC-SHA256).
 * O PIN nunca é incluído no payload do token.
 */
export function generateSessionToken(_pin?: string): string {
  const now = Date.now();
  const expiresAt = now + SESSION_MAX_AGE_SECONDS * 1000;
  const payload = `${now}.${expiresAt}`;
  const signature = computeHmacSignature(payload, getDerivedHmacKey());
  return `${payload}.${signature}`;
}

/**
 * Valida a integridade, expiração (24h) e autenticidade do token de sessão.
 */
export function validateSessionToken(token?: string | null): boolean {
  if (!token || typeof token !== 'string') return false;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;

    const [timestampStr, expiresAtStr, signature] = parts;
    const timestamp = parseInt(timestampStr, 10);
    const expiresAt = parseInt(expiresAtStr, 10);

    if (isNaN(timestamp) || isNaN(expiresAt)) return false;

    const now = Date.now();
    // Rejeita tokens já expirados ou com timestamp absurdo no futuro (+60s de tolerância para clock skew)
    if (now > expiresAt || timestamp > now + 60000) {
      return false;
    }

    const payload = `${timestampStr}.${expiresAtStr}`;
    const expectedSignature = computeHmacSignature(payload, getDerivedHmacKey());

    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (sigBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(sigBuffer, expectedBuffer);
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
