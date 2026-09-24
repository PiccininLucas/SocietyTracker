import type { APIRoute } from 'astro';
import { isAuthenticatedFromRequest } from '../../../core/infrastructure/auth/pinAuth';
import { json } from '../../../core/infrastructure/http/api';

export const prerender = false;

// `no-store`: a resposta depende do cookie, e um cache intermediário poderia devolver o
// "autenticado" de outra pessoa.
export const GET: APIRoute = async ({ cookies, request }) =>
  json({ isAuthenticated: isAuthenticatedFromRequest(cookies, request) });
