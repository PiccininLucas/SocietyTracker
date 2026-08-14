import type { APIRoute } from 'astro';
import { SupabaseMatchRepository } from '../../../core/infrastructure/repositories/SupabaseMatchRepository';
import { StartMatchUseCase } from '../../../core/application/use-cases/StartMatchUseCase';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const matchRepo = new SupabaseMatchRepository();
    const useCase = new StartMatchUseCase(matchRepo);

    const result = await useCase.execute({
      sessionId: body.sessionId,
      homeTeamId: body.homeTeamId,
      awayTeamId: body.awayTeamId,
    });

    return new Response(JSON.stringify(result), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Erro ao iniciar partida.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
