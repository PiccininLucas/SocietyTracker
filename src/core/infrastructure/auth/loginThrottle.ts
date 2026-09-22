/**
 * Limite de tentativas do login por PIN.
 *
 * O PIN é uma credencial curta e de longa duração, e `/api/auth/login` está isento do
 * middleware — até aqui não havia atraso, bloqueio nem registro de tentativa, então nada
 * distinguia o mesário errando o PIN de um script varrendo o espaço de combinações.
 *
 * O estado é por instância: em serverless o contador não é global, e por isso este
 * mecanismo é uma barreira, não uma garantia. O registro em log é o que permite perceber
 * o abuso; para bloqueio efetivo seria preciso um contador compartilhado (tabela ou KV).
 */
const WINDOW_MS = 15 * 60 * 1000; // 15 minutos
const MAX_FAILURES = 10;
const MAX_TRACKED_KEYS = 5000;

const failures = new Map<string, number[]>();

/** Identifica o chamador. Atrás da Vercel o IP real vem em `x-forwarded-for`. */
export function clientKey(request: Request, clientAddress?: string): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || clientAddress || 'desconhecido';
}

function recentFailures(key: string, now: number): number[] {
  const recent = (failures.get(key) ?? []).filter((at) => now - at < WINDOW_MS);
  if (recent.length) failures.set(key, recent);
  else failures.delete(key);
  return recent;
}

export type ThrottleVerdict =
  | { blocked: false; remaining: number }
  | { blocked: true; retryAfterSeconds: number };

export function checkThrottle(key: string, now = Date.now()): ThrottleVerdict {
  const recent = recentFailures(key, now);
  if (recent.length < MAX_FAILURES) {
    return { blocked: false, remaining: MAX_FAILURES - recent.length };
  }
  return {
    blocked: true,
    retryAfterSeconds: Math.max(1, Math.ceil((WINDOW_MS - (now - recent[0])) / 1000)),
  };
}

export function registerFailure(key: string, now = Date.now()): void {
  // Poda preguiçosa: sem isto o Map cresceria sem limite ao longo da vida da instância.
  if (failures.size > MAX_TRACKED_KEYS) {
    for (const tracked of [...failures.keys()]) recentFailures(tracked, now);
  }
  failures.set(key, [...recentFailures(key, now), now]);
}

export function clearFailures(key: string): void {
  failures.delete(key);
}

/** Apenas para testes. */
export function resetThrottle(): void {
  failures.clear();
}

export const THROTTLE_LIMITS = { WINDOW_MS, MAX_FAILURES } as const;
