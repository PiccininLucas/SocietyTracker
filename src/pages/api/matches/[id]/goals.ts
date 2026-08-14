import type { APIRoute } from 'astro';
import { SupabaseMatchRepository } from '../../../../core/infrastructure/repositories/SupabaseMatchRepository';
import { RegisterGoalUseCase } from '../../../../core/application/use-cases/RegisterGoalUseCase';

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
    const useCase = new RegisterGoalUseCase(matchRepo);

    const result = await useCase.execute({
      matchId,
      teamId: body.teamId,
      scorerId: body.scorerId || null,
      assistId: body.assistId || null,
      eventTimeSeconds: body.eventTimeSeconds,
      isOwnGoal: body.isOwnGoal ?? false,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Erro ao registrar gol.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
