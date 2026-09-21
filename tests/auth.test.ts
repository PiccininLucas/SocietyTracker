import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
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

  it('should authenticate from cookies, x-admin-pin header, or Bearer token', () => {
    const token = generateSessionToken();
    const pin = getAdminPin();

    // 1. Via Cookie
    const mockCookies = {
      get: (name: string) => (name === ADMIN_COOKIE_NAME ? { value: token } : undefined),
    };
    assert.equal(isAuthenticatedFromRequest(mockCookies), true);

    // 2. Via x-admin-pin header
    const pinRequest = new Request('http://localhost', {
      headers: { 'x-admin-pin': pin },
    });
    assert.equal(isAuthenticatedFromRequest(null, pinRequest), true);

    // 3. Via Bearer token
    const bearerRequest = new Request('http://localhost', {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(isAuthenticatedFromRequest(null, bearerRequest), true);

    // 4. Invalid requests
    const invalidRequest = new Request('http://localhost', {
      headers: { authorization: 'Bearer invalid-token' },
    });
    assert.equal(isAuthenticatedFromRequest(null, invalidRequest), false);
  });
});
