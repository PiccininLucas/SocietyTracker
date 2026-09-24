import type { APIRoute } from 'astro';
import { SupabasePlayerRepository } from '../../../core/infrastructure/repositories/SupabasePlayerRepository';
import { UpdatePlayerUseCase } from '../../../core/application/use-cases/UpdatePlayerUseCase';

export const prerender = false;

export const PATCH: APIRoute = async ({ request, params }) => {
  try {
    const id = params.id;
    if (!id) {
      return new Response(JSON.stringify({ error: 'ID do jogador é obrigatório.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return new Response(JSON.stringify({ error: 'Corpo da requisição inválido.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // PATCH parcial: só repassamos o que veio no corpo, para que `undefined` continue
    // significando "não alterar" em vez de "limpar".
    const update: Parameters<UpdatePlayerUseCase['execute']>[0] = { id };
    if ('name' in body) {
      if (typeof body.name !== 'string') {
        return new Response(JSON.stringify({ error: 'Nome deve ser um texto.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      update.name = body.name;
    }
    if ('nickname' in body) {
      if (body.nickname !== null && typeof body.nickname !== 'string') {
        return new Response(JSON.stringify({ error: 'Apelido deve ser um texto ou nulo.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      update.nickname = body.nickname;
    }
    if ('isGoalkeeper' in body) {
      if (typeof body.isGoalkeeper !== 'boolean') {
        return new Response(JSON.stringify({ error: 'isGoalkeeper deve ser booleano.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      update.isGoalkeeper = body.isGoalkeeper;
    }

    const playerRepo = new SupabasePlayerRepository();
    const useCase = new UpdatePlayerUseCase(playerRepo);

    const result = await useCase.execute(update);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    const isNotFound = error.message?.includes('não encontrado');
    return new Response(JSON.stringify({ error: error.message || 'Erro ao atualizar jogador.' }), {
      status: isNotFound ? 404 : 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
