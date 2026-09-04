import type { APIRoute } from 'astro';
import { SupabaseMatchRepository } from '../../../../core/infrastructure/repositories/SupabaseMatchRepository';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  try {
    const matchId = params.id;
    if (!matchId) {
      return new Response(
        JSON.stringify({ error: 'ID da partida é obrigatório.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const matchRepo = new SupabaseMatchRepository();
    const match = await matchRepo.getMatchById(matchId);

    if (!match) {
      return new Response(
        JSON.stringify({ error: 'Partida não encontrada.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify(match), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Erro ao buscar detalhes da partida.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const PATCH: APIRoute = async ({ request, params }) => {
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
    const { UpdateMatchScoreUseCase } = await import('../../../../core/application/use-cases/UpdateMatchScoreUseCase');
    const useCase = new UpdateMatchScoreUseCase(matchRepo);

    const result = await useCase.execute({
      matchId,
      homeScore: body.homeScore !== undefined ? Number(body.homeScore) : undefined,
      awayScore: body.awayScore !== undefined ? Number(body.awayScore) : undefined,
      status: body.status,
      endReason: body.endReason,
      durationSeconds: body.durationSeconds !== undefined ? Number(body.durationSeconds) : undefined,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Erro ao atualizar dados da partida.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

