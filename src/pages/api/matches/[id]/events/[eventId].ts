import type { APIRoute } from 'astro';
import { SupabaseMatchRepository } from '../../../../../core/infrastructure/repositories/SupabaseMatchRepository';
import { UpdateMatchEventUseCase } from '../../../../../core/application/use-cases/UpdateMatchEventUseCase';
import { DeleteMatchEventUseCase } from '../../../../../core/application/use-cases/DeleteMatchEventUseCase';

export const prerender = false;

export const PATCH: APIRoute = async ({ request, params }) => {
  try {
    const matchId = params.id;
    const eventId = params.eventId;

    if (!matchId) {
      return new Response(
        JSON.stringify({ error: 'ID da partida é obrigatório.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!eventId) {
      return new Response(
        JSON.stringify({ error: 'ID do evento é obrigatório.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json();
    const matchRepo = new SupabaseMatchRepository();
    const useCase = new UpdateMatchEventUseCase(matchRepo);

    const result = await useCase.execute({
      matchId,
      eventId,
      teamId: body.teamId,
      scorerId: body.scorerId,
      assistId: body.assistId,
      isOwnGoal: body.isOwnGoal,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    const isNotFound = error.message?.includes('não foi encontrado') || error.message?.includes('não encontrada');
    return new Response(
      JSON.stringify({ error: error.message || 'Erro ao atualizar evento da partida.' }),
      { status: isNotFound ? 404 : 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  try {
    const matchId = params.id;
    const eventId = params.eventId;

    if (!matchId) {
      return new Response(
        JSON.stringify({ error: 'ID da partida é obrigatório.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!eventId) {
      return new Response(
        JSON.stringify({ error: 'ID do evento é obrigatório.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const matchRepo = new SupabaseMatchRepository();
    const useCase = new DeleteMatchEventUseCase(matchRepo);

    const result = await useCase.execute({
      matchId,
      eventId,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    const isNotFound = error.message?.includes('não foi encontrado') || error.message?.includes('não encontrada');
    return new Response(
      JSON.stringify({ error: error.message || 'Erro ao excluir evento da partida.' }),
      { status: isNotFound ? 404 : 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
