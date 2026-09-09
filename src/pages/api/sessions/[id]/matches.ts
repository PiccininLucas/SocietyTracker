import type { APIRoute } from 'astro';
import { json, apiError } from '../../../../core/infrastructure/http/matchApi';
import { SupabaseMatchRepository } from '../../../../core/infrastructure/repositories/SupabaseMatchRepository';
export const prerender = false;
export const GET: APIRoute = async ({ params }) => {
  try {
    return json(await new SupabaseMatchRepository().getMatchesSummary(params.id));
  } catch (e) {
    return apiError(e);
  }
};
