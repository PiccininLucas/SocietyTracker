import type { APIRoute } from 'astro';
import {
  verifyPin,
  generateSessionToken,
  ADMIN_COOKIE_NAME,
  ADMIN_HINT_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from '../../../core/infrastructure/auth/pinAuth';
import {
  clientKey,
  checkThrottle,
  registerFailure,
  clearFailures,
} from '../../../core/infrastructure/auth/loginThrottle';
import { json } from '../../../core/infrastructure/http/api';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  const key = clientKey(request, clientAddress);
  try {
    const verdict = checkThrottle(key);
    if (verdict.blocked) {
      console.warn(`[auth] Login bloqueado por excesso de tentativas. Origem: ${key}`);
      return json(
        { error: 'Muitas tentativas. Aguarde alguns minutos antes de tentar de novo.' },
        429,
        { 'Retry-After': String(verdict.retryAfterSeconds) }
      );
    }

    let pin = '';
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      // Sem a checagem de tipo, `{"pin": 1234}` fazia verifyPin chamar .trim() num
      // número e a rota respondia 500 com o erro interno em vez de 401.
      const body = await request.json().catch(() => null);
      if (typeof body?.pin === 'string') pin = body.pin;
      else if (typeof body?.pin === 'number') pin = String(body.pin);
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      const field = formData.get('pin');
      pin = typeof field === 'string' ? field : '';
    }

    if (!pin || !verifyPin(pin)) {
      registerFailure(key);
      const left = checkThrottle(key);
      console.warn(
        `[auth] Tentativa de login recusada. Origem: ${key}. ` +
          (left.blocked ? 'Limite atingido.' : `Restam ${left.remaining} tentativas na janela.`)
      );
      return json({ error: 'PIN incorreto. Verifique e tente novamente.' }, 401);
    }

    clearFailures(key);

    // Gera token assinado válido por 24 horas
    const token = generateSessionToken(pin.trim());

    // Define cookie HttpOnly no cliente
    cookies.set(ADMIN_COOKIE_NAME, token, {
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
      httpOnly: true,
      sameSite: 'lax',
      secure: import.meta.env.PROD,
    });
    // Só para a interface mostrar o "Sair"; a mesma validade do cookie de sessão.
    cookies.set(ADMIN_HINT_COOKIE_NAME, '1', {
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
      httpOnly: false,
      sameSite: 'lax',
      secure: import.meta.env.PROD,
    });

    return json({
      success: true,
      message: 'Autenticado com sucesso!',
      expiresInSeconds: SESSION_MAX_AGE_SECONDS,
    });
  } catch (error) {
    console.error('[auth] Falha ao processar login:', error);
    return json({ error: 'Erro ao processar login. Tente novamente em instantes.' }, 500);
  }
};
