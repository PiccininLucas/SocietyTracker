import type { APIRoute } from 'astro';
import { ADMIN_COOKIE_NAME } from '../../../core/infrastructure/auth/pinAuth';
import { json } from '../../../core/infrastructure/http/api';

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
  cookies.delete(ADMIN_COOKIE_NAME, {
    path: '/',
  });

  return json({ success: true, message: 'Sessão encerrada com sucesso.' });
};
