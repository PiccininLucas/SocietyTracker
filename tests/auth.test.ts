import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  clientKey,
  checkThrottle,
  registerFailure,
  clearFailures,
  resetThrottle,
  THROTTLE_LIMITS,
} from '../src/core/infrastructure/auth/loginThrottle.ts';
import { safeRedirect } from '../src/core/infrastructure/auth/safeRedirect.ts';
import {
  getAdminPin,
  verifyPin,
  generateSessionToken,
  validateSessionToken,
  isAuthenticatedFromRequest,
  ADMIN_COOKIE_NAME,
} from '../src/core/infrastructure/auth/pinAuth';

describe('Admin Authentication & HMAC-SHA256 Token Rules', () => {
  it('should verify configured PIN correctly', () => {
    const pin = getAdminPin();
    assert.equal(verifyPin(pin), true);
    assert.equal(verifyPin('wrong-pin'), false);
    assert.equal(verifyPin(''), false);
  });

  it('should generate a token without exposing the PIN', () => {
    const pin = getAdminPin();
    const token = generateSessionToken(pin);

    // Token must NOT contain the plain PIN
    assert.equal(token.includes(pin), false);

    // Token format must be timestamp.expiresAt.signature
    const parts = token.split('.');
    assert.equal(parts.length, 3);

    const [timestampStr, expiresAtStr, signature] = parts;
    const timestamp = parseInt(timestampStr, 10);
    const expiresAt = parseInt(expiresAtStr, 10);

    assert.ok(!isNaN(timestamp) && timestamp > 0);
    assert.ok(!isNaN(expiresAt) && expiresAt > timestamp);
    assert.ok(signature.length > 20);
  });

  it('should validate a freshly generated token', () => {
    const token = generateSessionToken();
    assert.equal(validateSessionToken(token), true);
  });

  it('should reject malformed or tampered tokens', () => {
    assert.equal(validateSessionToken(null), false);
    assert.equal(validateSessionToken(''), false);
    assert.equal(validateSessionToken('invalid-token'), false);
    assert.equal(validateSessionToken('a.b'), false);

    const validToken = generateSessionToken();
    const parts = validToken.split('.');

    // Tamper with timestamp
    const tamperedPayload = `12345.${parts[1]}.${parts[2]}`;
    assert.equal(validateSessionToken(tamperedPayload), false);

    // Tamper with signature
    const tamperedSignature = `${parts[0]}.${parts[1]}.invalidsignature1234567890`;
    assert.equal(validateSessionToken(tamperedSignature), false);
  });

  it('should reject expired tokens', () => {
    const expiredTimestamp = Date.now() - 100000;
    const expiredAt = Date.now() - 1000; // already expired
    // Craft token with valid format but expired
    const expiredToken = `${expiredTimestamp}.${expiredAt}.someSignature`;
    assert.equal(validateSessionToken(expiredToken), false);
  });

  it('authenticates from the session cookie (cookie API or raw header)', () => {
    const token = generateSessionToken();

    const mockCookies = {
      get: (name: string) => (name === ADMIN_COOKIE_NAME ? { value: token } : undefined),
    };
    assert.equal(isAuthenticatedFromRequest(mockCookies), true);

    const cookieRequest = new Request('http://localhost', {
      headers: { cookie: `other=1; ${ADMIN_COOKIE_NAME}=${token}` },
    });
    assert.equal(isAuthenticatedFromRequest(null, cookieRequest), true);
  });

  it('rejects the PIN or a token sent in headers — only /api/auth/login accepts the PIN', () => {
    const pin = getAdminPin();
    const token = generateSessionToken();

    const attempts: Record<string, string>[] = [
      { 'x-admin-pin': pin },
      { authorization: `Bearer ${pin}` },
      { authorization: `Bearer ${token}` },
    ];
    for (const headers of attempts) {
      const request = new Request('http://localhost', { headers });
      assert.equal(isAuthenticatedFromRequest(null, request), false);
    }
  });

  describe('SESSION_SECRET em produção', () => {
    const original = {
      NODE_ENV: process.env.NODE_ENV,
      SESSION_SECRET: process.env.SESSION_SECRET,
      ADMIN_PIN: process.env.ADMIN_PIN,
    };
    const inProduction = (secret: string | undefined, run: () => void) => {
      const pin = getAdminPin();
      try {
        process.env.NODE_ENV = 'production';
        // Com o PIN definido, o teste não dispara o aviso de ADMIN_PIN ausente.
        process.env.ADMIN_PIN = pin;
        if (secret === undefined) delete process.env.SESSION_SECRET;
        else process.env.SESSION_SECRET = secret;
        run();
      } finally {
        for (const [key, value] of Object.entries(original)) {
          if (value === undefined) delete process.env[key];
          else process.env[key] = value;
        }
      }
    };

    it('recusa emitir e aceitar sessão quando a variável falta', () => {
      const token = generateSessionToken();
      inProduction(undefined, () => {
        assert.throws(() => generateSessionToken(), /SESSION_SECRET/);
        assert.equal(validateSessionToken(token), false);
      });
    });

    it('funciona normalmente quando a variável está definida', () => {
      inProduction('segredo-de-teste', () => {
        assert.equal(validateSessionToken(generateSessionToken()), true);
      });
    });
  });
});

