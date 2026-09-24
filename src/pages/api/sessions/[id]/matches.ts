import { endpoint, json } from '../../../../core/infrastructure/http/api';
import { uuid } from '../../../../core/infrastructure/http/validate';
import { SupabaseMatchRepository } from '../../../../core/infrastructure/repositories/SupabaseMatchRepository';
export const prerender = false;
export const GET = endpoint(async ({ params }) =>
  json(await new SupabaseMatchRepository().getMatchesSummary(uuid(params.id, 'id da rodada')))
);
