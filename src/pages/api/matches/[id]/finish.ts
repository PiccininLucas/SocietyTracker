import type { APIRoute } from 'astro';
import { SupabaseMatchRepository } from '../../../../core/infrastructure/repositories/SupabaseMatchRepository';
import { FinishMatchUseCase } from '../../../../core/application/use-cases/FinishMatchUseCase';

export const prerender = false;

export const POST: APIRoute = async ({ request, params }) => {
  try {
    const matchId = params.id;
    if (!matchId) {
      return new Response(
        JSON.stringify({ error: 'ID da partida é obrigatório.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json();
    const matchRepo = new SupabaseMatchRepository();
    const useCase = new FinishMatchUseCase(matchRepo);

    const result = await useCase.execute({
      matchId,
      durationSeconds: body.durationSeconds,
      reason: body.reason || 'manual',
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Erro ao finalizar partida.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