describe('Login throttle', () => {
  beforeEach(() => resetThrottle());

  const KEY = '203.0.113.7';

  it('allows attempts below the limit and counts down', () => {
    assert.deepEqual(checkThrottle(KEY), {
      blocked: false,
      remaining: THROTTLE_LIMITS.MAX_FAILURES,
    });

    registerFailure(KEY);
    const after = checkThrottle(KEY);
    assert.equal(after.blocked, false);
    assert.equal(after.blocked === false && after.remaining, THROTTLE_LIMITS.MAX_FAILURES - 1);
  });

  it('blocks once the failure limit is reached and reports Retry-After', () => {
    for (let i = 0; i < THROTTLE_LIMITS.MAX_FAILURES; i++) registerFailure(KEY);

    const verdict = checkThrottle(KEY);
    assert.equal(verdict.blocked, true);
    assert.ok(verdict.blocked === true && verdict.retryAfterSeconds > 0);
    assert.ok(
      verdict.blocked === true && verdict.retryAfterSeconds <= THROTTLE_LIMITS.WINDOW_MS / 1000
    );
  });

  it('forgets failures once the window has passed', () => {
    const longAgo = Date.now() - THROTTLE_LIMITS.WINDOW_MS - 1000;
    for (let i = 0; i < THROTTLE_LIMITS.MAX_FAILURES; i++) registerFailure(KEY, longAgo);

    assert.equal(checkThrottle(KEY).blocked, false);
  });

  it('isolates callers from each other', () => {
    for (let i = 0; i < THROTTLE_LIMITS.MAX_FAILURES; i++) registerFailure(KEY);

    assert.equal(checkThrottle(KEY).blocked, true);
    assert.equal(checkThrottle('198.51.100.2').blocked, false);
  });

  it('clears the counter after a successful login', () => {
    for (let i = 0; i < THROTTLE_LIMITS.MAX_FAILURES; i++) registerFailure(KEY);
    assert.equal(checkThrottle(KEY).blocked, true);

    clearFailures(KEY);
    assert.equal(checkThrottle(KEY).blocked, false);
  });

  it('prefers the first x-forwarded-for entry over the socket address', () => {
    const request = new Request('http://local/api/auth/login', {
      headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' },
    });
    assert.equal(clientKey(request, '10.0.0.1'), '203.0.113.9');

    const direct = new Request('http://local/api/auth/login');
    assert.equal(clientKey(direct, '192.0.2.5'), '192.0.2.5');
  });
});

describe('Destino de redirecionamento do login', () => {
  it('aceita caminhos internos', () => {
    assert.equal(safeRedirect('/rodada/nova'), '/rodada/nova');
    assert.equal(safeRedirect('/historico?data=2026-09-17'), '/historico?data=2026-09-17');
  });

  it('recusa destino absoluto — era o vetor de phishing de PIN', () => {
    assert.equal(safeRedirect('https://site-falso.com'), '/rodada/mesario');
    assert.equal(safeRedirect('http://site-falso.com'), '/rodada/mesario');
    assert.equal(safeRedirect('javascript:alert(1)'), '/rodada/mesario');
  });

  it('recusa protocol-relative, que parece interno mas não é', () => {
    assert.equal(safeRedirect('//site-falso.com'), '/rodada/mesario');
    assert.equal(safeRedirect(String.raw`/\site-falso.com`), '/rodada/mesario');
  });

  it('usa o padrão quando não vem nada', () => {
    assert.equal(safeRedirect(null), '/rodada/mesario');
    assert.equal(safeRedirect(''), '/rodada/mesario');
  });
});
