import type { APIRoute } from 'astro';
import { SupabaseSessionRepository } from '../../../../core/infrastructure/repositories/SupabaseSessionRepository';
import { UpdateSessionTeamsUseCase } from '../../../../core/application/use-cases/UpdateSessionTeamsUseCase';

export const prerender = false;

export const PUT: APIRoute = async ({ request, params }) => {
  try {
    const sessionId = params.id;
    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'ID da rodada não informado.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const sessionRepo = new SupabaseSessionRepository();
    const useCase = new UpdateSessionTeamsUseCase(sessionRepo);

    const result = await useCase.execute({
      sessionId,
      teams: body.teams || [],
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Erro ao atualizar times da rodada.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const POST: APIRoute = PUT;
