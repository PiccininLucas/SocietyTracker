import type { APIRoute } from 'astro';
import { ADMIN_COOKIE_NAME } from '../../../core/infrastructure/auth/pinAuth';

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
  cookies.delete(ADMIN_COOKIE_NAME, {
    path: '/',
  });

  return new Response(
    JSON.stringify({ success: true, message: 'Sessão encerrada com sucesso.' }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};
