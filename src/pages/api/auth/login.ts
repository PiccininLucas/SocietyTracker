import type { APIRoute } from 'astro';
import {
  verifyPin,
  generateSessionToken,
  ADMIN_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from '../../../core/infrastructure/auth/pinAuth';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    let pin = '';
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const body = await request.json();
      pin = body.pin;
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      pin = (formData.get('pin') as string) || '';
    }

    if (!pin || !verifyPin(pin)) {
      return new Response(
        JSON.stringify({ error: 'PIN incorreto. Verifique e tente novamente.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

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

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Autenticado com sucesso!',
        expiresInSeconds: SESSION_MAX_AGE_SECONDS,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Erro ao processar login.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
