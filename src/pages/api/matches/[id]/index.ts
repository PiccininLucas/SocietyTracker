import type { APIRoute } from 'astro';
import { matchCommand, json, apiError } from '../../../../core/infrastructure/http/matchApi';
import { SupabaseMatchRepository } from '../../../../core/infrastructure/repositories/SupabaseMatchRepository';
export const prerender = false;
export const PATCH: APIRoute = (c) => matchCommand(c, 'score');
export const DELETE: APIRoute = (c) => matchCommand(c, 'remove_match');
export const GET: APIRoute = async ({ params }) => {
  try {
    const m = await new SupabaseMatchRepository().getMatchById(params.id!);
    return m ? json(m) : json({ error: 'Partida não encontrada.' }, 404);
  } catch (e) {
    return apiError(e);
  }
};
