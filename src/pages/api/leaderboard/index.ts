import { SupabaseMatchRepository } from '../../../core/infrastructure/repositories/SupabaseMatchRepository';
import { GetLeaderboardUseCase } from '../../../core/application/use-cases/GetLeaderboardUseCase';
import { endpoint, json } from '../../../core/infrastructure/http/api';

export const prerender = false;

export const GET = endpoint(async () =>
  json(await new GetLeaderboardUseCase(new SupabaseMatchRepository()).execute())
);
