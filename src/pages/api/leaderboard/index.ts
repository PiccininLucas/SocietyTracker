import type { APIRoute } from 'astro';
import { SupabaseMatchRepository } from '../../../core/infrastructure/repositories/SupabaseMatchRepository';
import { GetLeaderboardUseCase } from '../../../core/application/use-cases/GetLeaderboardUseCase';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const matchRepo = new SupabaseMatchRepository();
    const useCase = new GetLeaderboardUseCase(matchRepo);
    const leaderboard = await useCase.execute();

    return new Response(JSON.stringify(leaderboard), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Erro ao buscar classificação.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
