import type { APIRoute } from 'astro';
import { SupabasePlayerRepository } from '../../../core/infrastructure/repositories/SupabasePlayerRepository';
import { UpdatePlayerUseCase } from '../../../core/application/use-cases/UpdatePlayerUseCase';

export const prerender = false;

export const PATCH: APIRoute = async ({ request, params }) => {
  try {
    const id = params.id;
    if (!id) {
      return new Response(
        JSON.stringify({ error: 'ID do jogador é obrigatório.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json();
    const playerRepo = new SupabasePlayerRepository();
    const useCase = new UpdatePlayerUseCase(playerRepo);

    const result = await useCase.execute({
      id,
      name: body.name,
      nickname: body.nickname,
      isGoalkeeper: body.isGoalkeeper,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    const isNotFound = error.message?.includes('não encontrado');
    return new Response(
      JSON.stringify({ error: error.message || 'Erro ao atualizar jogador.' }),
      { status: isNotFound ? 404 : 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
