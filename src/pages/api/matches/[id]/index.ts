import type { APIRoute } from 'astro';
import { matchCommand } from '../../../../core/infrastructure/http/matchApi';
import { endpoint, json } from '../../../../core/infrastructure/http/api';
import { uuid } from '../../../../core/infrastructure/http/validate';
import { SupabaseMatchRepository } from '../../../../core/infrastructure/repositories/SupabaseMatchRepository';
export const prerender = false;
export const PATCH: APIRoute = (c) => matchCommand(c, 'score');
export const DELETE: APIRoute = (c) => matchCommand(c, 'remove_match');
export const GET = endpoint(async ({ params }) => {
  const m = await new SupabaseMatchRepository().getMatchById(uuid(params.id, 'id da partida'));
  return m ? json(m) : json({ error: 'Partida não encontrada.' }, 404);
});
