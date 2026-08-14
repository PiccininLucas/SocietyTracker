import type { APIRoute } from 'astro';
import { isAuthenticatedFromRequest } from '../../../core/infrastructure/auth/pinAuth';

export const prerender = false;

export const GET: APIRoute = async ({ cookies, request }) => {
  const authenticated = isAuthenticatedFromRequest(cookies, request);

  return new Response(
    JSON.stringify({ isAuthenticated: authenticated }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};
